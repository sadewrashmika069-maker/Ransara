const { Sparky } = require("../lib");

// මැසේජ් මතක තියාගන්න පොඩි Cache එකක් (Memory එක පිරෙන එක නවත්තන්න 500කට සීමා කරලා තියෙන්නේ)
if (!global.msgCache) global.msgCache = [];

Sparky({
    name: "antidelete",
    pattern: /.*/, // හැම මැසේජ් එකක්ම අල්ලගන්නවා
    fromMe: false,
    dontAddCommandList: true,
    desc: "Anti-Delete System (මැකූ පණිවිඩ අල්ලා ගැනීම)"
}, async ({ client, m }) => {
    try {
        // 1. එන හැම මැසේජ් එකක්ම Cache එකට දාගන්නවා
        if (m.key && m.message) {
            // දැනට තියෙන මැසේජ් එකද කියලා බලලා ඇඩ් කරනවා
            const exists = global.msgCache.find(msg => msg.id === m.key.id);
            if (!exists) {
                global.msgCache.push({
                    id: m.key.id,
                    message: m.message,
                    sender: m.sender || m.key.participant || m.key.remoteJid,
                    chat: m.key.remoteJid
                });
                
                // මැසේජ් 500 ට වඩා වැඩිනම් පරණම එක අයින් කරනවා
                if (global.msgCache.length > 500) {
                    global.msgCache.shift();
                }
            }
        }

        // 2. කවුරුහරි මැසේජ් එකක් මකනවද කියලා බලනවා (ProtocolMessage - REVOKE)
        let isRevoke = m.message && m.message.protocolMessage && 
                      (m.message.protocolMessage.type === 0 || 
                       m.message.protocolMessage.type === "REVOKE" || 
                       m.message.protocolMessage.type === 14);

        if (isRevoke) {
            let deletedKey = m.message.protocolMessage.key;
            let deletedId = deletedKey.id;

            // මකපු මැසේජ් එක අපේ Cache එකේ තියෙනවද හොයනවා
            let foundMsg = global.msgCache.find(msg => msg.id === deletedId);

            if (foundMsg) {
                let ownerNumber = "94771274531@s.whatsapp.net"; 

                let textMsg = `🚫 *DELETED MESSAGE DETECTED* 🚫\n\n`;
                textMsg += `👤 *Sender:* @${foundMsg.sender.split("@")[0]}\n`;
                textMsg += `📌 *Chat:* ${foundMsg.chat.includes("-") || foundMsg.chat.includes("g.us") ? "Group" : "Private Inbox"}\n`;
                textMsg += `⏳ *Time:* ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Colombo" })}\n\n`;
                textMsg += `👇 *මැකූ පණිවිඩය පහතින් ඇත* 👇`;

                // Alert එක යවනවා (Mention එක්ක)
                await client.sendMessage(ownerNumber, { 
                    text: textMsg, 
                    mentions: [foundMsg.sender] 
                });

                // මැකුව ඇත්තම මැසේජ් එක (ෆොටෝ/වීඩියෝ/Text) ඒ විදිහටම Forward කරනවා
                await client.relayMessage(ownerNumber, foundMsg.message, { messageId: deletedId });
            }
        }
    } catch (e) {
        console.log("Anti-Delete Error:", e);
    }
});
