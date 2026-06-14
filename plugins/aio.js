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
    desc: "🌐 Download video/audio from TikTok, Instagram, YouTube, Twitter, Facebook, etc."
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
        const response = await axios.get(apiUrl, { timeout: 20000 });
        const data = response.data;

        if (!data || data.Status !== true || data.Code !== 200) {
            throw new Error(data?.Error || "API returned failure");
        }

        const result = data.Result;
        if (!result || result.type !== "multiple" || !result.medias || result.medias.length === 0) {
            throw new Error("No media found in response");
        }

        // Find best video (prefer hd_no_watermark > no_watermark > highest resolution)
        let bestVideo = null;
        let bestAudio = null;

        for (const media of result.medias) {
            if (media.type === "video") {
                if (!bestVideo) bestVideo = media;
                else if (media.quality === "hd_no_watermark" && bestVideo.quality !== "hd_no_watermark") bestVideo = media;
                else if (media.quality === "no_watermark" && bestVideo.quality !== "hd_no_watermark") bestVideo = media;
                else if (media.width * media.height > bestVideo.width * bestVideo.height) bestVideo = media;
            } else if (media.type === "audio") {
                bestAudio = media;
            }
        }

        if (!bestVideo) throw new Error("No video URL found");

        const videoUrl = bestVideo.url;
        const quality = bestVideo.quality || "HD";
        const title = result.title || "Media";
        const author = result.author || result.unique_id || "Unknown";

        await m.reply(`✅ *${title}* by @${author}\n🎚️ *Quality:* ${quality}\n⬇️ Downloading video...`);

        // Download video as arraybuffer
        const videoRes = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 5
        });

        const buffer = Buffer.from(videoRes.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        if (buffer.length < 5000) throw new Error("Video too small");

        const fileName = `${title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.mp4`;
        const caption = `🌐 *${title}*\n👤 *Author:* ${author}\n🎚️ *Quality:* ${quality}\n📦 *Size:* ${fileSizeMB} MB\n\n> *AIO Downloader*`;

        // Send as video (not document) for phone compatibility
        await client.sendMessage(m.jid, {
            video: buffer,
            caption: caption,
            mimetype: "video/mp4"
        }, { quoted: m });

        // Optionally send audio as a separate message
        if (bestAudio && bestAudio.url) {
            const audioRes = await axios.get(bestAudio.url, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioRes.data);
            const audioCaption = `🎵 *Audio: ${title}*`;
            await client.sendMessage(m.jid, {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                ptt: false
            }, { quoted: m });
        }

        await m.react("✅");
        await m.reply(`✅ *Download complete!* (${fileSizeMB} MB)`);

    } catch (error) {
        console.error("AIO error:", error);
        await m.react("❌");
        let errorMsg = `❌ *Download failed*\n\n`;
        if (error.message.includes("Invalid") || error.message.includes("No media")) {
            errorMsg += `Unsupported link or platform.\nSupported: TikTok, Instagram, YouTube, Twitter, Facebook, etc.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
