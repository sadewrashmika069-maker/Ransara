// commands/forward.js
const { Sparky, isPublic } = require("../lib");
const fs = require("fs");
const path = require("path");
const { createReadStream } = require("fs");
const axios = require("axios"); // install: npm install axios

Sparky({
    name: "forward",
    category: "tools",
    fromMe: isPublic,
    desc: "📨 Reply කරපු message එක වෙනත් chat එකකට forward කරයි (file up to 2GB)"
}, async ({ client, m, args }) => {
    try {
        // Target JID එක ගන්න (උදා: 947xxxxxxxx@s.whatsapp.net හෝ group ID)
        let target = args[0];
        if (!target) {
            return m.reply(`📌 *Usage:* ${m.prefix}forward <jid/phone>\n\n*Example:*\n${m.prefix}forward 94712345678\n${m.prefix}forward 1234567890-123456@g.us\n\n*Tip:* Reply to the message you want to forward.`);
        }

        // JID format එක හරි ගන්න (phone number නම් @s.whatsapp.net add කරන්න)
        if (!target.includes("@") && !target.includes("g.us")) {
            target = target.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        }

        // Reply කරපු message එකක් තියෙනවද?
        if (!m.quoted) {
            return m.reply("❌ Reply කරපු message එකක් නැහැ. Forward කරන්න ඕනේ message එකට reply කරලා command එක දෙන්න.");
        }

        const quotedMsg = m.quoted;
        const msgType = Object.keys(quotedMsg.message)[0]; // e.g., "conversation", "imageMessage", "documentMessage"

        // Progress indicator (typing)
        await client.sendPresenceUpdate('composing', m.jid);

        // ---------------------------
        // 1. Text message forwarding
        // ---------------------------
        if (msgType === "conversation" || msgType === "extendedTextMessage") {
            let text = quotedMsg.message.conversation || quotedMsg.message.extendedTextMessage?.text;
            await client.sendMessage(target, { text: text });
            return m.reply(`✅ Text message forwarded to ${target}`);
        }

        // ---------------------------
        // 2. Media/Document forwarding (streaming, low RAM)
        // ---------------------------
        let mediaMsg = quotedMsg.message[msgType];
        if (!mediaMsg || !mediaMsg.url) {
            return m.reply("❌ Media URL එක හොයාගන්න බැරි වුණා.");
        }

        // Get media info
        const mediaUrl = mediaMsg.url;
        const mimetype = mediaMsg.mimetype;
        const caption = mediaMsg.caption || "";
        const fileName = mediaMsg.fileName || `file_${Date.now()}`;

        // Notify user
        await m.reply(`⏳ Downloading and forwarding... (File size: ${(mediaMsg.fileLength / (1024*1024)).toFixed(2)} MB)`);

        // Stream download and forward (no RAM overload)
        // Using axios stream with pipe to WhatsApp sendMessage stream
        const response = await axios({
            method: 'GET',
            url: mediaUrl,
            responseType: 'stream',
            timeout: 300000, // 5 minutes for large files
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        // Temporary file path (will be deleted after send)
        const tempPath = path.join(__dirname, "../temp", `${Date.now()}_${fileName}`);
        const writer = fs.createWriteStream(tempPath);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // Send the file as document (or image/video/audio based on mimetype)
        let sendOptions = { caption: caption };
        
        if (mimetype.startsWith("image/")) {
            await client.sendMessage(target, { image: { url: tempPath }, caption: caption }, { quoted: null });
        } else if (mimetype.startsWith("video/")) {
            await client.sendMessage(target, { video: { url: tempPath }, caption: caption }, { quoted: null });
        } else if (mimetype.startsWith("audio/")) {
            await client.sendMessage(target, { audio: { url: tempPath }, mimetype: mimetype, ptt: false }, { quoted: null });
        } else {
            // Document (including large files)
            await client.sendMessage(target, {
                document: { url: tempPath },
                mimetype: mimetype,
                fileName: fileName,
                caption: caption
            }, { quoted: null });
        }

        // Clean up temp file
        fs.unlink(tempPath, (err) => err && console.error("Temp delete error:", err));

        await m.reply(`✅ Message forwarded to ${target}\n📄 File: ${fileName}\n📦 Size: ${(mediaMsg.fileLength / (1024*1024)).toFixed(2)} MB`);

    } catch (error) {
        console.error("Forward error:", error);
        m.reply(`❌ Forward failed: ${error.message.substring(0, 100)}`);
    }
});