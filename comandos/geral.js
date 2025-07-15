const moment = require('moment-timezone');

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
    menu: {
        name: 'menu',
        description: 'Mostra o menu de comandos',
        async run(sock, msg, args, config) {
            const menuText = `
╭───「 ${config.networkName} 」
│ ✇ Olá, ${msg.pushName}!
│
│ 👑 *Dono:* ${config.ownerName}
│ 🤖 *Bot:* ${config.botName}
╰─────────────
╭───「 *MENU DE COMANDOS* 」
│
│ ⚙️ *Gerais:*
│ • ${config.prefix}menu
│ • ${config.prefix}status
│
│ 🎛️ *Grupo (Admins):*
│ • ${config.prefix}antilink on/off
│ • ${config.prefix}ban @membro
│ • ${config.prefix}add 55...
│ • ${config.prefix}promote @membro
│ • ${config.prefix}demote @admin
│ • ${config.prefix}link
│ • ${config.prefix}tagall
│ • ${config.prefix}grupo abrir/fechar
│ • ${config.prefix}setnomegrupo <nome>
│ • ${config.prefix}setdesc <desc>
│
│ 👑 *Dono:*
│ • ${config.prefix}sair
│
╰─────────────
            `;
            await sock.sendMessage(msg.key.remoteJid, { text: menuText.trim() }, { quoted: msg });
        }
    },
    status: {
        name: 'status',
        description: 'Mostra o status do bot',
        async run(sock, msg, args, config) {
            const uptime = formatUptime(process.uptime());
            const statusText = `
*──「 STATUS DO BOT 」──*

🤖 *Nome:* ${config.botName}
👑 *Dono:* ${config.ownerName}
🕒 *Uptime:* ${uptime}
⚙️ *Versão do Bot:* 1.2.0 (Anti-Link com ADM)
            `;
            await sock.sendMessage(msg.key.remoteJid, { text: statusText.trim() }, { quoted: msg });
        }
    }
};
