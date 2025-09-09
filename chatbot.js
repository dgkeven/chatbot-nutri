const express = require('express');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeString = null;

app.get('/', (req, res) => {
    res.send('Bot WhatsApp rodando!');
});

// Nova rota para visualizar o QR Code como imagem
app.get('/qrcode', async (req, res) => {
    if (!qrCodeString) {
        return res.send('QR Code ainda não gerado. Aguarde o bot inicializar.');
    }

    try {
        const qrImage = await qrcode.toDataURL(qrCodeString);
        const html = `
            <html>
                <body style="text-align:center; font-family:sans-serif">
                    <h2>Escaneie o QR Code abaixo para autenticar no WhatsApp</h2>
                    <img src="${qrImage}" />
                </body>
            </html>
        `;
        res.send(html);
    } catch (err) {
        res.status(500).send('Erro ao gerar imagem do QR Code');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // às vezes ajuda em EC2
            '--disable-gpu'
        ],
        defaultViewport: null,
        timeout: 0 // desativa timeout do Puppeteer
    }
});

const agendamentos = {};
const atendimentoManual = {};
const interessadosGrupo = [];

client.on('qr', qr => {
    qrCodeString = qr; // Agora a rota /qrcode terá acesso à string
    qrcode.generate(qr, { small: true }); // Continua imprimindo no terminal
});

client.on('ready', () => {
    console.log('Bot está pronto!');
});

client.on('message', async msg => {
    const texto = msg.body.trim().toLowerCase();
    const chatId = msg.from;

    // Ignora grupos
    if (chatId.includes('@g.us')) return;

    // Permitir o comando "encerrar" mesmo em atendimento manual
    if (texto === 'encerrar') {
        if (atendimentoManual[chatId]) {
            delete atendimentoManual[chatId];
            client.sendMessage(chatId, '✅ Atendimento automático reativado. Conte comigo!');
        } else {
            client.sendMessage(chatId, '⚠️ Você não está em atendimento manual. Envie "manual" para desativar o robô.');
        }
        return;
    }

    // Permitir o comando "manual" para iniciar atendimento manual
    if (texto === 'manual') {
        atendimentoManual[chatId] = true;
        client.sendMessage(chatId, '🤖 Atendimento automático desativado. Agora está em modo manual.');
        return;
    }

    // Se estiver em atendimento manual, o robô deve parar aqui
    if (atendimentoManual[chatId]) {
        console.log(`Usuário ${chatId} está em modo manual. Ignorando mensagem.`);
        return;
    }

    if (!agendamentos[chatId]) {
        agendamentos[chatId] = { etapa: 0 };
    }

    const etapa = agendamentos[chatId].etapa;

    if (texto === 'cancelar') {
        delete agendamentos[chatId];
        return client.sendMessage(chatId, 'Atendimento cancelado. Se precisar de algo, estou à disposição!');
    }

    switch (etapa) {
        case 0:
            client.sendMessage(chatId, `Olá! 👋 Bem-vinda! Como posso te ajudar hoje?
    
    1 - Agendar consulta nutricional  
    2 - Saber mais sobre o Grupo Metamorfose  
    3 - Tira dúvidas ou envio de exames  
    
    ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.`);
            agendamentos[chatId].etapa = 1;
            break;

        case 1:
            if (texto === '1') {
                client.sendMessage(chatId, `Olá! Meu nome é Priscilla Dalbem, sou nutricionista há 13 anos, especializada em Nutrição Esportiva, Saúde da Mulher, Fitoterapia e Gastronomia Aplicada à Nutrição.

                    Meu acompanhamento tem duração média de 50 minutos, onde realizo uma anamnese completa para entender sua rotina, preferências e objetivos. Também solicito exames de sangue para avaliar possíveis carências nutricionais ou alterações hormonais. Além disso, faço uma avaliação física detalhada, incluindo peso, altura, bioimpedância, dobras cutâneas e circunferências, para calcular seu percentual de gordura e massa muscular.
                    
                    Com base nesses dados, elaboro seu plano alimentar personalizado, que é entregue em até 3 dias, juntamente com materiais complementares como receitas, lista de compras e checklist de automonitoramento. Ofereço suporte via WhatsApp para dúvidas e dificuldades, e os retornos são geralmente a cada 45 ou 60 dias, conforme necessidade.
                    
                    O valor da consulta é R$ 280,00, sem direito a retorno.
                    
                    Caso tenha interesse, posso verificar um horário para você. 😊
                    
                    Por favor, informe sua disponibilidade de dia e horário. Atendo de segunda a quinta-feira, das 08:00 às 11:00 e das 14:00 às 18:00.`);
                agendamentos[chatId].etapa = 2;
            } else if (texto === '2') {
                const contato = await msg.getContact();
                interessadosGrupo.push({
                    nome: contato.pushname || contato.name || 'Desconhecido',
                    numero: chatId
                });

                const mensagemGrupo = `🌸 *Grupo Metamorfose – Sua transformação começa agora!*

                Você, mulher que está cansada de dietas restritivas, da culpa ao comer e da pressão para ter um corpo “perfeito”… chegou a hora de viver uma nova relação com a comida – e com você mesma.
                
                O *Metamorfose* é um grupo online de emagrecimento com duração de 15 dias, criado especialmente para mulheres que desejam cuidar da saúde, conquistar mais bem-estar e alcançar o emagrecimento de forma leve, consciente e sem terrorismo nutricional.
                
                Durante esses dias, eu, Priscilla, nutricionista esportiva com especialização em saúde da mulher, estarei com você diariamente no WhatsApp, oferecendo:
                
                • Orientações práticas e acessíveis para uma alimentação equilibrada  
                • Dicas e reflexões para melhorar sua relação com a comida  
                • Suporte emocional e motivacional  
                • Estímulo ao autocuidado e à aceitação do seu corpo em todas as fases  
                
                ✨ *Não é sobre “seguir dieta”, é sobre se reconectar com seu corpo e com a sua essência. É sobre transformar de dentro para fora.*
                
                📣 *Vagas limitadas!* Me envie uma mensagem para garantir a sua participação no Grupo Metamorfose!`;

                client.sendMessage(chatId, mensagemGrupo);
                delete agendamentos[chatId];
            } else if (texto === '3') {
                client.sendMessage(chatId, `👩‍⚕️ Você pode enviar suas dúvidas por aqui ou anexar seus exames diretamente nesta conversa. Assim que possível, responderei ou encaminharei para análise. 😊  
    
    ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.`);
                delete agendamentos[chatId];
            }
            break;

        case 2:
            agendamentos[chatId].disponibilidade = msg.body;
            client.sendMessage(chatId, `Ótimo! Agora, por favor, informe seu principal objetivo com a consulta nutricional:
        
        1 - Emagrecimento  
        2 - Controle de taxas  
        3 - Reeducação alimentar  
        4 - Hipertrofia/definição  
        5 - Gestante/tentante  
        6 - Doenças associadas (Diabetes, Gordura no fígado, SOP, Problemas intestinais, etc).  
        
        ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.`);
            agendamentos[chatId].etapa = 3;
            break;

        case 3:
            const objetivos = {
                '1': 'Emagrecimento',
                '2': 'Controle de taxas',
                '3': 'Reeducação alimentar',
                '4': 'Hipertrofia/definição',
                '5': 'Gestante/tentante',
                '6': 'Doenças associadas'
            };

            const escolha = objetivos[msg.body];

            if (escolha) {
                agendamentos[chatId].objetivo = escolha;
                client.sendMessage(chatId, `Perfeito! Recebi sua disponibilidade e objetivo: ${escolha}. Em breve entrarei em contato para agendarmos sua consulta. Até logo! 😊`);
                delete agendamentos[chatId];
            } else {
                client.sendMessage(chatId, 'Opção inválida. Por favor, escolha uma das opções listadas. ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.');
            }
            break;
    }

    // Verifica se a pessoa respondeu "tenho interesse" sobre o grupo Metamorfose
    if (texto === 'tenho interesse') {
        const contato = await msg.getContact();
        const nome = contato.pushname || contato.name || 'Desconhecido';

        // Evita duplicidade
        if (!interessadosGrupo.some(i => i.numero === chatId)) {
            interessadosGrupo.push({
                nome,
                numero: chatId
            });
        }

        client.sendMessage(chatId, `🥰 Que bom saber do seu interesse, ${nome}! Assim que eu tiver uma nova data para o próximo Grupo Metamorfose, entrarei em contato com você. Até breve! 💕`);
        return;
    }

});

// Inicialização do client com tratamento de erro
(async () => {
    try {
        await client.initialize();
    } catch (err) {
        console.error('Erro ao inicializar o bot:', err);
        setTimeout(() => process.exit(1), 5000); // PM2 reinicia
    }
})();

