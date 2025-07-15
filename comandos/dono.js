const { exec } = require('child_process');

// !sair
module.exports.sair = {
    name: 'sair',
    ownerOnly: true,
    groupOnly: true,
    async run(sock, msg, args, config) {
        await sock.sendMessage(msg.key.remoteJid, { text: 'Até logo! Saindo do grupo...' });
        await sock.groupLeave(msg.key.remoteJid);
    }
};

// !bc (Broadcast)
module.exports.bc = {
    name: 'bc',
    ownerOnly: true,
    async run(sock, msg, args, config) {
        const message = args.join(' ');
        if (!message) {
            return sock.sendMessage(msg.key.remoteJid, { text: 'Por favor, forneça uma mensagem para o broadcast.' });
        }
        
        const chats = await sock.groupFetchAllParticipating();
        const chatIds = Object.keys(chats);

        for (let id of chatIds) {
            await sock.sendMessage(id, { text: `*--- BROADCAST de ${config.ownerName} ---*\n\n${message}` });
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay para evitar spam
        }
        await sock.sendMessage(msg.key.remoteJid, { text: 'Broadcast concluído!' });
    }
};

// !exec
module.exports.exec = {
    name: 'exec',
    ownerOnly: true,
    async run(sock, msg, args, config) {
        const code = args.join(' ');
        if (!code) return;
        
        // AVISO DE SEGURANÇA EXTREMO
        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ *PERIGO:* Executando código diretamente no servidor...' });

        try {
            exec(code, (err, stdout, stderr) => {
                if (err) {
                    sock.sendMessage(msg.key.remoteJid, { text: `*Erro:*\n${stderr}` });
                    return;
                }
                sock.sendMessage(msg.key.remoteJid, { text: `*Saída:*\n${stdout}` });
            });
        } catch (e) {
            await sock.sendMessage(msg.key.remoteJid, { text: `Falha ao executar: ${e.message}` });
        }
    }
};
