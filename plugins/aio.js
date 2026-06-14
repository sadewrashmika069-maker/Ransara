// commands/aio.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

const API_TOKEN = "VK4fry";
const YT_API_BASE = "https://whiteshadow-x-api.onrender.com/api/download/youtube";
const AIO_API_BASE = "https://whiteshadow-x-api.onrender.com/api/download/aio";

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
    desc: "🌍 YouTube, TikTok, Instagram, Facebook, Twitter, etc. වීඩියෝ/ඕඩියෝ බාගන්න"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`🌐 *All-in-One Downloader*

*Usage:* ${m.prefix}aio <link>
*Examples:*
${m.prefix}aio https://youtu.be/xxxxx
${m.prefix}aio https://www.tiktok.com/@user/video/123
${m.prefix}aio https://www.instagram.com/p/xxxxx`);
    }
    if (!url.startsWith("http")) url = "https://" + url;

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔍 *Processing:* ${url}`);

    try {
        // ---------- YOUTUBE (via dedicated API) ----------
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            // Determine quality: 720p for short (<5 min), 480p for longer
            // We'll first try 720p, if fails fallback to 480p, then 360p
            let qualities = ["720p", "480p", "360p"];
            let success = false;
            let lastError = null;

            for (let quality of qualities) {
                try {
                    const ytApiUrl = `${YT_API_BASE}?url=${encodeURIComponent(url)}&format=mp4&quality=${quality}&apitoken=${API_TOKEN}`;
                    const response = await axios.get(ytApiUrl, { timeout: 20000 });
                    const data = response.data;

                    if (data && data.success === true && data.result && data.result.download_url) {
                        const title = data.result.title || "YouTube Video";
                        const author = data.result.author || "Unknown";
                        const duration = data.result.duration || 0;
                        const selectedQuality = data.result.selected_quality || quality;
                        const downloadUrl = data.result.download_url;

                        await m.reply(`📹 *${title}* (${selectedQuality} | ${Math.round(duration/60)} min)\n⬇️ Downloading...`);

                        // Download video buffer
                        const videoRes = await axios.get(downloadUrl, {
                            responseType: 'arraybuffer',
                            timeout: 90000,
                            headers: { 'User-Agent': 'Mozilla/5.0' },
                            maxRedirects: 5
                        });
                        const buffer = Buffer.from(videoRes.data);
                        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
                        const caption = `🎬 *YouTube*\n📹 *${title}*\n👤 *${author}*\n🎚️ *Quality:* ${selectedQuality}\n📦 *Size:* ${fileSizeMB} MB\n\n> *Downloaded via WhiteShadow API*`;

                        await client.sendMessage(m.jid, {
                            video: buffer,
                            caption: caption,
                            mimetype: "video/mp4"
                        }, { quoted: m });

                        await m.react("✅");
                        await m.reply(`✅ *Download complete!* (${fileSizeMB} MB)`);
                        success = true;
                        break;
                    } else {
                        throw new Error(data?.error || "No download URL");
                    }
                } catch (err) {
                    console.error(`YouTube ${quality} failed:`, err.message);
                    lastError = err;
                    // continue to next quality
                }
            }
            if (!success) throw new Error(`YouTube download failed: ${lastError?.message || "All qualities failed"}`);
            return;
        }

        // ---------- OTHER PLATFORMS (TikTok, Instagram, FB, Twitter, etc.) ----------
        const aioApiUrl = `${AIO_API_BASE}?url=${encodeURIComponent(url)}&apitoken=${API_TOKEN}`;
        const response = await axios.get(aioApiUrl, { timeout: 20000 });
        const data = response.data;

        if (!data || data.Status !== true || data.Code !== 200) {
            throw new Error(data?.Error || "Unsupported platform or invalid link");
        }

        const result = data.Result;
        if (!result || result.type !== "multiple" || !result.medias || result.medias.length === 0) {
            throw new Error("No media found");
        }

        // Select best video (no watermark, highest quality)
        let bestVideo = null;
        let bestAudio = null;
        for (const media of result.medias) {
            if (media.type === "video") {
                if (!bestVideo) bestVideo = media;
                else if (media.quality === "hd_no_watermark") bestVideo = media;
                else if (media.quality === "no_watermark" && bestVideo.quality !== "hd_no_watermark") bestVideo = media;
                else if (media.width * media.height > bestVideo.width * bestVideo.height) bestVideo = media;
            } else if (media.type === "audio") {
                bestAudio = media;
            }
        }
        if (!bestVideo) throw new Error("No video URL");

        const videoUrl = bestVideo.url;
        const quality = bestVideo.quality || "HD";
        const title = result.title || "Media";
        const author = result.author || result.unique_id || "Unknown";

        await m.reply(`✅ *${title}* by @${author}\n🎚️ *Quality:* ${quality}\n⬇️ Downloading video...`);

        const videoRes = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 5
        });
        const buffer = Buffer.from(videoRes.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        const caption = `🌐 *${title}*\n👤 *Author:* ${author}\n🎚️ *Quality:* ${quality}\n📦 *Size:* ${fileSizeMB} MB\n\n> *AIO Downloader*`;

        await client.sendMessage(m.jid, {
            video: buffer,
            caption: caption,
            mimetype: "video/mp4"
        }, { quoted: m });

        // Send audio if available (e.g., TikTok original sound)
        if (bestAudio && bestAudio.url) {
            const audioRes = await axios.get(bestAudio.url, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(audioRes.data);
            await client.sendMessage(m.jid, {
                audio: audioBuffer,
                mimetype: "audio/mpeg",
                ptt: false
            }, { quoted: m });
        }

        await m.react("✅");
        await m.reply(`✅ *Download complete!*`);

    } catch (error) {
        console.error("AIO error:", error);
        await m.react("❌");
        let errorMsg = `❌ *Download failed*\n\n`;
        if (error.message.includes("YouTube")) {
            errorMsg += `${error.message}\nTry another video or use a different source.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
