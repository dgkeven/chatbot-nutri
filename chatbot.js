// Importação dos módulos necessários
const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs'); // Módulo para interagir com o sistema de arquivos

// --- CONFIGURAÇÃO DO SERVIDOR EXPRESS ---
const app = express();
const PORT = process.env.PORT || 3000;
const SESSIONS_FILE = './sessions_nutricionista.json'; // Arquivo para persistir o estado das conversas

let qrCodeString = null;

// --- GERENCIAMENTO DE ESTADO (MEMÓRIA DO BOT) ---
let conversas = {};
try {
    if (fs.existsSync(SESSIONS_FILE)) {
        const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
        conversas = JSON.parse(data);
        console.log('✅ Sessões de conversa carregadas do arquivo.');
    }
} catch (error) {
    console.error('⚠️ Erro ao carregar o arquivo de sessões. Iniciando com memória vazia.', error);
    conversas = {};
}

// --- FUNÇÃO DE SALVAMENTO SÍNCRONA (MAIS ROBUSTA) ---
function saveConversations() {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(conversas, null, 2));
    } catch (err) {
        console.error('❌ Erro CRÍTICO ao salvar as sessões no arquivo:', err);
    }
}

// --- CONTROLE DE MENSAGENS DUPLICADAS ---
const processedMessages = new Set();
setInterval(() => {
    processedMessages.clear();
}, 60000); // Limpa o cache a cada 1 minuto

// --- ROTAS DO SERVIDOR EXPRESS ---
app.get('/', (req, res) => {
    res.send('Bot WhatsApp (Nutricionista) rodando!');
});

app.get('/qrcode', async (req, res) => {
    if (!qrCodeString) {
        return res.send('QR Code ainda não gerado. Aguarde a inicialização do bot e atualize a página.');
    }
    try {
        const qrImage = await qrcode.toDataURL(qrCodeString);
        const html = `
            <html>
                <head>
                    <title>QR Code WhatsApp</title>
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5; font-family: Arial, sans-serif; }
                        .container { text-align: center; padding: 40px; background-color: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                        h2 { color: #333; }
                        img { margin-top: 20px; border: 1px solid #ddd; padding: 5px; border-radius: 8px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Escaneie o QR Code para autenticar</h2>
                        <img src="${qrImage}" alt="QR Code do WhatsApp" />
                    </div>
                </body>
            </html>
        `;
        res.send(html);
    } catch (err) {
        console.error('Erro ao gerar imagem do QR Code:', err);
        res.status(500).send('Erro ao gerar imagem do QR Code');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}. Acesse /qrcode para ver o QR Code.`);
});


// --- CONFIGURAÇÃO DO CLIENTE WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth({ clientId: 'nutricionista' }), // clientId para não conflitar com outros bots
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
            '--disable-extensions', '--disable-gpu', '--disable-software-rasterizer',
            '--single-process'
        ],
    }
});

// --- EVENTOS DO CLIENTE WHATSAPP ---
client.on('qr', qr => {
    qrCodeString = qr;
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Bot Nutricionista está pronto e conectado! ✅');
});

// Evento para capturar mensagens ENVIADAS pela conta do bot (intervenção manual)
client.on('message_create', async msg => {
    if (!msg.fromMe) return;

    try {
        const chatId = msg.to;
        const texto = msg.body.trim().toLowerCase();
        if (chatId.includes('@g.us')) return;
        await handleOwnerMessage(chatId, texto);
    } catch (error) {
        console.error(`❌ Erro crítico em 'message_create' para ${msg.to}:`, error);
    }
});

// Evento para capturar mensagens RECEBIDAS de clientes
client.on('message', async msg => {
    try {
        const chatId = msg.from;
        const texto = msg.body.trim().toLowerCase();
        const msgId = msg.id._serialized;

        if (processedMessages.has(msgId)) return;
        if (chatId === 'status@broadcast' || msg.type !== 'chat') return;
        if (chatId.includes('@g.us')) return;

        processedMessages.add(msgId);
        await handleClientMessage(chatId, texto, msg);

    } catch (error) { // CORREÇÃO: Adicionado chaves {} ao redor do console.error
        console.error(`❌ Erro crítico em 'message' para ${msg.from}:`, error);
    }
});

// --- LÓGICA DE MANIPULAÇÃO DE MENSAGENS ---

async function handleOwnerMessage(chatId, texto) {
    let conversation = conversas[chatId];
    console.log(`[DONO/BOT] Mensagem para ${chatId}. Status atual: ${conversation?.status || 'Nenhum'}`);

    if (texto === 'automatico' || texto === 'encerrar') {
        if (conversation) {
            delete conversas[chatId];
            saveConversations();
            console.log(`[DONO/BOT] 🤖 Atendimento automático REATIVADO para ${chatId}.`);
        }
        return;
    }

    if (conversation && conversation.status === 'automated') {
        conversation.status = 'manual';
        saveConversations();
        console.log(`[DONO/BOT] Intervenção! Status para ${chatId} agora é MANUAL.`);
    } else if (!conversation) {
        conversas[chatId] = { status: 'manual' };
        saveConversations();
        console.log(`[DONO/BOT] Nova conversa iniciada. Status definido para MANUAL.`);
    }
}

async function handleClientMessage(chatId, texto, msg) {
    let conversation = conversas[chatId];
    console.log(`[CLIENTE] Mensagem de ${chatId}. Status da conversa: ${conversation?.status || 'Nenhum'}`);

    if (conversation && (conversation.status === 'manual' || conversation.status === 'processing')) {
        console.log(`[CLIENTE] Conversa em modo ${conversation.status}. Ignorando.`);
        return;
    }

    if (texto === 'cancelar') {
        delete conversas[chatId];
        saveConversations();
        await client.sendMessage(chatId, 'Atendimento cancelado. Se precisar de algo, estou à disposição!');
        return;
    }

    if (!conversation) {
        try {
            conversas[chatId] = { status: 'processing' };
            console.log(`[CLIENTE] Nova conversa. Iniciando atendimento para ${chatId}.`);
            await client.sendMessage(chatId, `Olá! 👋 Bem-vinda! Como posso te ajudar hoje?
    
1 - Agendar consulta nutricional  
2 - Saber mais sobre o Grupo Metamorfose  
3 - Tira dúvidas ou envio de exames 
    
❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.`);

            conversas[chatId] = { status: 'automated', etapa: 1 };
            saveConversations();

        } catch (err) {
            console.error(`[CLIENTE] Erro ao iniciar nova conversa com ${chatId}.`, err);
            delete conversas[chatId];
            saveConversations();
        }
        return;
    }

    await processarFluxoConversa(chatId, texto, msg);
}

async function processarFluxoConversa(chatId, texto, msg) {
    let conversation = conversas[chatId];
    if (!conversation || conversation.status !== 'automated') return;

    try {
        switch (conversation.etapa) {
            case 1: // Processa a escolha do menu
                if (texto === '1') {
                    await enviarInfosAgendamento(chatId);
                    conversation.etapa = 2;
                } else if (texto === '2') {
                    await enviarInfosGrupo(chatId);
                    // Após enviar as infos, o bot aguarda a resposta "tenho interesse"
                    conversation.etapa = 'aguardando_interesse_grupo';
                } else if (texto === '3') {
                    await client.sendMessage(chatId, `👩‍⚕️ Você pode enviar suas dúvidas ou anexar seus exames diretamente nesta conversa. Assim que possível, responderei.`);
                    // Coloca em modo manual para a nutricionista responder depois
                    conversation.status = 'manual';
                }
                break;

            case 'aguardando_interesse_grupo':
                if (texto === 'tenho interesse') {
                    await registrarInteresseGrupo(msg);
                    delete conversas[chatId]; // Finaliza o fluxo
                } else {
                    await client.sendMessage(chatId, `Entendido. Se mudar de ideia, basta enviar "tenho interesse". Se precisar de outra coisa, pode me chamar novamente.`);
                    delete conversas[chatId]; // Finaliza o fluxo
                }
                break;

            case 2: // Pergunta os objetivos após receber a disponibilidade
                conversation.disponibilidade = msg.body;
                await client.sendMessage(chatId, `Ótimo! Agora, por favor, informe seus principais objetivos com a consulta nutricional.
Você pode escolher mais de uma opção, basta enviar os números separados por vírgula ou espaço.

1 - Emagrecimento  
2 - Controle de taxas  
3 - Reeducação alimentar  
4 - Hipertrofia/definição  
5 - Gestante/tentante  
6 - Doenças associadas (Diabetes, Gordura no fígado, SOP, etc).`);
                conversation.etapa = 3;
                break;

            case 3: // Processa os objetivos e finaliza o agendamento
                const finalizado = await processarObjetivosEFinalizar(msg);
                if (finalizado) {
                    delete conversas[chatId];
                }
                break;
        }
        saveConversations();
    } catch (error) {
        console.error(`Erro no fluxo de conversa para ${chatId}:`, error);
        await client.sendMessage(chatId, "Ops! Ocorreu um erro. Vamos tentar novamente do início.");
        delete conversas[chatId];
        saveConversations();
    }
}

// --- FUNÇÕES AUXILIARES ---

async function enviarInfosAgendamento(chatId) {
    const texto = `Olá! Meu nome é Priscilla Dalbem, sou nutricionista há 13 anos, especializada em Nutrição Esportiva, Saúde da Mulher, Fitoterapia e Gastronomia Aplicada à Nutrição.

Meu acompanhamento tem duração média de 50 minutos, onde realizo uma anamnese completa para entender sua rotina, preferências e objetivos. Também solicito exames de sangue para avaliar possíveis carências nutricionais ou alterações hormonais. Além disso, faço uma avaliação física detalhada, incluindo peso, altura, bioimpedância, dobras cutâneas e circunferências, para calcular seu percentual de gordura e massa muscular.
                    
Com base nesses dados, elaboro seu plano alimentar personalizado, que é entregue em até 3 dias, juntamente com materiais complementares como receitas, lista de compras e checklist de automonitoramento. Ofereço suporte via WhatsApp para dúvidas e dificuldades, e os retornos são geralmente a cada 45 ou 60 dias, conforme necessidade.
                    
O valor da consulta é R$ 280,00, sem direito a retorno.
                    
Caso tenha interesse, posso verificar um horário para você. 😊
                    
Por favor, informe sua disponibilidade de dia e horário. Atendo de segunda a quinta-feira, das 08:00 às 11:00 e das 14:00 às 18:00.`;
    await client.sendMessage(chatId, texto);
}

async function enviarInfosGrupo(chatId) {
    const texto = `🌸 *Grupo Metamorfose – Sua transformação começa agora!*

Você, mulher que está cansada de dietas restritivas, da culpa ao comer e da pressão para ter um corpo “perfeito”… chegou a hora de viver uma nova relação com a comida – e com você mesma.
                
O *Metamorfose* é um grupo online de emagrecimento com duração de 15 dias, criado especialmente para mulheres que desejam cuidar da saúde, conquistar mais bem-estar e alcançar o emagrecimento de forma leve, consciente e sem terrorismo nutricional.
                
Durante esses dias, eu, Priscilla, nutricionista esportiva com especialização em saúde da mulher, estarei com você diariamente no WhatsApp, oferecendo:
                
• Orientações práticas e acessíveis para uma alimentação equilibrada  
• Dicas e reflexões para melhorar sua relação com a comida  
• Suporte emocional e motivacional  
• Estímulo ao autocuidado e à aceitação do seu corpo em todas as fases  
                
✨ *Não é sobre “seguir dieta”, é sobre se reconectar com seu corpo e com a sua essência. É sobre transformar de dentro para fora.*
                
📣 *Vagas limitadas!* Me envie uma mensagem para garantir a sua participação no Grupo Metamorfose!`;
    await client.sendMessage(chatId, texto);
}

async function processarObjetivosEFinalizar(msg) {
    const texto = msg.body.trim().toLowerCase();
    const conversation = conversas[msg.from];

    const objetivosMap = { '1': 'Emagrecimento', '2': 'Controle de taxas', '3': 'Reeducação alimentar', '4': 'Hipertrofia/definição', '5': 'Gestante/tentante', '6': 'Doenças associadas' };
    const escolhas = texto.replace(/,/g, ' ').split(/\s+/).filter(n => n && objetivosMap[n]);
    const objetivosSelecionados = escolhas.map(num => objetivosMap[num]);

    if (objetivosSelecionados.length > 0) {
        const objetivosTexto = objetivosSelecionados.join(', ');
        conversation.objetivo = objetivosTexto;
        console.log(`Novo pedido de agendamento:
        - Contato: ${msg.from}
        - Disponibilidade: ${conversation.disponibilidade}
        - Objetivos: ${conversation.objetivo}`);

        await client.sendMessage(msg.from, `Perfeito! Recebi sua disponibilidade e objetivo(s): *${objetivosTexto}*. Em breve entrarei em contato para confirmarmos um horário. Até logo! 😊`);
        return true;
    } else {
        await client.sendMessage(msg.from, "Não entendi sua seleção de objetivos. Por favor, envie apenas os números correspondentes.");
        return false;
    }
}

async function registrarInteresseGrupo(msg) {
    const chatId = msg.from;
    const contato = await msg.getContact();
    const nome = contato.pushname || contato.name || 'Desconhecido';

    // Para persistência, podemos salvar isso dentro do objeto 'conversas'
    if (!conversas.interessadosGrupo) {
        conversas.interessadosGrupo = [];
    }
    if (!conversas.interessadosGrupo.some(i => i.numero === chatId)) {
        conversas.interessadosGrupo.push({ nome, numero: chatId });
        console.log("Novo interessado no grupo:", { nome, numero: chatId });
    }

    await client.sendMessage(chatId, `🥰 Que ótimo, ${nome}! Seu interesse foi registrado. Assim que a próxima turma do Grupo Metamorfose for aberta, eu avisarei você por aqui. Até breve! 💕`);
}

// --- INICIALIZAÇÃO DO BOT ---
client.initialize().catch(err => {
    console.error("Erro na inicialização do cliente:", err);
});