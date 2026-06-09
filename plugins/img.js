const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

let baileys;
try {
  baileys = require("baileys");
} catch {
  baileys = require("@whiskeysockets/baileys");
}

const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = baileys;

const API_TOKEN = process.env.WHITESHADOW_API_TOKEN || "VK4fry";
const API_URL = "https://whiteshadow-x-api.onrender.com/api/search/google-image";
const BOT_NAME = "Sadew Rashmika";
const IMAGE_LIMIT = 10;

const http = axios.create({
  timeout: 25000,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
    Accept: "application/json,text/plain,*/*",
  },
});

function getQuery(args) {
  return (Array.isArray(args) ? args.join(" ") : String(args || "")).trim();
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ""));
}

function getValueByPath(obj, path) {
  return path.split(".").reduce((value, key) => {
    if (value === undefined || value === null) return undefined;
    return value[key];
  }, obj);
}

function collectImageItems(value, items = []) {
  if (!value) return items;

  if (typeof value === "string") {
    if (isHttpUrl(value) && /\.(jpe?g|png|webp)(\?|$)/i.test(value)) {
      items.push({ imageUrl: value, title: "Google Image", sourceUrl: value });
    }
    return items;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectImageItems(item, items);
    return items;
  }

  if (typeof value === "object") {
    const imageUrl =
      value.image ||
      value.img ||
      value.url ||
      value.link ||
      value.thumbnail ||
      value.original ||
      value.originalUrl ||
      value.imageUrl;

    if (isHttpUrl(imageUrl)) {
      items.push({
        imageUrl,
        title: value.title || value.name || "Google Image",
        sourceUrl: value.source || value.sourceUrl || value.page || value.pageUrl || imageUrl,
      });
      return items;
    }

    for (const item of Object.values(value)) collectImageItems(item, items);
  }

  return items;
}

function normalizeApiResults(data) {
  const possibleResults =
    data?.result ||
    data?.results ||
    data?.data ||
    data?.images ||
    data?.image ||
    data;

  const items = collectImageItems(possibleResults);
  const seen = new Set();

  return items
    .filter((item) => {
      if (!item.imageUrl || seen.has(item.imageUrl)) return false;
      seen.add(item.imageUrl);
      return true;
    })
    .slice(0, IMAGE_LIMIT);
}

async function searchImages(query) {
  const { data } = await http.get(API_URL, {
    params: {
      q: query,
      format: "png",
      limit: IMAGE_LIMIT,
      apitoken: API_TOKEN,
    },
  });

  const items = normalizeApiResults(data);
  if (!items.length) {
    console.log("Image API response:", JSON.stringify(data).slice(0, 1500));
    throw new Error("No images found from API.");
  }

  return items;
}

async function downloadImage(item) {
  const response = await http.get(item.imageUrl, {
    responseType: "arraybuffer",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*",
      Referer: item.sourceUrl || "https://www.google.com/",
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const contentType = String(response.headers["content-type"] || "").toLowerCase();
  if (!contentType.includes("image")) {
    throw new Error("Downloaded file is not an image.");
  }

  return {
    ...item,
    buffer: Buffer.from(response.data),
    mimetype: contentType.includes("png")
      ? "image/png"
      : contentType.includes("webp")
        ? "image/webp"
        : "image/jpeg",
  };
}

async function react(m, text) {
  try {
    if (typeof m.react === "function") await m.react(text);
  } catch {}
}

async function reply(client, m, text) {
  if (typeof m.reply === "function") return m.reply(text);
  return client.sendMessage(m.jid, { text }, { quoted: m });
}

function trimText(text, max = 55) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 3)}...` : clean;
}

async function buildCarouselCard(client, image, index, query) {
  const media = await prepareWAMessageMedia(
    { image: image.buffer },
    { upload: client.waUploadToServer }
  );

  return {
    header: proto.Message.InteractiveMessage.Header.fromObject({
      title: `Image ${index + 1}`,
      hasMediaAttachment: true,
      imageMessage: media.imageMessage,
    }),
    body: proto.Message.InteractiveMessage.Body.fromObject({
      text: `🔎 ${trimText(query)}\n🖼️ ${trimText(image.title)}`,
    }),
    footer: proto.Message.InteractiveMessage.Footer.fromObject({
      text: BOT_NAME,
    }),
    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
      buttons: [
        {
          name: "cta_url",
          buttonParamsJson: JSON.stringify({
            display_text: "Open Image",
            url: image.sourceUrl || image.imageUrl,
            merchant_url: image.sourceUrl || image.imageUrl,
          }),
        },
      ],
    }),
  };
}

async function sendCarousel(client, m, images, query) {
  const cards = [];

  for (let i = 0; i < images.length; i += 1) {
    cards.push(await buildCarouselCard(client, images[i], i, query));
  }

  const carouselMessage = proto.Message.InteractiveMessage.CarouselMessage.fromObject({
    cards,
  });

  const interactiveMessage = proto.Message.InteractiveMessage.fromObject({
    body: proto.Message.InteractiveMessage.Body.fromObject({
      text: `🖼️ *Google Image Search*\n\n🔎 Query: *${query}*\n📌 Results: ${images.length}`,
    }),
    footer: proto.Message.InteractiveMessage.Footer.fromObject({
      text: BOT_NAME,
    }),
    carouselMessage,
  });

  const message = generateWAMessageFromContent(
    m.jid,
    {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
          },
          interactiveMessage,
        },
      },
    },
    { quoted: m }
  );

  await client.relayMessage(m.jid, message.message, { messageId: message.key.id });
}

async function sendImagesFallback(client, m, images, query) {
  for (let i = 0; i < images.length; i += 1) {
    const caption =
      i === 0
        ? `🖼️ *Google Image Search*\n\n🔎 Query: *${query}*\n📌 Results: ${images.length}\n\n*${BOT_NAME}*`
        : undefined;

    await client.sendMessage(
      m.jid,
      {
        image: images[i].buffer,
        mimetype: images[i].mimetype,
        caption,
      },
      { quoted: i === 0 ? m : undefined }
    );
  }
}

Sparky(
  {
    name: "img",
    alias: ["image", "gimage", "googleimg", "imagesearch"],
    fromMe: isPublic,
    category: "tools",
    desc: "Search Google images and send horizontal carousel cards.",
  },
  async ({ client, m, args }) => {
    const query = getQuery(args);

    if (!query) {
      await react(m, "❓");
      return reply(
        client,
        m,
        `╭─「 *IMAGE SEARCH* 」
│
├ *Usage:* .img Sri Lanka
├ *Example:* .img Sadew Rashmika
│
╰─ *${BOT_NAME}*`
      );
    }

    try {
      await react(m, "🔎");
      await client.sendPresenceUpdate("composing", m.jid);

      const results = await searchImages(query);
      const images = [];

      for (const item of results) {
        try {
          images.push(await downloadImage(item));
        } catch (error) {
          console.log("Image download failed:", error.message);
        }
      }

      if (!images.length) throw new Error("Images found, but download failed.");

      try {
        await sendCarousel(client, m, images, query);
      } catch (error) {
        console.log("Carousel send failed, using fallback:", error.message);
        await sendImagesFallback(client, m, images, query);
      }

      await react(m, "✅");
    } catch (error) {
      console.log("Image search error:", error.response?.data || error.message);
      await react(m, "❌");
      await reply(
        client,
        m,
        `❌ Image search කරන්න බැරි වුණා. API එක down වෙලා ඇති හෝ result නැති query එකක් වෙන්න පුළුවන්.`
      );
    } finally {
      try {
        await client.sendPresenceUpdate("paused", m.jid);
      } catch {}
    }
  }
);
