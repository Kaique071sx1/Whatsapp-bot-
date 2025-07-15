const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const { readdirSync } = require('fs');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const chalk = require('chalk');
const { exec } = require('child_process');

const logger = require('./utils/logger'); // Nosso logger personalizado

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
        config = JSON.parse(fs.readFileSync('config.json'));
        // Adiciona novas opções de configuração se não existirem
        if (config.antiLink === undefined) config.antiLink = false; // Desativado por padrão
        fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        return;
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

// Carregar comandos (Plugin System)
const commandFolders = readdirSync(path.join(__dirname, 'comandos'));
for (const folder of commandFolders) {
    const commandFiles = readdirSync(path.join(__dirname, 'comandos', folder)).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        try {
            const commandModule = require(path.join(__dirname, 'comandos', folder, file));
            // Suporte para múltiplos comandos por arquivo
            for (const commandName in commandModule) {
                 const command = commandModule[commandName];
                 if (command.name) {
                    commands.set(command.name, command);
                    logger.info(`Comando carregado: ${command.name}`);
                }
            }
        } catch (error) {
            logger.error(`Erro ao carregar o comando ${file}:`, error);
        }
    }
}


async function connectToWhatsApp() {
    await setup();
    
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();
    logger.info(`Usando Baileys v${version}`);

    const sock = makeWASocket({
        version,
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: 'silent' }),
        getMessage: async (key) => {
            return { conversation: 'hello' };
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            logger.info('QR Code gerado, escaneie com seu celular.');
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
        
        // --- INÍCIO DO CÓDIGO INSERIDO ---

        // Anti-link (apenas em grupos)
        if (isGroup && config.antiLink && body.match(/chat.whatsapp.com/)) {
            logger.warn(`Link detectado no grupo ${groupId} por ${senderId}`);
            try {
                const groupMeta = await sock.groupMetadata(groupId);
                const senderIsAdmin = groupMeta.participants.find(p => p.id === senderId)?.admin;
        
                if (!senderIsAdmin) {
                    await sock.sendMessage(groupId, { text: `🚫 Link detectado! ${msg.pushName} será removido.` });
                    await sock.groupParticipantsUpdate(groupId, [senderId], 'remove');
                    return; // Interrompe o processamento para não executar comandos
                } else {
                    logger.info('Link enviado por um admin, ignorando.');
                }
            } catch (e) {
                logger.error('Erro na função anti-link:', e);
            }
        }

        // --- FIM DO CÓDIGO INSERIDO ---


        // Processamento de comandos
        if (!body.startsWith(config.prefix)) return;
        
        const args = body.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = commands.get(commandName);

        if (!command) return;

        // Log
        logger.info(`Comando recebido: ${commandName} de ${msg.key.remoteJid}`);

        try {
            // Checagens de permissão
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

    // --- INÍCIO DO CÓDIGO INSERIDO ---

    // Evento para Boas-Vindas/Saída
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

    // --- FIM DO CÓDIGO INSERIDO ---
    
    // Comandos de reiniciar e atualizar (movidos para o dono.js seria o ideal, mas mantendo aqui por simplicidade)
    commands.set('reiniciar', {
        name: 'reiniciar',
        ownerOnly: true,
        async run(sock, msg, args, config) {
            logger.warn('Reiniciando o bot...');
            await sock.sendMessage(config.ownerId, { text: 'Reiniciando...' });
            exec('node index.js', (err, stdout, stderr) => {
                if (err) logger.error(err);
                logger.info(stdout);
            });
            process.exit();
        }
    });
    
    commands.set('atualizar', {
        name: 'atualizar',
        ownerOnly: true,
        async run(sock, msg, args, config) {
            logger.info('Verificando atualizações...');
            exec('git pull', (err, stdout, stderr) => {
                if (err) return logger.error('Erro ao atualizar:', stderr);
                if (stdout.includes('Already up to date.')) {
                    return sock.sendMessage(config.ownerId, { text: 'O bot já está na versão mais recente.' });
                }
                sock.sendMessage(config.ownerId, { text: 'Bot atualizado com sucesso! Reiniciando...' });
                process.exit();
            });
        }
    });
}

connectToWhatsApp();
