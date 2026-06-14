// commands/aio.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

const API_TOKEN = "VK4fry";
const API_BASE = "https://whiteshadow-x-api.onrender.com/api/download/aio";

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

Sparky({
    name: "aio",
    alias: ["alldl", "multidownload"],
    category: "download",
    fromMe: isPublic,
    desc: "🌐 Download media from TikTok, Instagram, YouTube, Twitter, Facebook, etc."
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`🌐 *All-in-One Downloader*

*Usage:* ${m.prefix}aio <link>
*Example:* ${m.prefix}aio https://www.tiktok.com/@user/video/123456789`);
    }

    if (!url.startsWith("http")) url = "https://" + url;

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔍 *Processing:* ${url}`);

    try {
        const apiUrl = `${API_BASE}?url=${encodeURIComponent(url)}&apitoken=${API_TOKEN}`;
        console.log(`[AIO] Requesting: ${apiUrl}`);
        const response = await axios.get(apiUrl, { timeout: 20000 });

        console.log(`[AIO] Full API response:`, JSON.stringify(response.data, null, 2));

        // Check if response indicates error
        if (!response.data || response.data.Status === false) {
            throw new Error(response.data?.Error || "API returned failure status");
        }

        const result = response.data.Result;
        if (!result) {
            throw new Error("Result object is missing");
        }

        // Try to find download URL (different possible field names)
        let downloadUrl = result.download_url || result.url || result.link || result.downloadLink || result.video_url;
        let title = result.title || result.filename || "Media";
        let quality = result.quality || result.resolution || "HD";
        let type = result.type || (downloadUrl?.match(/\.(mp4|mkv)/i) ? "video" : "image");

        if (!downloadUrl) {
            // If there's a list of videos, pick the highest quality
            if (result.videos && result.videos.length > 0) {
                const best = result.videos.reduce((a, b) => (a.resolution > b.resolution ? a : b));
                downloadUrl = best.url || best.link;
                quality = best.resolution || "HD";
            } else if (result.medias && result.medias.length > 0) {
                const best = result.medias[result.medias.length - 1];
                downloadUrl = best.url || best.link;
                quality = best.quality || "HD";
            }
        }

        if (!downloadUrl) {
            throw new Error("No download URL found in response. Full response logged.");
        }

        await m.reply(`✅ *${title}* (${quality})\n⬇️ Downloading file...`);

        const fileRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 90000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 5
        });

        const buffer = Buffer.from(fileRes.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        if (buffer.length < 5000) throw new Error("File too small");

        let ext = ".mp4";
        let mimetype = "video/mp4";
        if (downloadUrl.match(/\.(jpg|jpeg|png|gif)/i)) {
            ext = ".jpg";
            mimetype = "image/jpeg";
        } else if (downloadUrl.match(/\.(mp3|m4a|wav)/i)) {
            ext = ".mp3";
            mimetype = "audio/mpeg";
        }
        const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}${ext}`;
        const caption = `🌐 *${title}*\n🎚️ *Quality:* ${quality}\n📦 *Size:* ${fileSizeMB} MB\n\n> *AIO Downloader*`;

        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: mimetype,
            fileName: fileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        await m.reply(`✅ *Download complete!*`);

    } catch (error) {
        console.error("AIO error:", error);
        await m.react("❌");
        let errorMsg = `❌ *Download failed*\n\n`;
        if (error.message.includes("Invalid")) {
            errorMsg += `The link is invalid or platform not supported.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
