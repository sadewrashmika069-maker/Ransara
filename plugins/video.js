const axios = require("axios");
const { Sparky } = require("../lib");

const API_BASE_URL = "https://whiteshadow-x-api.onrender.com/api";
const API_TOKEN =
  process.env.WHITESHADOW_API_TOKEN ||
  process.env.YOUTUBE_API_TOKEN ||
  process.env.YT_API_TOKEN ||
  "VK4fry";
const VIDEO_QUALITY = process.env.YT_VIDEO_QUALITY || "1080";
const MAX_VIDEO_MB = Number(process.env.MAX_VIDEO_MB || 120);
const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;

const AXIOS_JSON_CONFIG = {
  timeout: 60000,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
  },
};

function getJid(m) {
  return m.jid || m.chat || m.from || m.key?.remoteJid;
}

function getInputText(args, m) {
  let text = "";

  if (Array.isArray(args)) text = args.join(" ");
  else if (typeof args === "string") text = args;
  else if (m?.quoted?.text) text = m.quoted.text;
  else if (m?.text) text = m.text.replace(/^[./!#]video\s*/i, "");

  return text.replace(/^link\s*=\s*/i, "").trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function isYouTubeUrl(value) {
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(
    String(value || "").trim()
  );
}

function extractYouTubeUrl(text) {
  const match = String(text || "").match(
    /(https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s]+)/i
  );

  if (match?.[1]) return match[1].trim();
  return isYouTubeUrl(text) ? String(text).trim() : "";
}

function isImageUrl(value) {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(String(value || ""));
}

function getStringByKeys(node, keys) {
  if (!node || typeof node !== "object") return "";

  for (const key of Object.keys(node)) {
    if (
      keys.some((wanted) => wanted.toLowerCase() === key.toLowerCase()) &&
      typeof node[key] === "string" &&
      node[key].trim()
    ) {
      return node[key].trim();
    }
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") {
      const found = getStringByKeys(value, keys);
      if (found) return found;
    }
  }

  return "";
}

function findFirstYouTubeResult(node) {
  if (!node) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstYouTubeResult(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof node !== "object") return null;

  const rawUrl =
    node.url ||
    node.link ||
    node.videoUrl ||
    node.video_url ||
    node.webpage_url ||
    node.href;
  const url = rawUrl ? extractYouTubeUrl(rawUrl) : "";
  const rawId = node.videoId || node.video_id || node.id;
  const id = typeof rawId === "string" ? rawId.trim() : "";

  if (url || /^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return {
      url: url || `https://youtu.be/${id}`,
      title:
        node.title ||
        node.name ||
        node.videoTitle ||
        node.video_title ||
        "YouTube Video",
      duration: node.duration || node.timestamp || node.length || "",
      channel:
        node.channel ||
        node.author ||
        node.uploader ||
        node.ownerChannelName ||
        "",
    };
  }

  for (const value of Object.values(node)) {
    const found = findFirstYouTubeResult(value);
    if (found) return found;
  }

  return null;
}

function collectUrls(node, path = [], urls = []) {
  if (!node) return urls;

  if (typeof node === "string") {
    const trimmed = node.trim();
    if (isHttpUrl(trimmed)) urls.push({ url: trimmed, path: path.join(".") });
    return urls;
  }

  if (Array.isArray(node)) {
    node.forEach((value, index) => collectUrls(value, [...path, index], urls));
    return urls;
  }

  if (typeof node === "object") {
    Object.entries(node).forEach(([key, value]) =>
      collectUrls(value, [...path, key], urls)
    );
  }

  return urls;
}

function pickDirectVideoUrl(data) {
  const urls = collectUrls(data)
    .map((item) => {
      const path = item.path.toLowerCase();
      const url = item.url;
      let score = 0;

      if (/download|dl|direct/.test(path)) score += 8;
      if (/mp4|video|media|file|url|link/.test(path)) score += 5;
      if (/\.mp4(\?|$)|videoplayback|googlevideo|ytmp4|download/i.test(url))
        score += 8;
      if (isYouTubeUrl(url)) score -= 20;
      if (/thumbnail|thumb|image|cover|avatar/.test(path) || isImageUrl(url))
        score -= 20;

      return { ...item, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return urls[0]?.url || "";
}

function safeFileName(title) {
  return (
    String(title || "youtube-video")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "youtube-video"
  );
}

async function sendText(m, client, text) {
  const jid = getJid(m);

  if (typeof m.reply === "function") return m.reply(text);
  if (typeof m.sendMsg === "function") return m.sendMsg(jid, text, { quoted: m });
  if (typeof client?.sendMessage === "function") {
    return client.sendMessage(jid, { text }, { quoted: m });
  }

  throw new Error("Message send method not found");
}

async function sendVideo(m, client, buffer, caption, fileName) {
  const jid = getJid(m);
  const payload = {
    video: buffer,
    mimetype: "video/mp4",
    caption,
    fileName,
  };

  if (typeof client?.sendMessage === "function") {
    return client.sendMessage(jid, payload, { quoted: m });
  }
  if (typeof m.sendMsg === "function") {
    return m.sendMsg(jid, payload, { quoted: m });
  }

  throw new Error("Video send method not found");
}

async function searchYouTube(query) {
  const { data } = await axios.get(`${API_BASE_URL}/search/yt`, {
    ...AXIOS_JSON_CONFIG,
    params: {
      q: query,
      apitoken: API_TOKEN,
    },
  });

  const result = findFirstYouTubeResult(data);
  if (!result?.url) throw new Error("YouTube search result not found");

  return result;
}

async function getDownloadInfo(url) {
  const { data } = await axios.get(`${API_BASE_URL}/download/ytmp4`, {
    ...AXIOS_JSON_CONFIG,
    params: {
      url,
      quality: VIDEO_QUALITY,
      apitoken: API_TOKEN,
    },
  });

  const directUrl = pickDirectVideoUrl(data);
  if (!directUrl) throw new Error("Download link not found from API");

  return {
    directUrl,
    title: getStringByKeys(data, ["title", "name", "videoTitle"]) || "",
  };
}

async function downloadVideoBuffer(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 180000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      Accept: "video/mp4,video/*,*/*",
    },
  });

  return Buffer.from(response.data);
}

Sparky(
  {
    name: "video",
    fromMe: false,
    category: "downloader",
    desc: "Download YouTube video in 1080p. Use .video <link or search text>",
  },
  async ({ m, client, args }) => {
    const input = getInputText(args, m);

    if (!input) {
      return sendText(
        m,
        client,
        "📹 Use karanna: .video <YouTube link / search text>\n\nExample:\n.video kudda\n.video link=https://youtu.be/dQw4w9WgXcQ"
      );
    }

    try {
      await m.react?.("🔎");

      let videoUrl = extractYouTubeUrl(input);
      let title = "YouTube Video";
      let channel = "";
      let duration = "";

      if (!videoUrl) {
        await sendText(m, client, `🔍 Search karanawa: ${input}`);
        const result = await searchYouTube(input);
        videoUrl = result.url;
        title = result.title || title;
        channel = result.channel || "";
        duration = result.duration || "";
      }

      await sendText(m, client, `⬇️ 1080p video eka download karanawa...\n${title}`);

      const downloadInfo = await getDownloadInfo(videoUrl);
      if (downloadInfo.title) title = downloadInfo.title;

      const buffer = await downloadVideoBuffer(downloadInfo.directUrl);
      if (!buffer.length) throw new Error("Downloaded video buffer is empty");

      if (buffer.length > MAX_VIDEO_BYTES) {
        await m.react?.("⚠️");
        return sendText(
          m,
          client,
          `⚠️ Video eka loku wadi (${Math.round(
            buffer.length / 1024 / 1024
          )}MB). WhatsApp/GitHub Actions limit eka pass wenna puluwan.\n\nDirect link:\n${downloadInfo.directUrl}`
        );
      }

      const details = [
        `🎬 ${title}`,
        channel ? `👤 ${channel}` : "",
        duration ? `⏱️ ${duration}` : "",
        `📥 Quality: ${VIDEO_QUALITY}p`,
      ]
        .filter(Boolean)
        .join("\n");

      await sendVideo(
        m,
        client,
        buffer,
        details,
        `${safeFileName(title)}-${VIDEO_QUALITY}p.mp4`
      );

      await m.react?.("✅");
    } catch (error) {
      console.error("video command error:", error);
      await m.react?.("❌");
      return sendText(
        m,
        client,
        `❌ Video eka download karanna bari una.\nReason: ${
          error?.response?.data?.message || error.message || "Unknown error"
        }`
      );
    }
  }
);
