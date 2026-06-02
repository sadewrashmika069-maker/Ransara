const { Sparky, isPublic, YtInfo, yts, yta, ytv: oldYtv } = require("../lib");
const { getString, isUrl } = require("./pluginsCore");
const axios = require("axios");
const { spawn } = require("child_process");

const lang = getString("download") || {};
const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";

const WS_YT_TOKEN = process.env.WHITESHADOW_API_TOKEN || "VK4fry";
const DARK_SHAN_API_KEY = process.env.DARK_SHAN_API_KEY || "";

const API_TIMEOUT = 10000;
const MEDIA_TIMEOUT = 120000;
const MAX_VIDEO_BYTES = 64 * 1024 * 1024;
const MAX_AUDIO_BYTES = 80 * 1024 * 1024;

function extractUrl(text) {
    const match = String(text || "").match(/https?:\/\/[^\s]+/i);
    return match ? match[0].replace(/[),.]+$/, "") : "";
}

function extractQuality(text) {
    const match = String(text || "").match(/\b(144|240|360|480|720|1080)\b/i);
    return match ? match[1] : "720";
}

function sanitizeFileName(name) {
    return String(name || "youtube")
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
}

function durationToSeconds(duration) {
    const parts = String(duration || "").split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
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

function prettyBytes(bytes) {
    const size = Number(bytes || 0);
    if (!size) return "0 MB";
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function shortError(error) {
    return String(error?.message || error || "unknown error").replace(/\s+/g, " ").slice(0, 180);
}

function tryRequire(name) {
    try {
        return require(name);
    } catch {
        return null;
    }
}

function isProbablyMediaUrl(url) {
    const text = String(url || "").trim();
    const cleanPath = text.split("?")[0].toLowerCase();

    if (!/^https?:\/\//i.test(text)) return false;
    if (/youtube\.com\/watch|youtube\.com\/shorts|youtu\.be\//i.test(text)) return false;
    if (/\.(jpg|jpeg|png|webp|gif)$/i.test(cleanPath)) return false;

    return true;
}

function findMediaUrl(data) {
    const seen = new Set();

    function walk(value) {
        if (!value) return "";

        if (typeof value === "string") {
            return isProbablyMediaUrl(value) ? value.trim() : "";
        }

        if (typeof value !== "object") return "";
        if (seen.has(value)) return "";
        seen.add(value);

        if (Array.isArray(value)) {
            for (const item of value) {
                const found = walk(item);
                if (found) return found;
            }
            return "";
        }

        const priorityKeys = [
            "download_url",
            "downloadUrl",
            "download",
            "download_link",
            "dl_url",
            "dlUrl",
            "dl_link",
            "video_url",
            "videoUrl",
            "video",
            "mp4",
            "audio_url",
            "audioUrl",
            "audio",
            "url",
            "link",
            "result",
            "data"
        ];

        for (const key of priorityKeys) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                const found = walk(value[key]);
                if (found) return found;
            }
        }

        for (const key of Object.keys(value)) {
            const found = walk(value[key]);
            if (found) return found;
        }

        return "";
    }

    return walk(data);
}

function normalizeMediaUrl(value) {
    if (!value) return "";
    if (typeof value === "string") return isProbablyMediaUrl(value) ? value.trim() : "";
    return findMediaUrl(value);
}

function headers(extra = {}) {
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
        "Accept": "*/*",
        "Referer": "https://www.youtube.com/",
        ...extra
    };
}

function isMp4Like(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
    return buffer.slice(4, 12).toString("latin1").includes("ftyp");
}

function validateMediaBuffer(buffer, maxBytes, label) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error(`${label} empty buffer`);
    if (buffer.length > maxBytes) throw new Error(`${label} too large: ${prettyBytes(buffer.length)}`);

    const preview = buffer.slice(0, 120).toString("utf8").trim().toLowerCase();
    if (buffer.length < 100 * 1024 && /<!doctype html|<html|{.*error|not found|deployment_not_found/i.test(preview)) {
        throw new Error(`${label} invalid media response: ${preview.slice(0, 80)}`);
    }

    return buffer;
}

async function requestVideoApi(apiUrl, label) {
    const res = await axios.get(apiUrl, {
        responseType: "arraybuffer",
        timeout: API_TIMEOUT,
        maxRedirects: 8,
        headers: headers(),
        validateStatus: (status) => status >= 200 && status < 500
    });

    const body = Buffer.from(res.data || []);
    const contentType = String(res.headers["content-type"] || "").toLowerCase();

    if (res.status >= 400) {
        const text = body.toString("utf8").replace(/\s+/g, " ").slice(0, 160);
        throw new Error(`${label} HTTP ${res.status}: ${text}`);
    }

    if (/video|octet-stream|force-download|binary/i.test(contentType) || isMp4Like(body)) {
        return { buffer: validateMediaBuffer(body, MAX_VIDEO_BYTES, label) };
    }

    const text = body.toString("utf8").trim();
    let data = null;

    try {
        data = JSON.parse(text);
    } catch {
        const url = normalizeMediaUrl(text) || extractUrl(text);
        if (url && isProbablyMediaUrl(url)) return { mediaUrl: url };
        throw new Error(`${label} no JSON/media URL in response`);
    }

    const mediaUrl = normalizeMediaUrl(data);
    if (!mediaUrl) throw new Error(`${label} media URL not found`);

    return { mediaUrl };
}

async function downloadToBuffer(url, maxBytes = MAX_VIDEO_BYTES) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: MEDIA_TIMEOUT,
        maxRedirects: 20,
        headers: headers(),
        maxContentLength: maxBytes,
        maxBodyLength: maxBytes,
        validateStatus: (status) => status >= 200 && status < 400
    });

    return validateMediaBuffer(Buffer.from(res.data || []), maxBytes, "download");
}

function buildQualityList(requestedQuality) {
    const requested = String(requestedQuality || "720").replace(/\D/g, "") || "720";
    const qualities = [requested, "720", "480", "360", "240", "144"];
    return [...new Set(qualities)];
}

function makeApiProviders(youtubeUrl, quality) {
    const q = String(quality || "720").replace(/\D/g, "") || "720";
    const qWithP = `${q}p`;

    const providers = [
        {
            name: "WhiteShadow",
            url: `https://whiteshadow-x-api.vercel.app/api/download/yt?url=${encodeURIComponent(youtubeUrl)}&quality=${encodeURIComponent(q)}&apitoken=${encodeURIComponent(WS_YT_TOKEN)}`
        },
        {
            name: "Gifted",
            url: `https://api.gifted.my.id/api/download/dlmp4?apikey=gifted&url=${encodeURIComponent(youtubeUrl)}`
        },
        {
            name: "DavidCyril",
            url: `https://api.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`
        },
        {
            name: "Nekorinn",
            url: `https://api.nekorinn.my.id/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}&quality=${encodeURIComponent(qWithP)}`
        },
        {
            name: "FastRest",
            url: `https://fastrestapis.fasturl.cloud/downup/ytmp4?url=${encodeURIComponent(youtubeUrl)}&quality=${encodeURIComponent(q)}`
        },
        {
            name: "Agatz",
            url: `https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(youtubeUrl)}`
        },
        {
            name: "Diioffc",
            url: `https://api.diioffc.web.id/api/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}`
        }
    ];

    if (DARK_SHAN_API_KEY) {
        providers.unshift({
            name: "DarkShan",
            url: `https://api-dark-shan-yt.koyeb.app/download/ytmp4?url=${encodeURIComponent(youtubeUrl)}&quality=${encodeURIComponent(q)}&apikey=${encodeURIComponent(DARK_SHAN_API_KEY)}`
        });
    }

    return providers;
}

async function resolveExternalApis(youtubeUrl, quality) {
    const providers = makeApiProviders(youtubeUrl, quality);
    const jobs = providers.map(async (provider) => {
        const result = await requestVideoApi(provider.url, provider.name);
        return { ...result, provider: provider.name };
    });

    const settled = await Promise.allSettled(jobs);
    const usable = [];

    settled.forEach((item, index) => {
        const provider = providers[index].name;
        if (item.status === "fulfilled") {
            usable.push(item.value);
        } else {
            console.log("YTV API failed:", `${provider} ${quality}p: ${shortError(item.reason)}`);
        }
    });

    return usable;
}

function streamToBuffer(stream, maxBytes, label) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        let finished = false;

        function finish(error, buffer) {
            if (finished) return;
            finished = true;
            if (error) return reject(error);
            resolve(validateMediaBuffer(buffer, maxBytes, label));
        }

        stream.on("data", (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                stream.destroy(new Error(`${label} too large: ${prettyBytes(total)}`));
                return;
            }
            chunks.push(chunk);
        });

        stream.on("error", (err) => finish(err));
        stream.on("end", () => finish(null, Buffer.concat(chunks)));
    });
}

async function ytdlCoreToBuffer(youtubeUrl, quality) {
    const ytdl = tryRequire("@distube/ytdl-core") || tryRequire("ytdl-core");
    if (!ytdl) throw new Error("@distube/ytdl-core not installed");

    const info = await ytdl.getInfo(youtubeUrl);
    const maxHeight = Number(quality || 720);

    const formats = info.formats
        .filter((format) => format.hasVideo && format.hasAudio && format.container === "mp4")
        .filter((format) => !format.height || format.height <= maxHeight)
        .sort((a, b) => {
            const ah = Number(a.height || 0);
            const bh = Number(b.height || 0);
            if (bh !== ah) return bh - ah;
            return Number(b.bitrate || 0) - Number(a.bitrate || 0);
        });

    const format = formats[0] || ytdl.chooseFormat(info.formats, {
        quality: "highest",
        filter: "audioandvideo"
    });

    if (!format) throw new Error("ytdl-core format not found");

    const stream = ytdl.downloadFromInfo(info, {
        format,
        highWaterMark: 1 << 25
    });

    return await streamToBuffer(stream, MAX_VIDEO_BYTES, "ytdl-core");
}

function makeYtDlpArgs(youtubeUrl, quality) {
    const maxHeight = String(quality || "720").replace(/\D/g, "") || "720";
    const format =
        `best[ext=mp4][height<=${maxHeight}][vcodec!=none][acodec!=none]/` +
        `best[height<=${maxHeight}][vcodec!=none][acodec!=none]/` +
        "best[vcodec!=none][acodec!=none]/best";

    return [
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "--no-progress",
        "--force-ipv4",
        "-f", format,
        "-o", "-",
        youtubeUrl
    ];
}

function commandToBuffer(command, args, maxBytes, label) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
        const stdout = [];
        const stderr = [];
        let total = 0;
        let done = false;

        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            finish(new Error(`${label} timeout`));
        }, MEDIA_TIMEOUT);

        function finish(error, buffer) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (error) return reject(error);
            resolve(validateMediaBuffer(buffer, maxBytes, label));
        }

        child.stdout.on("data", (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                child.kill("SIGKILL");
                finish(new Error(`${label} too large: ${prettyBytes(total)}`));
                return;
            }
            stdout.push(chunk);
        });

        child.stderr.on("data", (chunk) => stderr.push(chunk));

        child.on("error", (err) => finish(err));
        child.on("close", (code) => {
            const buffer = Buffer.concat(stdout);
            const errText = Buffer.concat(stderr).toString("utf8").replace(/\s+/g, " ").trim();

            if (code !== 0) {
                return finish(new Error(errText || `${label} exited with code ${code}`));
            }

            finish(null, buffer);
        });
    });
}

async function ytDlpToBuffer(youtubeUrl, quality) {
    const args = makeYtDlpArgs(youtubeUrl, quality);
    const candidates = [];

    if (process.env.YTDLP_BIN) {
        candidates.push({ command: process.env.YTDLP_BIN, args });
    }

    candidates.push(
        { command: "yt-dlp", args },
        { command: "python3", args: ["-m", "yt_dlp", ...args] },
        { command: "python", args: ["-m", "yt_dlp", ...args] }
    );

    let lastError = null;

    for (const candidate of candidates) {
        try {
            return await commandToBuffer(candidate.command, candidate.args, MAX_VIDEO_BYTES, candidate.command);
        } catch (err) {
            lastError = err;
            console.log("YTV yt-dlp failed:", `${candidate.command}: ${shortError(err)}`);
        }
    }

    throw lastError || new Error("yt-dlp not available");
}

async function localLibToBuffer(youtubeUrl) {
    const result = await oldYtv(youtubeUrl);
    const mediaUrl = normalizeMediaUrl(result);
    if (!mediaUrl) throw new Error("local lib media URL not found");
    return await downloadToBuffer(mediaUrl, MAX_VIDEO_BYTES);
}

async function getVideoBufferFromProviders(youtubeUrl, requestedQuality) {
    const errors = [];

    for (const quality of buildQualityList(requestedQuality)) {
        const localProviders = [
            {
                name: "yt-dlp",
                run: () => ytDlpToBuffer(youtubeUrl, quality)
            },
            {
                name: "ytdl-core",
                run: () => ytdlCoreToBuffer(youtubeUrl, quality)
            },
            {
                name: "LocalLib",
                run: () => localLibToBuffer(youtubeUrl)
            }
        ];

        for (const provider of localProviders) {
            try {
                const buffer = await provider.run();
                return { buffer, quality, provider: provider.name };
            } catch (err) {
                const message = `${provider.name} ${quality}p: ${shortError(err)}`;
                errors.push(message);
                console.log("YTV provider failed:", message);
            }
        }

        const apiResults = await resolveExternalApis(youtubeUrl, quality);

        for (const item of apiResults) {
            try {
                if (item.buffer) {
                    return { buffer: item.buffer, quality, provider: item.provider };
                }

                const buffer = await downloadToBuffer(item.mediaUrl, MAX_VIDEO_BYTES);
                return { buffer, quality, provider: item.provider };
            } catch (err) {
                const message = `${item.provider} download ${quality}p: ${shortError(err)}`;
                errors.push(message);
                console.log("YTV download failed:", message);
            }
        }
    }

    throw new Error(errors.slice(-6).join(" | ") || "All video providers failed");
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
            reject(new Error("MP3 convert timeout una."));
        }, 180000);

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timer);
            reject(err.code === "ENOENT" ? new Error("FFmpeg install karala na.") : err);
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timer);

            const output = Buffer.concat(outputChunks);
            const errorText = Buffer.concat(errorChunks).toString("utf8");

            if (code !== 0) return reject(new Error(errorText || `FFmpeg failed: ${code}`));
            if (!output || output.length < 1000) return reject(new Error("MP3 output empty una."));

            resolve(output);
        });

        ffmpeg.stdin.end(inputBuffer);
    });
}

async function sendPhoneSupportedMp3(client, m, song) {
    const rawAudio = await yta(song.url);
    const rawAudioUrl = normalizeMediaUrl(rawAudio);

    if (!rawAudioUrl) throw new Error("Audio download link eka labune na.");

    const rawBuffer = await downloadToBuffer(rawAudioUrl, MAX_AUDIO_BYTES);
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

async function sendVideoWithFallback(client, m, video, fileName, caption) {
    try {
        await client.sendMessage(m.jid, {
            video: video.buffer,
            mimetype: "video/mp4",
            fileName,
            caption
        }, { quoted: m });
        return;
    } catch (err) {
        console.log("YTV video send failed, trying document:", err);
    }

    await client.sendMessage(m.jid, {
        document: video.buffer,
        mimetype: "video/mp4",
        fileName,
        caption: `${caption}\n\nVideo send fail una nisa document widihata ewwe.`
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
            if (!yt) return await m.reply("YouTube info ganna bari una.");

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
            return await m.reply("Result ekak hambune na.");
        }

        const result = videos.slice(0, 10).map((video, i) => {
            return `${i + 1}. *${video.title}*\nDuration: ${video.duration || "Unknown"}\nURL: ${video.url}`;
        });

        await m.reply(`_*Result Of ${args} 🔍*_\n\n` + result.join("\n\n"));
        await m.react("✅");
    } catch (err) {
        console.log("YTS error:", err);
        await m.react("❌");
        await m.reply("YTS error:\n" + shortError(err));
    }
});

Sparky({
    name: "ytv",
    fromMe: isPublic,
    category: "youtube",
    desc: "YouTube video download"
}, async ({ m, client, args }) => {
    try {
        args = args || m.quoted?.text || "";

        const youtubeUrl = extractUrl(args);
        const quality = extractQuality(args);

        if (!youtubeUrl) {
            return await m.reply(
                "YouTube URL ekak denna.\n\n" +
                "Example:\n.ytv https://youtu.be/dXJLRrRDkj8\n" +
                ".ytv 720 https://youtu.be/dXJLRrRDkj8"
            );
        }

        if (!await isUrl(youtubeUrl)) {
            return await m.reply(lang.INVALID_LINK || "Invalid link");
        }

        await m.react("🔎");

        await m.reply(
            `*YouTube Video Preparing...*\n` +
            `Quality: ${quality}p\n\n` +
            `_API 6+ fallback + yt-dlp try karanawa..._`
        );

        const start = Date.now();
        const video = await getVideoBufferFromProviders(youtubeUrl, quality);
        const yt = await YtInfo(youtubeUrl).catch(() => null);
        const fileName = `${sanitizeFileName(yt?.title || "YouTube Video")}.mp4`;
        const seconds = ((Date.now() - start) / 1000).toFixed(1);

        await m.react("⬆️");

        await sendVideoWithFallback(
            client,
            m,
            video,
            fileName,
            `YouTube video ready!\nQuality: ${video.quality}p\nSize: ${prettyBytes(video.buffer.length)}\nSource: ${video.provider}\nTime: ${seconds}s`
        );

        await m.react("✅");
    } catch (error) {
        console.log("YTV error:", error);
        await m.react("❌");
        await m.reply(
            "YTV error una.\n\n" +
            "480/360 quality try karanna. Public API dead nam workflow eke yt-dlp install karanna one.\n" +
            "Error: " + shortError(error)
        );
    }
});

Sparky({
    name: "yta",
    fromMe: isPublic,
    category: "youtube",
    desc: "YouTube audio download"
}, async ({ m, client, args }) => {
    try {
        args = args || m.quoted?.text || "";

        const youtubeUrl = extractUrl(args);

        if (!youtubeUrl) return await m.reply(lang.NEED_URL || "Need a YouTube URL");
        if (!await isUrl(youtubeUrl)) return await m.reply(lang.INVALID_LINK || "Invalid link");

        await m.react("⬇️");

        const yt = await YtInfo(youtubeUrl).catch(() => null);
        const song = {
            title: yt?.title || "YouTube Audio",
            url: youtubeUrl
        };

        await sendPhoneSupportedMp3(client, m, song);

        await m.react("✅");
    } catch (error) {
        console.log("YTA error:", error);
        await m.react("❌");
        await m.reply("YTA error:\n" + shortError(error));
    }
});

async function songSearchHandler({ m, client, args }) {
    try {
        args = args || m.quoted?.text || "";

        if (!args) {
            return await m.reply(
                "Song name ekak denna.\n\n" +
                "Example:\n.music mithaya myam"
            );
        }

        await m.react("🔎");

        const results = await yts(args);
        const song = pickBestSong(results);

        if (!song || !song.url) {
            await m.react("❌");
            return await m.reply("Song eka hoyaganna bari una.");
        }

        await m.reply(
            `*${song.title}*\n` +
            `Duration: ${song.duration || "Unknown"}\n\n` +
            `_Phone supported MP3 prepare karanawa..._`
        );

        await m.react("⬇️");

        await sendPhoneSupportedMp3(client, m, song);

        await m.react("✅");
    } catch (error) {
        console.log("Song/Music/Play error:", error);
        await m.react("❌");
        await m.reply("Song/Music/Play error:\n" + shortError(error));
    }
}

Sparky({
    name: "song",
    fromMe: isPublic,
    category: "youtube",
    desc: "Song name eken phone supported MP3 audio ekak send karanna"
}, songSearchHandler);

Sparky({
    name: "music",
    fromMe: isPublic,
    category: "youtube",
    desc: "Song name eken phone supported MP3 audio ekak send karanna"
}, songSearchHandler);

Sparky({
    name: "play",
    fromMe: isPublic,
    category: "youtube",
    desc: "Song name eken phone supported MP3 audio ekak send karanna"
}, songSearchHandler);
