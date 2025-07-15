#!/bin/bash

# --- Cores para o terminal ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Iniciando a instalação do Bot para WhatsApp...${NC}"

# --- Atualizar pacotes do Termux ---
echo -e "\n${YELLOW}Atualizando pacotes do sistema...${NC}"
apt update && apt upgrade -y

# --- Instalar dependências essenciais (Node.js 18+, Git, etc.) ---
echo -e "\n${YELLOW}Instalando Node.js, Git e outras dependências...${NC}"
pkg install nodejs-lts git ffmpeg libwebp imagemagick -y

# --- Clonar o repositório do bot (JÁ CORRIGIDO COM O SEU LINK) ---
echo -e "\n${YELLOW}Clonando o repositório do bot...${NC}"
git clone https://github.com/Kaique071sx1/Whatsapp-bot-.git
cd Whatsapp-bot-

# --- Instalar dependências do Node.js ---
echo -e "\n${YELLOW}Instalando as dependências do projeto via npm...${NC}"
npm install

echo -e "\n\n${GREEN}Instalação concluída!${NC}"
echo -e "Agora, o bot pode ser iniciado com o comando:"
echo -e "${YELLOW}node index.js${NC}"
