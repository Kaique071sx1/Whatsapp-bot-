// Este arquivo pode conter múltiplos objetos de comando
// Exemplo para !ban
module.exports.ban = {
    name: 'ban',
    groupOnly: true,
    adminOnly: true,
    async run(sock, msg, args, config) {
        // Lógica para banir
    }
};

// Exemplo para !link
module.exports.link = {
    name: 'link',
    groupOnly: true,
    async run(sock, msg, args, config) {
        const groupId = msg.key.remoteJid;
        try {
            const code = await sock.groupInviteCode(groupId);
            await sock.sendMessage(groupId, { text: `https://chat.whatsapp.com/${code}` });
        } catch (e) {
            await sock.sendMessage(groupId, { text: 'Não foi possível gerar o link. Verifique se sou admin.' });
        }
    }
};

// Exemplo para !tagall
module.exports.tagall = {
    name: 'tagall',
    groupOnly: true,
    adminOnly: true,
    async run(sock, msg, args, config) {
        const groupId = msg.key.remoteJid;
        const groupMetadata = await sock.groupMetadata(groupId);
        const participants = groupMetadata.participants;

        let text = args.join(' ') || 'Atenção todos!';
        let mentions = [];
        
        for (let participant of participants) {
            mentions.push(participant.id);
        }

        await sock.sendMessage(groupId, { text, mentions });
    }
};

// ... e assim por diante para !add, !promote, !demote, !setnomegrupo, etc.
// A lógica para cada um envolve usar funções como:
// sock.groupParticipantsUpdate(groupId, [participantId], "add" | "remove" | "promote" | "demote")
// sock.groupUpdateSubject(groupId, newName)
// sock.groupUpdateDescription(groupId, newDescription)
