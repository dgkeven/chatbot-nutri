# 🤖 Chatbot de Agendamentos para WhatsApp – Priscilla Dalbem

Este é um chatbot desenvolvido com [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) que auxilia no atendimento automatizado de pacientes da nutricionista **Priscilla Dalbem**, incluindo agendamentos, informações sobre o _Grupo Metamorfose_, dúvidas gerais e suporte humano (modo manual).

## ✨ Funcionalidades

- Responde automaticamente com um menu de opções.
- Coleta informações para agendamento de consultas.
- Informa sobre o grupo de emagrecimento _Metamorfose_.
- Permite envio de exames ou dúvidas.
- Suporte ao atendimento manual (modo humano).
- Reconhece comandos de controle: `manual`, `encerrar` e `cancelar`.
- Armazena interessados no grupo _Metamorfose_ em memória.

---

## ⚙️ Requisitos

- Node.js (v14 ou superior recomendado)
- Um número ativo no WhatsApp Web
- Dependências do projeto (instaladas via `npm`)

---

## 📦 Instalação

```bash
git clone https://github.com/dgkeven/chatbot-nutri.git
cd chatbot-nutri
npm install
```

---

## ▶️ Executando o Bot

```bash
node index.js
```

Ao iniciar, um QR Code será exibido no terminal. Escaneie com seu WhatsApp para autenticar.

---

## 💬 Comandos Suportados

| Comando           | Função                                                          |
| ----------------- | --------------------------------------------------------------- |
| `1`               | Inicia o processo de agendamento de consulta.                   |
| `2`               | Exibe informações sobre o grupo _Metamorfose_.                  |
| `3`               | Orientações para envio de dúvidas ou exames.                    |
| `manual`          | Coloca o atendimento em modo humano (manual).                   |
| `encerrar`        | Encerra o modo manual e volta para o atendimento automático.    |
| `cancelar`        | Cancela o atendimento em andamento e reinicia o menu principal. |
| `tenho interesse` | Registra o número como interessado no grupo Metamorfose.        |

---

## 🧠 Lógica do Bot

O bot utiliza um objeto `agendamentos` para rastrear o progresso de cada usuário durante a conversa, com base no número do WhatsApp. O estado da conversa é armazenado por etapas:

- **Etapa 0**: Apresentação do menu inicial.
- **Etapa 1**: Interpretação da escolha do menu.
- **Etapa 2**: Coleta da disponibilidade.
- **Etapa 3**: Coleta do objetivo da consulta.

Também há um modo de atendimento manual, ativado com o comando `manual`, que pausa as respostas automáticas até que o usuário envie `encerrar`.

---

## 📝 Exemplo de Fluxo

1. Usuário envia `1` → Recebe detalhes sobre a consulta.
2. Usuário envia disponibilidade → É solicitado o objetivo.
3. Usuário envia objetivo (ex: `1`) → Encerramento do fluxo com confirmação.

---

## 🔐 Autenticação

O bot utiliza `LocalAuth`, que armazena os dados de sessão localmente em `./.wwebjs_auth`. Isso evita a necessidade de escanear o QR code em cada execução.

---

## 🚧 Observações

- Este bot **não utiliza banco de dados**. Todas as informações são armazenadas **em memória**, portanto reiniciar o script limpa os dados dos usuários e interessados.
- Para produção, recomenda-se persistir os dados com um banco de dados (MongoDB, SQLite, PostgreSQL, etc).

---

## 📄 Licença

Este projeto é open-source e pode ser adaptado conforme suas necessidades. Nenhuma informação sensível é armazenada sem consentimento.

---
