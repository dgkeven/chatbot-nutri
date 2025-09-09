const express = require('express');
const qrcode = require('qrcode');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@adiwajshing/baileys');
const P = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeString = null;
let sock; // socket do WhatsApp

const agendamentos = {};
const atendimentoManual = {};
const interessadosGrupo = [];

// Rota principal
app.get('/', (req, res) => {
    res.send('Bot WhatsApp rodando com Baileys!');
});

// Rota para QR Code
app.get('/qrcode', async (req, res) => {
    if (!qrCodeString) {
        return res.send('QR Code ainda não gerado. Aguarde o bot inicializar.');
    }
    try {
        const qrImage = await qrcode.toDataURL(qrCodeString);
        res.send(`
            <html>
                <body style="text-align:center; font-family:sans-serif">
                    <h2>Escaneie o QR Code abaixo para autenticar no WhatsApp</h2>
                    <img src="${qrImage}" />
                </body>
            </html>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar imagem do QR Code');
    }
});

// Inicialização do servidor HTTP
app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

// Função para iniciar o bot
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: 'silent' }),
    });

    // Captura QR Code e conexão
    sock.ev.on('connection.update', (update) => {
        const { qr, connection, lastDisconnect } = update;

        if (qr) qrCodeString = qr;

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Desconectado:', reason);
            if (reason !== DisconnectReason.loggedOut) {
                console.log('Reiniciando bot...');
                startBot();
            }
        }

        if (connection === 'open') {
            console.log('Bot está pronto!');
        }
    });

    // Salva credenciais sempre que mudar
    sock.ev.on('creds.update', saveCreds);

    // Recebe mensagens
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid.includes('@g.us')) return; // ignora grupos

        const chatId = msg.key.remoteJid;
        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const lowerTexto = texto.trim().toLowerCase();

        // Comando "encerrar"
        if (lowerTexto === 'encerrar') {
            if (atendimentoManual[chatId]) {
                delete atendimentoManual[chatId];
                await sock.sendMessage(chatId, { text: '✅ Atendimento automático reativado. Conte comigo!' });
            } else {
                await sock.sendMessage(chatId, { text: '⚠️ Você não está em atendimento manual. Envie "manual" para desativar o robô.' });
            }
            return;
        }

        // Comando "manual"
        if (lowerTexto === 'manual') {
            atendimentoManual[chatId] = true;
            await sock.sendMessage(chatId, { text: '🤖 Atendimento automático desativado. Agora está em modo manual.' });
            return;
        }

        if (atendimentoManual[chatId]) return;

        if (!agendamentos[chatId]) agendamentos[chatId] = { etapa: 0 };
        const etapa = agendamentos[chatId].etapa;

        if (lowerTexto === 'cancelar') {
            delete agendamentos[chatId];
            return await sock.sendMessage(chatId, { text: 'Atendimento cancelado. Se precisar de algo, estou à disposição!' });
        }

        switch (etapa) {
            case 0:
                await sock.sendMessage(chatId, {
                    text: `Olá! 👋 Bem-vinda! Como posso te ajudar hoje?

1 - Agendar consulta nutricional  
2 - Saber mais sobre o Grupo Metamorfose  
3 - Tira dúvidas ou envio de exames  

❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.` });
                agendamentos[chatId].etapa = 1;
                break;

            case 1:
                if (lowerTexto === '1') {
                    await sock.sendMessage(chatId, {
                        text: `Olá! Meu nome é Priscilla Dalbem, sou nutricionista há 13 anos, especializada em Nutrição Esportiva, Saúde da Mulher, Fitoterapia e Gastronomia Aplicada à Nutrição.

                    Meu acompanhamento tem duração média de 50 minutos, onde realizo uma anamnese completa para entender sua rotina, preferências e objetivos. Também solicito exames de sangue para avaliar possíveis carências nutricionais ou alterações hormonais. Além disso, faço uma avaliação física detalhada, incluindo peso, altura, bioimpedância, dobras cutâneas e circunferências, para calcular seu percentual de gordura e massa muscular.
                    
                    Com base nesses dados, elaboro seu plano alimentar personalizado, que é entregue em até 3 dias, juntamente com materiais complementares como receitas, lista de compras e checklist de automonitoramento. Ofereço suporte via WhatsApp para dúvidas e dificuldades, e os retornos são geralmente a cada 45 ou 60 dias, conforme necessidade.
                    
                    O valor da consulta é R$ 280,00, sem direito a retorno.
                    
                    Caso tenha interesse, posso verificar um horário para você. 😊
                    
                    Por favor, informe sua disponibilidade de dia e horário. Atendo de segunda a quinta-feira, das 08:00 às 11:00 e das 14:00 às 18:00` });
                    agendamentos[chatId].etapa = 2;
                } else if (lowerTexto === '2') {
                    const contato = msg.pushName || 'Desconhecido';
                    interessadosGrupo.push({ nome: contato, numero: chatId });
                    await sock.sendMessage(chatId, {
                        text: `🌸 *Grupo Metamorfose – Sua transformação começa agora!*

                Você, mulher que está cansada de dietas restritivas, da culpa ao comer e da pressão para ter um corpo “perfeito”… chegou a hora de viver uma nova relação com a comida – e com você mesma.
                
                O *Metamorfose* é um grupo online de emagrecimento com duração de 15 dias, criado especialmente para mulheres que desejam cuidar da saúde, conquistar mais bem-estar e alcançar o emagrecimento de forma leve, consciente e sem terrorismo nutricional.
                
                Durante esses dias, eu, Priscilla, nutricionista esportiva com especialização em saúde da mulher, estarei com você diariamente no WhatsApp, oferecendo:
                
                • Orientações práticas e acessíveis para uma alimentação equilibrada  
                • Dicas e reflexões para melhorar sua relação com a comida  
                • Suporte emocional e motivacional  
                • Estímulo ao autocuidado e à aceitação do seu corpo em todas as fases  
                
                ✨ *Não é sobre “seguir dieta”, é sobre se reconectar com seu corpo e com a sua essência. É sobre transformar de dentro para fora.*
                
                📣 *Vagas limitadas!* Me envie uma mensagem para garantir a sua participação no Grupo Metamorfose!` });
                    delete agendamentos[chatId];
                } else if (lowerTexto === '3') {
                    await sock.sendMessage(chatId, {
                        text: `👩‍⚕️ Você pode enviar suas dúvidas por aqui ou anexar seus exames diretamente nesta conversa. Assim que possível, responderei ou encaminharei para análise. 😊  
    
    ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.` });
                    delete agendamentos[chatId];
                }
                break;

            case 2:
                agendamentos[chatId].disponibilidade = texto;
                await sock.sendMessage(chatId, {
                    text: `Ótimo! Agora, por favor, informe seu principal objetivo com a consulta nutricional:

1 - Emagrecimento  
2 - Controle de taxas  
3 - Reeducação alimentar  
4 - Hipertrofia/definição  
5 - Gestante/tentante  
6 - Doenças associadas (Diabetes, Gordura no fígado, SOP, Problemas intestinais, etc).  

❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.` });
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
                const escolha = objetivos[lowerTexto];
                if (escolha) {
                    agendamentos[chatId].objetivo = escolha;
                    await sock.sendMessage(chatId, { text: `Perfeito! Recebi sua disponibilidade e objetivo: ${escolha}. Em breve entrarei em contato para agendarmos sua consulta. Até logo! 😊` });
                    delete agendamentos[chatId];
                } else {
                    await sock.sendMessage(chatId, { text: 'Opção inválida. Por favor, escolha uma das opções listadas. ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.' });
                }
                break;
        }

        // Verifica interesse no grupo
        if (lowerTexto === 'tenho interesse') {
            const nome = msg.pushName || 'Desconhecido';
            if (!interessadosGrupo.some(i => i.numero === chatId)) {
                interessadosGrupo.push({ nome, numero: chatId });
            }
            await sock.sendMessage(chatId, { text: `🥰 Que bom saber do seu interesse, ${nome}! Assim que eu tiver uma nova data para o próximo Grupo Metamorfose, entrarei em contato com você. Até breve! 💕` });
        }
    });
}

// Inicializa o bot
startBot().catch(err => console.error('Erro ao iniciar o bot:', err));
