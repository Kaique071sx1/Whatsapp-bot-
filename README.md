# Bot de WhatsApp Completo para Termux

Este é um bot multifuncional para WhatsApp, projetado para rodar em Android via Termux. Ele oferece uma gama de funcionalidades para gerenciamento de grupos, incluindo um sistema de anti-link com advertências, e é construído de forma modular para fácil expansão.

## ✨ Funcionalidades

- **Gerenciamento de Grupo:** Comandos para banir, adicionar, promover, rebaixar, alterar nome/descrição, e mais.
- **Proteção Anti-Link:** Sistema customizável com 3 níveis de advertência antes de banir automaticamente o usuário.
- **Conexão Fácil:** Autenticação via QR Code diretamente no terminal.
- **Modularidade:** Comandos organizados em arquivos separados para fácil manutenção e adição de novas funções.
- **Persistência:** Projetado para rodar 24/7 usando PM2.

---

## 🚀 Guia de Instalação e Uso

Siga estes passos para instalar e rodar o bot do zero no Termux.

### 1. Pré-requisitos

-   Aplicativo **Termux** instalado no seu celular Android.
-   Um número de WhatsApp para dedicar ao bot.

### 2. Instalação

Abra o Termux e execute os seguintes comandos, um por um.

**a) Atualize os pacotes do Termux:**
```bash
pkg update && pkg upgrade -y

b) Instale as dependências principais (Git e Node.js):

Bash

pkg install git nodejs-lts -y
c) Clone este repositório:

Bash

git clone [https://github.com/Kaique071sx1/Whatsapp-bot-.git](https://github.com/Kaique071sx1/Whatsapp-bot-.git)
d) Entre na pasta do projeto:

Bash

cd Whatsapp-bot-

e) Execute o script de instalação automática:
Este script irá instalar todas as outras dependências necessárias, incluindo as da npm.

Bash

bash install.sh
3. Primeira Execução e Configuração
Após a instalação, você precisa iniciar o bot pela primeira vez para configurá-lo.

a) Inicie o bot:

Bash

node index.js


b) Responda às perguntas no terminal:
O bot irá pedir informações como:

Nome do bot

Seu nome (dono)

Prefixo dos comandos (ex: !)

Seu número de WhatsApp para notificações (ID do Dono)

Nome da sua "rede" ou equipe (para o menu)

c) Escaneie o QR Code:
Após as perguntas, um QR Code aparecerá no terminal. Abra o WhatsApp no seu celular principal, vá em Configurações > Aparelhos Conectados > Conectar um aparelho e escaneie o código.

Após escanear, o bot estará online!

4. Rodando o Bot em Segundo Plano (24/7)
Para garantir que o bot não pare de funcionar quando você fechar o Termux, vamos usar o PM2, um gerenciador de processos.

a) Pare o bot se ele ainda estiver rodando (pressione Ctrl + C).

b) Instale o PM2 globalmente:

Bash

npm install pm2 -g
c) Inicie o bot com o PM2: pm2 start index.js --name "whatsapp-bot"

Seu bot agora está rodando em segundo plano!

5. Comandos de Uso Diário (PM2)
Ver status dos bots: pm2 list

Ver os logs em tempo real (para depuração): pm2 logs whatsapp-bot

Reiniciar o bot (após editar o código): pm2 restart whatsapp-bot

Parar o bot: pm2 stop whatsapp-bot

⚠️ Dica Importante de Bateria
Para evitar que o sistema Android feche o Termux para economizar energia, vá nas Configurações do seu celular > Aplicativos > Termux > Bateria e mude a configuração para "Sem restrições" ou "Não otimizado".


