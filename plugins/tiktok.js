const { Sparky, isPublic } = require("../lib");
const axios = require("axios");
const https = require("https");

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const TIKTOK_API_KEY = process.env.WHITESHADOW_API_KEY || "VK4fry";
const TIKTOK_API_URL = "https://whiteshadow-x-api.onrender.com/api/download/tiktok";

function extractTikTokUrl(text) {
  const match = String(text || "").match(/https?:\/\/[^\s]+/i);
  if (!match) return "";

  const url = match[0].replace(/[)>.,]+$/g, "");
  return /(tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i.test(url) ? url : "";
}

function getValueByPath(obj, path) {
  return path.split(".").reduce((value, key) => {
    if (value === undefined || value === null) return undefined;
    return value[key];
  }, obj);
}

function findFirstUrlDeep(value, keyHint = "") {
  if (!value) return "";

  if (typeof value === "string") {
    const text = value.trim();
    const lowerText = text.toLowerCase();
    const lowerKey = String(keyHint || "").toLowerCase();

    const isUrl = /^https?:\/\//i.test(text);
    const isVideo =
      lowerText.includes(".mp4") ||
      lowerKey.includes("hd") ||
      lowerKey.includes("play") ||
      lowerKey.includes("nowm") ||
      lowerKey.includes("no_watermark") ||
      lowerKey.includes("video") ||
      lowerKey.includes("download");

    if (isUrl && isVideo && !lowerKey.includes("music")) return text;
    return "";
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstUrlDeep(item, keyHint);
      if (found) return found;
    }
    return "";
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const found = findFirstUrlDeep(item, key);
      if (found) return found;
    }
  }

  return "";
}

function findVideoUrl(apiData) {
  const paths = [
    "data.hdplay",
    "data.play",
    "data.video",
    "data.nowm",
    "data.no_watermark",
    "data.noWatermark",
    "data.download",
    "data.url",
    "result.hdplay",
    "result.play",
    "result.video",
    "result.nowm",
    "result.no_watermark",
    "result.noWatermark",
    "result.download",
    "result.url",
    "hdplay",
    "play",
    "video",
    "nowm",
    "no_watermark",
    "noWatermark",
    "download",
    "url",
  ];

  for (const path of paths) {
    const value = getValueByPath(apiData, path);
    if (typeof value === "string" && /^https?:\/\//i.test(value)) return value;
  }

  return findFirstUrlDeep(apiData);
}

function findTitle(apiData) {
  const paths = [
    "data.title",
    "data.desc",
    "result.title",
    "result.desc",
    "title",
    "desc",
  ];

  for (const path of paths) {
    const value = getValueByPath(apiData, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "No Title";
}

function hasHdVideo(apiData, videoUrl) {
  return Boolean(
    getValueByPath(apiData, "data.hdplay") ||
      getValueByPath(apiData, "result.hdplay") ||
      /hd/i.test(videoUrl)
  );
}

async function react(m, text) {
  try {
    if (typeof m.react === "function") return await m.react(text);
  } catch {}
}

Sparky(
  {
    name: "tt",
    alias: ["tiktok", "tiktokdl", "timg", "ttimg", "slideshow", "ttphoto"],
    fromMe: isPublic,
    category: "downloader",
    desc: "Download TikTok videos using Zanta API.",
  },
  async ({ m, client, args }) => {
    const text = Array.isArray(args) ? args.join(" ") : String(args || "");
    const tiktokUrl = extractTikTokUrl(text);

    if (!tiktokUrl) {
      return await client.sendMessage(
        m.jid,
        { text: "❌ *Usage:* `.tt <TikTok URL>`" },
        { quoted: m }
      );
    }

    await react(m, "⏳");

    try {
      const response = await axios.get(ZANTA_API_URL, {
        httpsAgent,
        timeout: 20000,
        params: {
          apiKey: ZANTA_API_KEY,
          url: tiktokUrl,
        },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
        },
      });

      const apiData = response.data;
      const videoUrl = findVideoUrl(apiData);

      if (!videoUrl) {
        console.log("Zanta TikTok API response:", JSON.stringify(apiData).slice(0, 1500));
        throw new Error("No video URL found from Zanta API.");
      }

      const title = findTitle(apiData);
      const isHD = hasHdVideo(apiData, videoUrl) ? "High Quality (HD) ✅" : "Normal Quality ⚠️";

      await react(m, "⬇️");

      const videoStream = await axios.get(videoUrl, {
        httpsAgent,
        responseType: "arraybuffer",
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
          Referer: "https://www.tiktok.com/",
          Accept: "video/mp4,video/*,*/*",
        },
      });

      const videoBuffer = Buffer.from(videoStream.data);
      const captionText =
        `🎬 *ѕά𝓭є𝔀 ᵐ𝐃 Ŧ𝕚ᛕ𝕋𝔬ķ♫*\n\n` +
        `📝 *Title:* ${title}\n` +
        `✨ *Quality:* ${isHD}\n` +
        `📦 *Size:* ${(videoBuffer.length / (1024 * 1024)).toFixed(2)}MB\n\n` +
        `*Downloaded by SADEW-MD*`;

      if (videoBuffer.length > 16 * 1024 * 1024) {
        await client.sendMessage(
          m.jid,
          {
            document: videoBuffer,
            mimetype: "video/mp4",
            fileName: `tiktok_${Date.now()}.mp4`,
            caption: captionText,
          },
          { quoted: m }
        );
      } else {
        await client.sendMessage(
          m.jid,
          {
            video: videoBuffer,
            mimetype: "video/mp4",
            caption: captionText,
          },
          { quoted: m }
        );
      }

      await react(m, "✅");
    } catch (error) {
      await react(m, "❌");
      console.error("TikTok error:", error.response?.data || error.message);

      const errorMsg = String(error.message || "").toLowerCase().includes("timeout")
        ? "❌ *Timeout:* Server took too long."
        : `❌ *Error:* ${error.message}`;

      await client.sendMessage(m.jid, { text: errorMsg }, { quoted: m });
    }
  }
);
