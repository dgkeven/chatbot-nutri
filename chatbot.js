const { create, Client } = require('@open-wa/wa-automate');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

let client; // Cliente WhatsApp
let qrCodeString = null;

const agendamentos = {};
const atendimentoManual = {};
const interessadosGrupo = [];

// Rota principal
app.get('/', (req, res) => {
    res.send('Bot WhatsApp rodando com @open-wa/wa-automate!');
});

// Rota para QR Code
app.get('/qrcode', async (req, res) => {
    if (!qrCodeString) return res.send('QR Code ainda não gerado. Aguarde o bot inicializar.');
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

// Inicializa o servidor HTTP
app.listen(PORT, () => {
    console.log(`Servidor HTTP rodando na porta ${PORT}`);
});

// Função para iniciar o bot
async function startBot() {
    client = await create({
        sessionId: "bot-whatsapp",
        multiDevice: true,           // Suporte a multi-device
        qrTimeout: 0,                // QR Code infinito até autenticar
        authTimeout: 0,
        blockCrashLogs: true,
        disableSpins: true,
        headless: true,              // Puppeteer headless
        useChrome: true,
        cacheEnabled: false,
        qrLogSkip: false
    });

    client.onStateChanged((state) => {
        if (state === 'CONFLICT' || state === 'UNPAIRED') {
            console.log('Reconectando...');
            client.forceRefocus();
        }
    });

    // Captura QR Code
    client.onQr((qr) => {
        qrCodeString = qr;
        console.log('QR Code gerado, abra a rota /qrcode para escanear');
    });

    // Mensagens recebidas
    client.onMessage(async (message) => {
        const chatId = message.from;
        const texto = (message.body || '').trim().toLowerCase();

        if (message.isGroupMsg) return; // Ignorar grupos

        // Comando "encerrar"
        if (texto === 'encerrar') {
            if (atendimentoManual[chatId]) {
                delete atendimentoManual[chatId];
                await client.sendText(chatId, '✅ Atendimento automático reativado. Conte comigo!');
            } else {
                await client.sendText(chatId, '⚠️ Você não está em atendimento manual. Envie "manual" para desativar o robô.');
            }
            return;
        }

        // Comando "manual"
        if (texto === 'manual') {
            atendimentoManual[chatId] = true;
            await client.sendText(chatId, '🤖 Atendimento automático desativado. Agora está em modo manual.');
            return;
        }

        if (atendimentoManual[chatId]) return;

        if (!agendamentos[chatId]) agendamentos[chatId] = { etapa: 0 };
        const etapa = agendamentos[chatId].etapa;

        if (texto === 'cancelar') {
            delete agendamentos[chatId];
            return await client.sendText(chatId, 'Atendimento cancelado. Se precisar de algo, estou à disposição!');
        }

        // Fluxo de atendimento
        switch (etapa) {
            case 0:
                await client.sendText(chatId, `Olá! 👋 Bem-vinda! Como posso te ajudar hoje?

1 - Agendar consulta nutricional  
2 - Saber mais sobre o Grupo Metamorfose  
3 - Tira dúvidas ou envio de exames  

❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.`);
                agendamentos[chatId].etapa = 1;
                break;

            case 1:
                if (texto === '1') {
                    await client.sendText(chatId, `Olá! Meu nome é Priscilla Dalbem, sou nutricionista há 13 anos, especializada em Nutrição Esportiva, Saúde da Mulher, Fitoterapia e Gastronomia Aplicada à Nutrição.

                    Meu acompanhamento tem duração média de 50 minutos, onde realizo uma anamnese completa para entender sua rotina, preferências e objetivos. Também solicito exames de sangue para avaliar possíveis carências nutricionais ou alterações hormonais. Além disso, faço uma avaliação física detalhada, incluindo peso, altura, bioimpedância, dobras cutâneas e circunferências, para calcular seu percentual de gordura e massa muscular.
                    
                    Com base nesses dados, elaboro seu plano alimentar personalizado, que é entregue em até 3 dias, juntamente com materiais complementares como receitas, lista de compras e checklist de automonitoramento. Ofereço suporte via WhatsApp para dúvidas e dificuldades, e os retornos são geralmente a cada 45 ou 60 dias, conforme necessidade.
                    
                    O valor da consulta é R$ 280,00, sem direito a retorno.
                    
                    Caso tenha interesse, posso verificar um horário para você. 😊
                    
                    Por favor, informe sua disponibilidade de dia e horário. Atendo de segunda a quinta-feira, das 08:00 às 11:00 e das 14:00 às 18:00`);
                    agendamentos[chatId].etapa = 2;
                } else if (texto === '2') {
                    const nome = message.sender.pushname || 'Desconhecido';
                    interessadosGrupo.push({ nome, numero: chatId });
                    await client.sendText(chatId, `🌸 *Grupo Metamorfose – Sua transformação começa agora!*

                Você, mulher que está cansada de dietas restritivas, da culpa ao comer e da pressão para ter um corpo “perfeito”… chegou a hora de viver uma nova relação com a comida – e com você mesma.
                
                O *Metamorfose* é um grupo online de emagrecimento com duração de 15 dias, criado especialmente para mulheres que desejam cuidar da saúde, conquistar mais bem-estar e alcançar o emagrecimento de forma leve, consciente e sem terrorismo nutricional.
                
                Durante esses dias, eu, Priscilla, nutricionista esportiva com especialização em saúde da mulher, estarei com você diariamente no WhatsApp, oferecendo:
                
                • Orientações práticas e acessíveis para uma alimentação equilibrada  
                • Dicas e reflexões para melhorar sua relação com a comida  
                • Suporte emocional e motivacional  
                • Estímulo ao autocuidado e à aceitação do seu corpo em todas as fases  
                
                ✨ *Não é sobre “seguir dieta”, é sobre se reconectar com seu corpo e com a sua essência. É sobre transformar de dentro para fora.*
                
                📣 *Vagas limitadas!* Me envie uma mensagem para garantir a sua participação no Grupo Metamorfose!`);
                    delete agendamentos[chatId];
                } else if (texto === '3') {
                    await client.sendText(chatId, `👩‍⚕️ Você pode enviar suas dúvidas por aqui ou anexar seus exames diretamente nesta conversa. Assim que possível, responderei ou encaminharei para análise. 😊  
    
    ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.`);
                    delete agendamentos[chatId];
                }
                break;

            case 2:
                agendamentos[chatId].disponibilidade = texto;
                await client.sendText(chatId, `Ótimo! Agora, por favor, informe seu principal objetivo com a consulta nutricional:

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
                const escolha = objetivos[texto];
                if (escolha) {
                    agendamentos[chatId].objetivo = escolha;
                    await client.sendText(chatId, `Perfeito! Recebi sua disponibilidade e objetivo: ${escolha}. Em breve entrarei em contato para agendarmos sua consulta. Até logo! 😊`);
                    delete agendamentos[chatId];
                } else {
                    await client.sendText(chatId, 'Opção inválida. Por favor, escolha uma das opções listadas. ❌ Envie "cancelar" a qualquer momento para encerrar o atendimento.');
                }
                break;
        }

        // Interesse no grupo
        if (texto === 'tenho interesse') {
            const nome = message.sender.pushname || 'Desconhecido';
            if (!interessadosGrupo.some(i => i.numero === chatId)) {
                interessadosGrupo.push({ nome, numero: chatId });
            }
            await client.sendText(chatId, `🥰 Que bom saber do seu interesse, ${nome}! Assim que eu tiver uma nova data para o próximo Grupo Metamorfose, entrarei em contato com você. Até breve! 💕`);
        }
    });
}

// Inicializa bot
startBot().catch(err => console.error('Erro ao iniciar o bot:', err));
