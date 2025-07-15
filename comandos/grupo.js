const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');

const groupSettingsPath = path.join(__dirname, '..', 'groupSettings.json');

function readGroupSettings() {
    if (!fs.existsSync(groupSettingsPath)) return {};
    try { return JSON.parse(fs.readFileSync(groupSettingsPath, 'utf-8')); }
    catch { return {}; }
}

function saveGroupSettings(settings) {
    fs.writeFileSync(groupSettingsPath, JSON.stringify(settings, null, 2));
}

async function isBotAdmin(sock, msg) {
    const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
    const botId = jidNormalizedUser(sock.user.id);
    const botInfo = groupMetadata.participants.find(p => p.id === botId);
    return botInfo?.admin === 'admin' || botInfo?.admin === 'superadmin';
}

module.exports = {
    antilink: {
        name: 'antilink',
        description: 'Ativa ou desativa o sistema de anti-link no grupo.',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            const groupId = msg.key.remoteJid;
            const action = args[0]?.toLowerCase();
            const settings = readGroupSettings();
            if (!settings[groupId]) settings[groupId] = {};

            if (action === 'on') {
                settings[groupId].antiLinkEnabled = true;
                saveGroupSettings(settings);
                await sock.sendMessage(groupId, { text: '✅ Sistema Anti-Link com advertências ativado!' });
            } else if (action === 'off') {
                settings[groupId].antiLinkEnabled = false;
                saveGroupSettings(settings);
                await sock.sendMessage(groupId, { text: '❌ Sistema Anti-Link desativado.' });
            } else {
                const status = settings[groupId].antiLinkEnabled ? 'Ativado' : 'Desativado';
                await sock.sendMessage(groupId, { text: `Uso: !antilink on/off\nStatus atual: ${status}` }, { quoted: msg });
            }
        }
    },
    ban: {
        name: 'ban',
        description: 'Remove um membro do grupo',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length === 0) return sock.sendMessage(msg.key.remoteJid, { text: 'Você precisa marcar o membro para banir.' }, { quoted: msg });
            
            try {
                const userToBan = mentionedJids[0];
                await sock.groupParticipantsUpdate(msg.key.remoteJid, [userToBan], 'remove');
                // O evento de 'remove' no index.js já envia uma mensagem de "Adeus".
            } catch (e) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Ocorreu um erro ao tentar banir.' }, { quoted: msg });
            }
        }
    },
    add: {
        name: 'add',
        description: 'Adiciona um membro ao grupo',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            const numberToAdd = args.join(' ').replace(/[^0-9]/g, '');
            if (!numberToAdd) return sock.sendMessage(msg.key.remoteJid, { text: 'Forneça um número. Ex: !add 5511999998888' }, { quoted: msg });
            const jidToAdd = `${numberToAdd}@s.whatsapp.net`;
            try {
                await sock.groupParticipantsUpdate(msg.key.remoteJid, [jidToAdd], 'add');
                 // O evento de 'add' no index.js já envia a mensagem de boas-vindas.
            } catch (e) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Falha ao adicionar. O usuário pode ter me bloqueado ou ter privacidade ativada.' }, { quoted: msg });
            }
        }
    },
    promote: {
        name: 'promote',
        description: 'Promove um membro a admin',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length === 0) return sock.sendMessage(msg.key.remoteJid, { text: 'Você precisa marcar quem deseja promover.' }, { quoted: msg });
            
            try {
                const userToPromote = mentionedJids[0];
                await sock.groupParticipantsUpdate(msg.key.remoteJid, [userToPromote], 'promote');
                await sock.sendMessage(msg.key.remoteJid, { text: `👑 @${userToPromote.split('@')[0]} foi promovido a administrador!`, mentions: [userToPromote] });
            } catch (e) {
                await sock.sendMessage(msg.key.remoteJid, { text: `Ocorreu um erro ao promover @${mentionedJids[0].split('@')[0]}.`, mentions: mentionedJids });
            }
        }
    },
    demote: {
        name: 'demote',
        description: 'Rebaixa um admin a membro',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentionedJids.length === 0) return sock.sendMessage(msg.key.remoteJid, { text: 'Você precisa marcar quem deseja rebaixar.' }, { quoted: msg });

            try {
                const userToDemote = mentionedJids[0];
                await sock.groupParticipantsUpdate(msg.key.remoteJid, [userToDemote], 'demote');
                await sock.sendMessage(msg.key.remoteJid, { text: `👇 @${userToDemote.split('@')[0]} não é mais um administrador.`, mentions: [userToDemote] });
            } catch (e) {
                await sock.sendMessage(msg.key.remoteJid, { text: `Ocorreu um erro ao rebaixar @${mentionedJids[0].split('@')[0]}.`, mentions: mentionedJids });
            }
        }
    },
    group: {
        name: 'grupo',
        description: 'Abre ou fecha o grupo',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            const action = args[0]?.toLowerCase();
            
            try {
                if (action === 'abrir') {
                    await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement');
                    await sock.sendMessage(msg.key.remoteJid, { text: '🔓 Grupo aberto! Todos podem enviar mensagens.' });
                } else if (action === 'fechar') {
                    await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement');
                    await sock.sendMessage(msg.key.remoteJid, { text: '🔒 Grupo fechado! Apenas admins podem enviar mensagens.' });
                } else {
                    await sock.sendMessage(msg.key.remoteJid, { text: 'Use `!group abrir` ou `!group fechar`.' }, { quoted: msg });
                }
            } catch (e) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Ocorreu um erro ao tentar alterar as configurações do grupo.' });
            }
        }
    },
    tagall: {
        name: 'tagall',
        description: 'Marca todos os membros do grupo',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
            const participants = groupMetadata.participants;
            const text = args.join(' ') || 'Atenção, todos!';
            const mentions = participants.map(p => p.id);
            await sock.sendMessage(msg.key.remoteJid, { text, mentions });
        }
    },
    link: {
        name: 'link',
        description: 'Gera o link de convite do grupo',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            try {
                const code = await sock.groupInviteCode(msg.key.remoteJid);
                await sock.sendMessage(msg.key.remoteJid, { text: `https://chat.whatsapp.com/${code}` });
            } catch(e) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Ocorreu um erro ao gerar o link.' });
            }
        }
    },
    setnomegrupo: {
        name: 'setnomegrupo',
        description: 'Altera o nome do grupo',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            const newName = args.join(' ');
            if (!newName) return sock.sendMessage(msg.key.remoteJid, { text: 'Forneça um novo nome para o grupo.' }, { quoted: msg });
            try {
                await sock.groupUpdateSubject(msg.key.remoteJid, newName);
                await sock.sendMessage(msg.key.remoteJid, { text: '✅ Nome do grupo alterado!' });
            } catch (e) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Ocorreu um erro ao alterar o nome.' });
            }
        }
    },
    setdesc: {
        name: 'setdesc',
        description: 'Altera a descrição do grupo',
        groupOnly: true,
        adminOnly: true,
        async run(sock, msg, args) {
            if (!await isBotAdmin(sock, msg)) return sock.sendMessage(msg.key.remoteJid, { text: 'Eu preciso ser admin para executar este comando.' }, { quoted: msg });
            const newDesc = args.join(' ');
            if (!newDesc) return sock.sendMessage(msg.key.remoteJid, { text: 'Forneça uma nova descrição para o grupo.' }, { quoted: msg });
            try {
                await sock.groupUpdateDescription(msg.key.remoteJid, newDesc);
                await sock.sendMessage(msg.key.remoteJid, { text: '✅ Descrição do grupo alterada!' });
            } catch (e) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Ocorreu um erro ao alterar a descrição.' });
            }
        }
    }
};
