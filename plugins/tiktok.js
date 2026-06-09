const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

const http = axios.create({
  timeout: 20000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
  },
});

const APIS = [
  {
    name: "TikWM",
    url: (link) => `https://www.tikwm.com/api/?url=${encodeURIComponent(link)}`,
    parser: parseTikwm,
  },
  {
    name: "TiklyDown",
    url: (link) => `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(link)}`,
    parser: parseGeneric,
  },
  {
    name: "Ryzen",
    url: (link) => `https://api.ryzendesu.vip/api/downloader/ttdl?url=${encodeURIComponent(link)}`,
    parser: parseGeneric,
  },
  {
    name: "Delirius",
    url: (link) => `https://delirius-apiofc.vercel.app/download/tiktok?url=${encodeURIComponent(link)}`,
    parser: parseGeneric,
  },
];

function extractTikTokUrl(text) {
  const match = String(text || "").match(/https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/\S+/i);
  return match ? match[0].replace(/[)>.,]+$/g, "") : "";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function normalizeMediaUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://www.tikwm.com${url}`;
  return url;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function getValueByPath(obj, path) {
  return path.split(".").reduce((value, key) => {
    if (value === undefined || value === null) return undefined;
    return value[key];
  }, obj);
}

function collectUrlsDeep(value, keyHint = "", bucket = { videos: [], images: [] }) {
  if (!value) return bucket;

  if (typeof value === "string") {
    const url = normalizeMediaUrl(value);
    if (!isHttpUrl(url)) return bucket;

    const lowerUrl = url.toLowerCase();
    const lowerKey = String(keyHint || "").toLowerCase();

    const looksLikeVideo =
      lowerUrl.includes(".mp4") ||
      lowerKey.includes("play") ||
      lowerKey.includes("nowm") ||
      lowerKey.includes("no_watermark") ||
      lowerKey.includes("withoutwatermark") ||
      lowerKey.includes("video");

    const looksLikeImage =
      lowerUrl.includes(".jpg") ||
      lowerUrl.includes(".jpeg") ||
      lowerUrl.includes(".png") ||
      lowerUrl.includes(".webp") ||
      lowerKey.includes("image") ||
      lowerKey.includes("photo");

    const isThumbnail =
      lowerKey.includes("avatar") ||
      lowerKey.includes("cover") ||
      lowerKey.includes("thumb") ||
      lowerKey.includes("music");

    if (looksLikeVideo && !lowerKey.includes("music")) bucket.videos.push(url);
    if (looksLikeImage && !isThumbnail) bucket.images.push(url);

    return bucket;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectUrlsDeep(item, keyHint, bucket);
    return bucket;
  }

  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      collectUrlsDeep(item, key, bucket);
    }
  }

  return bucket;
}

function getFirstString(obj, paths) {
  for (const path of paths) {
    const value = getValueByPath(obj, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeResult(result) {
  return {
    source: result.source || "Unknown",
    title: result.title || "TikTok Download",
    author: result.author || "",
    videos: unique(result.videos || []).map(normalizeMediaUrl),
    images: unique(result.images || []).map(normalizeMediaUrl),
  };
}

function parseTikwm(data) {
  const item = data?.data || data?.result || data;
  if (!item || data?.code === -1) {
    throw new Error(data?.msg || "TikWM returned empty data");
  }

  const videos = [
    item.hdplay,
    item.play,
    item.wmplay,
    item.video,
    item.no_watermark,
    item.nowm,
  ];

  const images = Array.isArray(item.images) ? item.images : [];

  return normalizeResult({
    source: "TikWM",
    title: item.title,
    author: item.author?.nickname || item.author?.unique_id || "",
    videos,
    images,
  });
}

function parseGeneric(data, source = "API") {
  if (!data || typeof data !== "object") throw new Error("Empty API response");

  const explicitVideos = [
    "data.play",
    "data.hdplay",
    "data.wmplay",
    "data.video",
    "data.video.noWatermark",
    "data.video.noWatermarkHd",
    "data.video.noWatermark_hd",
    "data.video.nowm",
    "data.video_url",
    "data.url",
    "result.video",
    "result.video.noWatermark",
    "result.video.noWatermarkHd",
    "result.video.nowm",
    "result.video_url",
    "result.nowm",
    "result.url",
    "video.noWatermark",
    "video.nowm",
    "video.url",
  ]
    .map((path) => getValueByPath(data, path))
    .filter((value) => typeof value === "string");

  const explicitImages = [
    getValueByPath(data, "data.images"),
    getValueByPath(data, "data.image"),
    getValueByPath(data, "data.photos"),
    getValueByPath(data, "result.images"),
    getValueByPath(data, "result.image"),
    getValueByPath(data, "result.photos"),
    getValueByPath(data, "images"),
    getValueByPath(data, "photos"),
  ]
    .flatMap((value) => (Array.isArray(value) ? value : value ? [value] : []))
    .filter((value) => typeof value === "string");

  const deepUrls = collectUrlsDeep(data);

  const title = getFirstString(data, [
    "data.title",
    "data.desc",
    "result.title",
    "result.desc",
    "title",
    "desc",
  ]);

  const author = getFirstString(data, [
    "data.author.nickname",
    "data.author.unique_id",
    "data.author.name",
    "result.author.nickname",
    "result.author.unique_id",
    "result.author.name",
    "author.nickname",
    "author.unique_id",
    "author.name",
  ]);

  return normalizeResult({
    source,
    title,
    author,
    videos: [...explicitVideos, ...deepUrls.videos],
    images: [...explicitImages, ...deepUrls.images],
  });
}

async function fetchFromApi(api, link) {
  const response = await http.get(api.url(link), {
    validateStatus: (status) => status >= 200 && status < 500,
  });

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (response.status === 403 || contentType.includes("text/html")) {
    throw new Error(`Blocked or HTML response (${response.status})`);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}`);
  }

  const parsed = api.parser(response.data, api.name);
  const result = normalizeResult({ ...parsed, source: api.name });

  if (!result.videos.length && !result.images.length) {
    throw new Error("No downloadable media URL found");
  }

  return result;
}

async function getTikTokMedia(link) {
  const errors = [];

  for (const api of APIS) {
    try {
      return await fetchFromApi(api, link);
    } catch (error) {
      errors.push(`${api.name}: ${error.message}`);
      console.log(`TikTok API failed - ${api.name}:`, error.message);
    }
  }

  throw new Error(errors.join(" | "));
}

async function downloadBuffer(url, type = "video") {
  const response = await http.get(url, {
    responseType: "arraybuffer",
    headers: {
      Accept: type === "image" ? "image/*,*/*" : "video/mp4,video/*,*/*",
      Referer: "https://www.tiktok.com/",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("text/html")) {
    throw new Error("Media URL returned HTML instead of file");
  }

  return Buffer.from(response.data);
}

async function react(client, m, text) {
  try {
    await client.sendMessage(m.jid, { react: { text, key: m.key } });
  } catch {}
}

async function reply(client, m, text) {
  if (typeof m.reply === "function") return m.reply(text);
  return client.sendMessage(m.jid, { text }, { quoted: m });
}

function captionFor(result) {
  let caption = `🎬 *TikTok Downloader*\n\n`;
  if (result.title) caption += `📝 ${result.title}\n`;
  if (result.author) caption += `👤 ${result.author}\n`;
  caption += `🛰️ Source: ${result.source}\n\n`;
  caption += `*❖ SADEW MD*`;
  return caption;
}

Sparky(
  {
    name: "tiktok",
    alias: ["tt", "tiktokdl", "timg", "ttimg", "slideshow", "ttphoto"],
    category: "download",
    fromMe: isPublic,
    desc: "Download TikTok video or photo slideshow",
  },
  async ({ client, m, args }) => {
    const text = Array.isArray(args) ? args.join(" ") : String(args || "");
    const link = extractTikTokUrl(text);

    if (!link) {
      await react(client, m, "❓");
      return reply(
        client,
        m,
        `╭─「 *TIKTOK DOWNLOADER* 」
│
├ *Usage:* .tiktok <TikTok link>
├ *Example:* .tt https://vt.tiktok.com/xxxx/
│
╰─ *SADEW MD*`
      );
    }

    try {
      await react(client, m, "⏳");
      await client.sendPresenceUpdate("composing", m.jid);

      const result = await getTikTokMedia(link);
      const caption = captionFor(result);

      if (result.videos.length) {
        const video = await downloadBuffer(result.videos[0], "video");
        await client.sendMessage(
          m.jid,
          { video, mimetype: "video/mp4", caption },
          { quoted: m }
        );
        await react(client, m, "✅");
        return;
      }

      const images = result.images.slice(0, 15);
      for (let i = 0; i < images.length; i += 1) {
        const image = await downloadBuffer(images[i], "image");
        await client.sendMessage(
          m.jid,
          { image, caption: i === 0 ? caption : undefined },
          { quoted: i === 0 ? m : undefined }
        );
      }

      await react(client, m, "✅");
    } catch (error) {
      console.log("TikTok error:", error.message);
      await react(client, m, "❌");
      await reply(
        client,
        m,
        "❌ TikTok download කරන්න බැරි වුණා. API එක block/down වෙලා තියෙන්න පුළුවන්. ටික වෙලාවකින් ආයෙත් try කරන්න, නැත්නම් වෙන TikTok link එකක් දාන්න."
      );
    } finally {
      try {
        await client.sendPresenceUpdate("paused", m.jid);
      } catch {}
    }
  }
);
