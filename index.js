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

// --- ARMAZENAMENTO E CACHE ---
const warnings = {}; // Armazena as advertências: { groupId: { userId: count } }
const processedMessages = new Set(); // Cache para evitar processamento duplicado de mensagens
const groupSettingsPath = path.join(__dirname, 'groupSettings.json');

function readGroupSettings() {
    if (!fs.existsSync(groupSettingsPath)) return {};
    try { return JSON.parse(fs.readFileSync(groupSettingsPath, 'utf-8')); }
    catch { return {}; }
}
// --- FIM DO ARMAZENAMENTO ---

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
    config.ownerId = await askQuestion(chalk.green('Qual o ID do dono para notificações? (ex: 5511999998888) '));
    config.networkName = await askQuestion(chalk.green('Qual o nome da sua rede/equipe? (ex: KS BOT-NET) '));
    config.ownerId = `${config.ownerId}@s.whatsapp.net`;

    fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
    console.log(chalk.blue('Configuração salva em config.json!'));
    rl.close();
}

try {
    const commandFolders = ['comandos'];
    for (const folder of commandFolders) {
        const commandFiles = readdirSync(path.join(__dirname, folder)).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(__dirname, folder, file);
            const commandModule = require(filePath);
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
    const versionString = version ? (version.version ? version.version.join('.') : 'desconhecida') : 'desconhecida';
    logger.info(`Usando Baileys v${versionString}`);

    const sock = makeWASocket({
        browser: ['Bot-Termux', 'Chrome', '120.0.0.0'],
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

        // --- LÓGICA ANTI-DUPLICIDADE ---
        const msgId = msg.key.id;
        if (processedMessages.has(msgId)) {
            return; // Se a mensagem já foi processada, ignora.
        }
        processedMessages.add(msgId);
        setTimeout(() => {
            processedMessages.delete(msgId); // Remove a ID do cache após 5 segundos
        }, 5000);
        // --- FIM DA LÓGICA ANTI-DUPLICIDADE ---

        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const groupId = msg.key.remoteJid;
        const senderId = msg.key.participant || msg.sender;
        const isGroup = groupId.endsWith('@g.us');

        // --- LÓGICA DO ANTI-LINK ATUALIZADA ---
        if (isGroup) {
            const groupSettings = readGroupSettings();
            const isAntiLinkEnabled = groupSettings[groupId]?.antiLinkEnabled;

            if (isAntiLinkEnabled && /https?:\/\//.test(body)) {
                const groupMetadata = await sock.groupMetadata(groupId);
                const senderIsAdmin = groupMetadata.participants.find(p => p.id === senderId)?.admin;

                if (!senderIsAdmin && senderId !== config.ownerId) {
                    logger.warn(`Link detectado de ${senderId} no grupo ${groupId}.`);
                    
                    // --- ADICIONADO: Deleta a mensagem com o link ---
                    await sock.sendMessage(groupId, { delete: msg.key });

                    if (!warnings[groupId]) warnings[groupId] = {};
                    if (!warnings[groupId][senderId]) warnings[groupId][senderId] = 0;

                    warnings[groupId][senderId]++;
                    
                    const warningCount = warnings[groupId][senderId];
                    let replyText = '';

                    switch (warningCount) {
                        case 1:
                            replyText = `1ª advertência para @${senderId.split('@')[0]}: você recebeu uma advertência ao enviar link no grupo.`;
                            await sock.sendMessage(groupId, { text: replyText, mentions: [senderId] });
                            break;
                        case 2:
                            replyText = `2ª advertência para @${senderId.split('@')[0]}: você recebeu outra advertência. Na próxima, será banido sem simpatia 😡`;
                            await sock.sendMessage(groupId, { text: replyText, mentions: [senderId] });
                            break;
                        case 3:
                        default:
                            replyText = `Adeus, @${senderId.split('@')[0]}. Você descumpriu as regras do grupo 👋`;
                            await sock.sendMessage(groupId, { text: replyText, mentions: [senderId] });
                            await sock.groupParticipantsUpdate(groupId, [senderId], 'remove');
                            warnings[groupId][senderId] = 0;
                            break;
                    }
                    return;
                }
            }
        }

        // --- Processamento de Comandos ---
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
