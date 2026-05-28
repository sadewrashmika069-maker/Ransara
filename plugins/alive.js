// commands/alive.js
const { Sparky, isPublic } = require("../lib");
const os = require("os");
const config = require("../config");

// Runtime formatter
function runtime(seconds) {
    seconds = Number(seconds);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);
    return parts.join(" ") || "0s";
}

Sparky({
    name: "alive",
    alias: ["status", "online", "a"],
    category: "main",
    fromMe: isPublic,
    desc: "බොට් එක ජීවතුන් අතරදැයි පරීක්ෂා කරන්න"
}, async ({ client, m, args }) => {
    try {
        const botName = config.BOT_INFO?.split(";")[0] || "SADEW-MINI";
        const ownerName = config.BOT_INFO?.split(";")[1] || "Sadew";
        const prefix = m.prefix || ".";

        const status = `
╭───────────────◉
│ *🤖 ${botName} STATUS*
├───────────────◉
│✨ Bot is Active & Online!
│🧠 Owner: ${ownerName}
│⚡ Version: ${config.VERSION || "1.0.0"}
│📝 Prefix: [${prefix}]
│📳 Mode: [${config.WORK_TYPE || "public"}]
│💾 RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / ${(os.totalmem() / 1024 / 1024).toFixed(2)}MB
│🖥️ Host: ${os.hostname()}
│⌛ Uptime: ${runtime(process.uptime())}
╰────────────────◉
> ${botName} WhatsApp Bot

*Reply with:*
1️⃣ Ping
2️⃣ Menu
`;

        // Send image with caption (no video/audio)
        await client.sendMessage(m.jid, {
            image: { url: config.ALIVE_IMG || "https://i.imgur.com/Q2UNwXR.jpg" },
            caption: status,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 1000,
                isForwarded: true
            }
        }, { quoted: m });

        // Wait for user reply (1 or 2) for 30 seconds
        const filter = (msg) => {
            if (!msg.message) return false;
            if (msg.key.remoteJid !== m.jid) return false;
            if (msg.key.fromMe) return false;
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
            return ["1", "2"].includes(text.trim());
        };

        const replyMsg = await new Promise((resolve) => {
            const handler = (chatUpdate) => {
                const msg = chatUpdate.messages[0];
                if (filter(msg)) {
                    client.ev.off('messages.upsert', handler);
                    resolve(msg);
                }
            };
            client.ev.on('messages.upsert', handler);
            setTimeout(() => {
                client.ev.off('messages.upsert', handler);
                resolve(null);
            }, 30000);
        });

        if (!replyMsg) return;

        const replyText = (replyMsg.message.conversation || replyMsg.message.extendedTextMessage?.text).trim();

        if (replyText === "1") {
            await client.sendMessage(m.jid, { text: "🏓 Pong! Bot is alive." }, { quoted: m });
        } else if (replyText === "2") {
            // Trigger the menu command
            const fakeMsg = { ...replyMsg, message: { conversation: `${prefix}menu` } };
            client.ev.emit("messages.upsert", { messages: [fakeMsg], type: "notify" });
        }

    } catch (err) {
        console.error("❌ Alive cmd error:", err);
        m.reply("❌ Alive command එකේ දෝෂයක්: " + err.message);
    }
});
