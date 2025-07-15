const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { readdirSync } = require('fs');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');
const { exec } = require('child_process');
const qrcode = require('qrcode-terminal');

const logger = require('./utils/logger');

let config = {};
const commands = new Map();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
    if (fs.existsSync('config.json')) {
        try {
            const fileContent = fs.readFileSync('config.json', 'utf-8');
            if (fileContent.trim() === '') throw new Error("Arquivo config.json está vazio.");
            config = JSON.parse(fileContent);
            return;
        } catch (error) {
            logger.error(`Erro ao ler config.json: ${error.message}.`);
            logger.warn("Excluindo config.json corrompido e reiniciando o setup.");
            fs.unlinkSync('config.json');
        }
    }

    console.log(chalk.yellow('--- SETUP INICIAL ---'));
    config.botName = await askQuestion(chalk.green('Qual o nome do bot? '));
    config.ownerName = await askQuestion(chalk.green('Qual o nome do dono? '));
    config.prefix = await askQuestion(chalk.green('Qual o prefixo para os comandos? (ex: !, /, .) '));
    config.ownerId = await askQuestion(chalk.green('Qual o ID do dono? (ex: 5511999998888) '));
    config.networkName = await askQuestion(chalk.green('Qual o nome da sua rede? (ex: Hendtrick Bot) '));
    const antiLink = await askQuestion(chalk.green('Deseja ativar a proteção Anti-Link? (s/n) '));
    config.antiLink = antiLink.toLowerCase() === 's';
    config.ownerId = `${config.ownerId}@s.whatsapp.net`;

    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log(chalk.blue('Configuração salva em config.json!'));
    rl.close();
}

try {
    const commandFiles = readdirSync(path.join(__dirname, 'comandos')).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(__dirname, 'comandos', file);
        const commandModule = require(filePath);
        if (commandModule.name && commandModule.run) {
            commands.set(commandModule.name, commandModule);
            logger.info(`Comando carregado: ${commandModule.name} (arquivo: ${file})`);
        } else {
            for (const key in commandModule) {
                const command = commandModule[key];
                if (command && command.name && command.run) {
                    commands.set(command.name, command);
                    logger.info(`Comando carregado: ${command.name} (arquivo: ${file})`);
                }
            }
        }
    }
} catch (error) {
    logger.error("Erro ao carregar comandos:", error);
}

async function connectToWhatsApp() {
    await setup();
    
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();
    const versionString = version.version ? version.version.join('.') : 'desconhecida';
    logger.info(`Usando Baileys v${versionString}`);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        getMessage: async (key) => ({ conversation: 'hello' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(chalk.yellow('Abra o WhatsApp, vá em Aparelhos Conectados e escaneie o QR Code abaixo:'));
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.error('Conexão fechada. Motivo:', lastDisconnect.error, `\nReconectando: ${shouldReconnect}`);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            logger.info('Conexão aberta!');
            sock.sendMessage(config.ownerId, { text: `${config.botName} está online!` });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const groupId = msg.key.remoteJid;
        const senderId = msg.key.participant || msg.sender;
        const isGroup = groupId.endsWith('@g.us');
        
        if (isGroup && config.antiLink && body.match(/chat.whatsapp.com/)) {
            logger.warn(`Link detectado no grupo ${groupId} por ${senderId}`);
            try {
                const groupMeta = await sock.groupMetadata(groupId);
                const senderIsAdmin = groupMeta.participants.find(p => p.id === senderId)?.admin;
                if (!senderIsAdmin) {
                    await sock.sendMessage(groupId, { text: `🚫 Link detectado! ${msg.pushName} será removido.` });
                    await sock.groupParticipantsUpdate(groupId, [senderId], 'remove');
                    return; 
                } else {
                    logger.info('Link enviado por um admin, ignorando.');
                }
            } catch (e) {
                logger.error('Erro na função anti-link:', e);
            }
        }

        if (!body.startsWith(config.prefix)) return;
        
        const args = body.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = commands.get(commandName);

        if (!command) return;

        logger.info(`Comando recebido: ${commandName} de ${msg.key.remoteJid}`);

        try {
            if (command.ownerOnly && senderId !== config.ownerId) {
                return sock.sendMessage(groupId, { text: 'Apenas meu dono pode usar este comando!' }, { quoted: msg });
            }
            if (command.groupOnly && !isGroup) {
                 return sock.sendMessage(groupId, { text: 'Este comando só pode ser usado em grupos.' }, { quoted: msg });
            }
            if (command.adminOnly && isGroup) {
                const groupMeta = await sock.groupMetadata(groupId);
                const senderIsAdmin = groupMeta.participants.find(p => p.id === senderId)?.admin;
                if (!senderIsAdmin) {
                    return sock.sendMessage(groupId, { text: 'Você precisa ser admin para usar este comando.' }, { quoted: msg });
                }
            }
            
            await command.run(sock, msg, args, config);
        } catch (error) {
            logger.error(`Erro ao executar o comando ${commandName}:`, error);
            await sock.sendMessage(msg.key.remoteJid, { text: 'Ocorreu um erro ao executar este comando.' }, { quoted: msg });
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        const user = participants[0];
        logger.info(`Evento de participante no grupo ${id}: ${user} - ${action}`);

        try {
            if (action === 'add') {
                await sock.sendMessage(id, { text: `👋 Bem-vindo(a) ao grupo, @${user.split('@')[0]}!`, mentions: [user] });
            } else if (action === 'remove') {
                await sock.sendMessage(id, { text: `😥 Adeus, @${user.split('@')[0]}!`, mentions: [user] });
            }
        } catch (e) {
            logger.error(`Erro no evento de boas-vindas/saída:`, e);
        }
    });
}

connectToWhatsApp();
