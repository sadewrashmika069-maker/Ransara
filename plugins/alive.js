// commands/alive.js
const { Sparky, isPublic } = require("../lib");
const os = require("os");
const config = require("../config");
const axios = require("axios");

// Helper: runtime formatter (copy from your lib/functions if needed)
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
    desc: "Check bot is alive or not"
}, async ({ client, m, args }) => {
    try {
        // Fake contact card for quoting
        const number = "94704896880";
        const jid = number + "@s.whatsapp.net";

        let thumb = Buffer.from([]);
        try {
            const ppUrl = await client.profilePictureUrl(jid, "image");
            const ppResp = await axios.get(ppUrl, { responseType: "arraybuffer" });
            thumb = Buffer.from(ppResp.data, "binary");
        } catch (err) {
            console.log("❗ Couldn't fetch profile picture:", err.message);
        }

        const contactCard = {
            key: {
                fromMe: false,
                participant: '0@s.whatsapp.net',
                remoteJid: "status@broadcast"
            },
            message: {
                contactMessage: {
                    displayName: "SADEW-MINI ✨",
                    vcard: `BEGIN:VCARD
VERSION:3.0
FN:SADEW-MINI ✨
ORG:SADEW
TEL;type=CELL;type=VOICE;waid=${number}:+94 70 489 6880
END:VCARD`,
                    jpegThumbnail: thumb
                }
            }
        };

        const status = `
╭───────────────◉
│ *🤖 ${config.BOT_INFO?.split(";")[0] || "SADEW-MINI"} STATUS*
├───────────────◉
│✨ Bot is Active & Online!
│🧠 Owner: ${config.BOT_INFO?.split(";")[1] || "Sadew"}
│⚡ Version: ${config.VERSION || "1.0.0"}
│📝 Prefix: [${m.prefix || "."}]
│📳 Mode: [${config.WORK_TYPE || "public"}]
│💾 RAM: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / ${(os.totalmem() / 1024 / 1024).toFixed(2)}MB
│🖥️ Host: ${os.hostname()}
│⌛ Uptime: ${runtime(process.uptime())}
╰────────────────◉
> SADEW-MINI WhatsApp Bot

*Reply with:*
1️⃣ Ping
2️⃣ Menu
`;

        // 1. Send video note (ptv)
        await client.sendMessage(m.jid, {
            video: { url: "https://files.catbox.moe/hlhmjs.mp4" },
            mimetype: 'video/mp4',
            ptv: true
        }, { quoted: contactCard });

        // 2. Send image with status caption
        await client.sendMessage(m.jid, {
            image: { url: config.ALIVE_IMG || "https://i.imgur.com/Q2UNwXR.jpg" },
            caption: status,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 1000,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363397446799567@newsletter',
                    newsletterName: 'SADEW-MINI 💫',
                    serverMessageId: 143
                }
            }
        }, { quoted: contactCard });

        // 3. Send audio
        await client.sendMessage(m.jid, {
            audio: { url: "https://files.catbox.moe/6figid.mp3" },
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: contactCard });

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
            // Trigger the menu command manually
            const fakeMsg = { ...replyMsg, message: { conversation: `${m.prefix}menu` } };
            client.ev.emit("messages.upsert", { messages: [fakeMsg], type: "notify" });
        }

    } catch (err) {
        console.error("❌ Alive cmd error:", err);
        m.reply("❌ Error in alive command: " + err.message);
    }
});
