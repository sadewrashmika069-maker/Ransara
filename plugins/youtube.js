const { Sparky, isPublic, YtInfo, yts, yta, ytv: oldYtv } = require("../lib");
const { getString, isUrl } = require("./pluginsCore");
const axios = require("axios");
const { spawn } = require("child_process");

const lang = getString("download");
const ffmpegBin = "ffmpeg";

const WS_YT_TOKEN = process.env.WHITESHADOW_API_TOKEN || "VK4fry";
const DARK_SHAN_API_KEY = "https://api-dark-shan-yt.koyeb.app/download/ytmp4";

function extractUrl(text) {
    const match = String(text || "").match(/https?:\/\/[^\s]+/i);
    return match ? match[0] : "";
}

function extractQuality(text) {
    const match = String(text || "").match(/\b(144|240|360|480|720|1080)\b/i);
    return match ? match[1] : "720";
}

function sanitizeFileName(name) {
    return String(name || "music")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
}

function durationToSeconds(duration) {
    const parts = String(duration || "").split(":").map(Number);
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

function pickBestSong(results) {
    if (!Array.isArray(results) || !results.length) return null;

    return results.find((item) => {
        const seconds = durationToSeconds(item.duration);
        return seconds > 0 && seconds <= 15 * 60;
    }) || results[0];
}

function isMediaUrl(url) {
    const text = String(url || "").trim();

    return (
        /^https?:\/\//i.test(text) &&
        !text.includes("youtube.com/watch") &&
        !text.includes("youtu.be/") &&
        !/\.(jpg|jpeg|png|webp|gif)$/i.test(text.split("?")[0])
    );
}

function findMediaUrl(data) {
    const seen = new Set();

    function walk(value) {
        if (!value) return "";
        if (typeof value === "object") {
            if (seen.has(value)) return "";
            seen.add(value);
        }

        if (typeof value === "string") {
            return isMediaUrl(value) ? value.trim() : "";
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                const found = walk(item);
                if (found) return found;
            }
            return "";
        }

        if (typeof value === "object") {
            const priorityKeys = [
                "download_url", "downloadUrl", "download",
                "video_url", "videoUrl", "video",
                "audio_url", "audioUrl", "audio",
                "url", "link", "dl_link", "result", "data"
            ];

            for (const key of priorityKeys) {
                if (key in value) {
                    const found = walk(value[key]);
                    if (found) return found;
                }
            }

            for (const key of Object.keys(value)) {
                const found = walk(value[key]);
                if (found) return found;
            }
        }

        return "";
    }

    return walk(data);
}

async function requestJson(apiUrl, label) {
    const res = await axios.get(apiUrl, {
        timeout: 9000,
        maxRedirects: 5,
        headers: { "User-Agent": "Mozilla/5.0" },
        validateStatus: (status) => status >= 200 && status < 500
    });

    if (res.status >= 400) throw new Error(`${label} HTTP ${res.status}`);

    const mediaUrl = findMediaUrl(res.data);
    if (!mediaUrl) throw new Error(`${label} media URL not found`);

    return mediaUrl;
}

async function ytvDarkShan(youtubeUrl, quality) {
    const apiUrl =
        `https://api-dark-shan-yt.koyeb.app/download/ytmp4` +
        `?url=${encodeURIComponent(youtubeUrl)}` +
        `&quality=${encodeURIComponent(quality)}` +
        `&apikey=${encodeURIComponent(DARK_SHAN_API_KEY)}`;

    return await requestJson(apiUrl, "DarkShan");
}

async function ytvWhiteShadow(youtubeUrl, quality) {
    const apiUrl =
        `https://whiteshadow-x-api.vercel.app/api/download/yt` +
        `?url=${encodeURIComponent(youtubeUrl)}` +
        `&quality=${encodeURIComponent(quality)}` +
        `&apitoken=${encodeURIComponent(WS_YT_TOKEN)}`;

    return await requestJson(apiUrl, "WhiteShadow");
}

async function getFastYtvUrl(youtubeUrl, quality) {
    const providers = [
        () => ytvDarkShan(youtubeUrl, quality),
        () => ytvWhiteShadow(youtubeUrl, quality),
        () => oldYtv(youtubeUrl)
    ];

    try {
        return await Promise.any(providers.map((fn) => fn()));
    } catch {
        let lastError = null;

        for (const fn of providers) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
            }
        }

        throw lastError || new Error("All YTV APIs failed");
    }
}

async function downloadToBuffer(url) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxRedirects: 5,
        headers: { "User-Agent": "Mozilla/5.0" },
        maxContentLength: 80 * 1024 * 1024,
        maxBodyLength: 80 * 1024 * 1024
    });

    return Buffer.from(res.data);
}

function convertToPhoneMp3(inputBuffer) {
    return new Promise((resolve, reject) => {
        const args = [
            "-hide_banner",
            "-loglevel", "error",
            "-i", "pipe:0",
            "-vn",
            "-map_metadata", "-1",
            "-ac", "2",
            "-ar", "44100",
            "-c:a", "libmp3lame",
            "-b:a", "128k",
            "-id3v2_version", "3",
            "-f", "mp3",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBin, args, {
            stdio: ["pipe", "pipe", "pipe"]
        });

        const outputChunks = [];
        const errorChunks = [];

        const timer = setTimeout(() => {
            ffmpeg.kill("SIGKILL");
            reject(new Error("MP3 convert timeout වුණා."));
        }, 180000);

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timer);
            reject(err.code === "ENOENT" ? new Error("FFmpeg install කරලා නෑ.") : err);
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timer);

            const output = Buffer.concat(outputChunks);
            const errorText = Buffer.concat(errorChunks).toString("utf8");

            if (code !== 0) return reject(new Error(errorText || `FFmpeg failed: ${code}`));
            if (!output || output.length < 1000) return reject(new Error("MP3 output empty වුණා."));

            resolve(output);
        });

        ffmpeg.stdin.end(inputBuffer);
    });
}

async function sendPhoneSupportedMp3(client, m, song) {
    const rawAudioUrl = await yta(song.url);
    if (!rawAudioUrl) throw new Error("Audio download link එක ලැබුණේ නෑ.");

    const rawBuffer = await downloadToBuffer(rawAudioUrl);
    if (!rawBuffer || rawBuffer.length < 1000) throw new Error("Audio download failed.");

    const mp3Buffer = await convertToPhoneMp3(rawBuffer);
    const fileName = `${sanitizeFileName(song.title)}.mp3`;

    await client.sendMessage(m.jid, {
        audio: mp3Buffer,
        mimetype: "audio/mpeg",
        fileName,
        ptt: false
    }, { quoted: m });
}

Sparky({
    name: "yts",
    fromMe: isPublic,
    category: "youtube",
    desc: "Search in YouTube"
}, async ({ m, client, args }) => {
    try {
        if (!args) return await m.reply(lang.NEED_Q || "Need a Query");

        if (await isUrl(args)) {
            const yt = await YtInfo(args);
            if (!yt) return await m.reply("❌ YouTube info ගන්න බැරි වුණා.");

            return await client.sendMessage(m.jid, {
                image: { url: yt.thumbnail },
                caption:
                    `*Title:* ${yt.title}\n` +
                    `*Author:* ${yt.author}\n` +
                    `*URL:* ${args}\n` +
                    `*Video ID:* ${yt.videoId}`
            }, { quoted: m });
        }

        await m.react("🔎");

        const videos = await yts(args);

        if (!videos || !videos.length) {
            await m.react("❌");
            return await m.reply("❌ Result එකක් හමු වුණේ නෑ.");
        }

        const result = videos.slice(0, 10).map((video, i) => {
            return `${i + 1}. *${video.title}*\n⏱️ ${video.duration || "Unknown"}\n🔗 ${video.url}`;
        });

        await m.reply(`_*Result Of ${args} 🔍*_\n\n` + result.join("\n\n"));
        await m.react("✅");
    } catch (err) {
        console.log("YTS error:", err);
        await m.react("❌");
        await m.reply("❌ YTS error:\n" + err.message);
    }
});

Sparky({
    name: "ytv",
    fromMe: isPublic,
    category: "youtube",
    desc: "YouTube video download"
}, async ({ m, client, args }) => {
    try {
        args = args || m.quoted?.text;

        const youtubeUrl = extractUrl(args);
        const quality = extractQuality(args);

        if (!youtubeUrl) {
            return await m.reply(
                "🎬 YouTube URL එකක් දෙන්න.\n\n" +
                "උදා:\n.ytv https://youtu.be/dXJLRrRDkj8\n" +
                ".ytv 720 https://youtu.be/dXJLRrRDkj8"
            );
        }

        if (!await isUrl(youtubeUrl)) {
            return await m.reply(lang.INVALID_LINK || "Invalid link");
        }

        await m.react("🔎");

        await m.reply(
            `🎬 *YouTube Video Preparing...*\n` +
            `📺 Quality: ${quality}p\n\n` +
            `_Fast API එකෙන් link එක fetch කරනවා..._`
        );

        const start = Date.now();
        const videoUrl = await getFastYtvUrl(youtubeUrl, quality);

        if (!videoUrl) {
            await m.react("❌");
            return await m.reply("❌ Video download link එක ගන්න බැරි වුණා.");
        }

        await m.react("⬆️");

        await m.sendMsg(
            m.jid,
            videoUrl,
            {
                quoted: m,
                caption: `✅ YouTube video ready!\n📺 Quality: ${quality}p\n⏱️ API: ${((Date.now() - start) / 1000).toFixed(1)}s`
            },
            "video"
        );

        await m.react("✅");
    } catch (error) {
        console.log("YTV error:", error);
        await m.react("❌");
        await m.reply("❌ YTV error:\n" + error.message);
    }
});

Sparky({
    name: "yta",
    fromMe: isPublic,
    category: "youtube",
    desc: "YouTube audio download"
}, async ({ m, client, args }) => {
    try {
        args = args || m.quoted?.text;

        const youtubeUrl = extractUrl(args);

        if (!youtubeUrl) return await m.reply(lang.NEED_URL || "Need a YouTube URL");
        if (!await isUrl(youtubeUrl)) return await m.reply(lang.INVALID_LINK || "Invalid link");

        await m.react("⬇️");

        const yt = await YtInfo(youtubeUrl);
        const song = {
            title: yt?.title || "YouTube Audio",
            url: youtubeUrl
        };

        await sendPhoneSupportedMp3(client, m, song);

        await m.react("✅");
    } catch (error) {
        console.log("YTA error:", error);
        await m.react("❌");
        await m.reply("❌ YTA error:\n" + error.message);
    }
});

async function songSearchHandler({ m, client, args }) {
    try {
        args = args || m.quoted?.text;

        if (!args) {
            return await m.reply(
                "🎵 Song name එකක් දෙන්න.\n\n" +
                "උදා:\n.music mithaya myam"
            );
        }

        await m.react("🔎");

        const results = await yts(args);
        const song = pickBestSong(results);

        if (!song || !song.url) {
            await m.react("❌");
            return await m.reply("❌ Song එක හොයාගන්න බැරි වුණා.");
        }

        await m.reply(
            `🎧 *${song.title}*\n` +
            `⏱️ ${song.duration || "Unknown"}\n\n` +
            `_Preparing phone supported MP3..._`
        );

        await m.react("⬇️");

        await sendPhoneSupportedMp3(client, m, song);

        await m.react("✅");
    } catch (error) {
        console.log("Song/Music/Play error:", error);
        await m.react("❌");
        await m.reply("❌ Song/Music/Play error:\n" + error.message);
    }
}

Sparky({
    name: "song",
    fromMe: isPublic,
    category: "youtube",
    desc: "Song name එකෙන් phone supported MP3 audio එකක් send කරන්න"
}, songSearchHandler);

Sparky({
    name: "music",
    fromMe: isPublic,
    category: "youtube",
    desc: "Song name එකෙන් phone supported MP3 audio එකක් send කරන්න"
}, songSearchHandler);

Sparky({
    name: "play",
    fromMe: isPublic,
    category: "youtube",
    desc: "Song name එකෙන් phone supported MP3 audio එකක් send කරන්න"
}, songSearchHandler);
