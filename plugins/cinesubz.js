// commands/cz_dl.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

Sparky({
    name: "cz_dl",
    category: "download",
    fromMe: isPublic,
    desc: "⬇️ Download Cinesubz movie by quality"
}, async ({ client, m, args }) => {
    const input = (args && Array.isArray(args)) ? args.join(" ").trim() : (typeof args === "string" ? args.trim() : "");
    if (!input.includes("||")) {
        return m.reply(`❌ *Invalid format.*\nUse: .cz_dl Movie Title || quality || url`);
    }

    let [title, quality, originalUrl] = input.split(" || ").map(s => s.trim());
    if (!originalUrl) return m.reply("❌ Missing URL");

    // Adjust quality in URL if needed
    let finalUrl = originalUrl;
    if (quality === '480p') {
        finalUrl = originalUrl.replace(/(720p|1080p|1080|720)/i, '480p');
    } else if (quality === '720p') {
        finalUrl = originalUrl.replace(/(480p|1080p|1080|480)/i, '720p');
    }

    await m.react("⬇️");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`⬇️ *Downloading ${title} (${quality})...*\n_This may take a while for large files._`);

    try {
        // Check file size (optional, to avoid >2GB)
        try {
            const headRes = await axios.head(finalUrl, { timeout: 10000 });
            if (headRes.headers['content-length']) {
                const sizeMB = parseInt(headRes.headers['content-length']) / (1024 * 1024);
                if (sizeMB > 1950) { // >1.95GB
                    await m.react("❌");
                    return m.reply(`❌ *File too large!* (${sizeMB.toFixed(2)} MB)\nWhatsApp only supports up to ~2GB for documents.`);
                }
            }
        } catch (headErr) {
            console.log("Size check failed, proceeding anyway.");
        }

        // Download and send as document
        const response = await axios.get(finalUrl, {
            responseType: 'arraybuffer',
            timeout: 120000, // 2 minutes
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const buffer = Buffer.from(response.data);
        const caption = `🎬 *${title}* [${quality}]\n\n> *Powered by SADEW-MINI*`;

        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: "video/mp4",
            fileName: `${title} - ${quality}.mp4`,
            caption: caption
        }, { quoted: m });

        await m.react("✅");

    } catch (error) {
        console.error("Download error:", error);
        await m.react("❌");
        m.reply(`❌ *Download failed.*\n${error.message.substring(0, 100)}`);
    }
});
