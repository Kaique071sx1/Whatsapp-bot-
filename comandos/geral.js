module.exports = {
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
│ • ${config.prefix}ban @membro
│ • ${config.prefix}add 55...
│ • ${config.prefix}promote @membro
│ • ${config.prefix}demote @admin
│ • ${config.prefix}link
│ • ${config.prefix}tagall
│ • ${config.prefix}grupo abrir/fechar
│ • ${config.prefix}setnomegrupo <nome>
│ • ${config.prefix}setdesc <desc>
│ • ${config.prefix}regras
│
│ 👑 *Dono:*
│ • ${config.prefix}sair
│ • ${config.prefix}bc <mensagem>
│ • ${config.prefix}reiniciar
│ • ${config.prefix}atualizar
│
╰─────────────
        `;
        await sock.sendMessage(msg.key.remoteJid, { text: menuText }, { quoted: msg });
    }
};

// Adicione o comando status neste mesmo arquivo se preferir
module.exports.status = {
    name: 'status',
    description: 'Mostra o status do bot',
    async run(sock, msg, args, config) {
        // Implemente a lógica de uptime se desejar
        const statusText = `
*Status do Bot*
- *Nome:* ${config.botName}
- *Dono:* ${config.ownerName}
- *Uptime:* (a implementar)
- *Versão:* 1.0.0
        `;
        await sock.sendMessage(msg.key.remoteJid, { text: statusText }, { quoted: msg });
    }
};
