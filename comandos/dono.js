module.exports = {
    sair: {
        name: 'sair',
        description: 'Faz o bot sair do grupo atual.',
        ownerOnly: true,
        groupOnly: true,
        async run(sock, msg, args, config) {
            await sock.sendMessage(msg.key.remoteJid, { text: 'Entendido, mestre. Até a próxima! 👋' });
            await sock.groupLeave(msg.key.remoteJid);
        }
    }
};
