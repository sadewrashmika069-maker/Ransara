const axios = require("axios");
const {
  generateWAMessageFromContent,
  prepareWAMessageMedia,
  proto,
} = require("@whiskeysockets/baileys");
const { Sparky } = require("../lib");

// 🌐 කාගෙන්වත් හිඟාකන්න ඕන නැති පොදු නිදහස් API එකක් අපි දැම්මා!
const API_URL = "https://itzpire.com/search/tiktok"; 

const MAX_RESULTS = 6;
const OUTER_HEADER_TITLE = "ＬＯＡＤＩＮＧ．．． ＳＡＤＥＷ  ＭＤ";
const OUTER_FOOTER_TEXT = "│ ᴘᴏᴡᴇʀᴅ ʙʏ sᴀᴅᴇᴡ-ᴍᴅ";
const CARD_FOOTER_TEXT = "SADEW LITE BOT";

function getJid(m) {
  return m.jid || m.chat || m.from || m.key?.remoteJid;
}

function getSearchQuery(args) {
  if (Array.isArray(args)) return args.join(" ").trim();
  if (typeof args === "string") return args.trim();
  return "";
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function pickResultsArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function createProto(type, value) {
  if (type?.create) return type.create(value);
  if (type?.fromObject) return type.fromObject(value);
  return value;
}

function normalizeVideo(rawVideo, index) {
  const title = pickFirstString(
    rawVideo.title,
    rawVideo.caption,
    rawVideo.desc,
    `TikTok Result ${index + 1}`
  );
  const body = pickFirstString(
    rawVideo.author?.nickname,
    rawVideo.author,
    "TikTok video result"
  );
  const thumbnail = pickFirstString(
    rawVideo.cover,
    rawVideo.thumbnail,
    rawVideo.dynamic_cover
  );
  const url = pickFirstString(
    rawVideo.video,
    rawVideo.url,
    rawVideo.link,
    rawVideo.nowm
  );

  return {
    title,
    body,
    thumbnail,
    url,
  };
}

async function safeReact(m, emoji) {
  try {
    await m.react?.(emoji);
  } catch (error) {
    console.error("ts command react error:", error);
  }
}

async function sendText(m, client, text) {
  const jid = getJid(m);

  if (typeof m.reply === "function") return m.reply(text);
  if (typeof m.sendMsg === "function") return m.sendMsg(jid, text, { quoted: m });
  if (typeof client?.sendMessage === "function") {
    return client.sendMessage(jid, { text }, { quoted: m });
  }

  throw new Error("No supported text send method found");
}

async function fetchTikTokResults(searchQuery) {
  // ටෝකන් නැතිව කෙලින්ම සර්ච් කරන ලින්ක් එක
  const endpoint = `${API_URL}?query=${encodeURIComponent(searchQuery)}`;
  const { data } = await axios.get(endpoint, { timeout: 15000 });

  const results = pickResultsArray(data)
    .map(normalizeVideo)
    .filter((video) => video.url && video.thumbnail)
    .slice(0, MAX_RESULTS);

  if (!results.length) throw new Error("No TikTok results found");
  return results;
}

async function prepareImageHeader(client, thumbnailUrl) {
  if (!thumbnailUrl) throw new Error("Missing thumbnail URL");

  const mediaContent = {
    image: {
      url: thumbnailUrl,
    },
  };
  const options = {
    upload: client.waUploadToServer,
  };

  if (typeof client.prepareWAMessageMedia === "function") {
    return client.prepareWAMessageMedia(mediaContent, options);
  }

  return prepareWAMessageMedia(mediaContent, options);
}

async function buildCarouselCards(client, videos) {
  const cards = [];

  for (const video of videos) {
    try {
      const media = await prepareImageHeader(client, video.thumbnail);

      cards.push(
        createProto(proto.Message.CarouselMessage.Card, {
          header: createProto(proto.Message.InteractiveMessage.Header, {
            title: truncateText(video.title, 30),
            hasMediaAttachment: true,
            imageMessage: media.imageMessage,
          }),
          body: createProto(proto.Message.InteractiveMessage.Body, {
            text: truncateText(video.body, 60),
          }),
          footer: createProto(proto.Message.InteractiveMessage.Footer, {
            text: CARD_FOOTER_TEXT,
          }),
          nativeFlowMessage: createProto(
            proto.Message.InteractiveMessage.NativeFlowMessage,
            {
              buttons: [
                {
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: "📥 Download Video",
                    id: `.tiktok ${video.url}`,
                  }),
                },
              ],
            }
          ),
        })
      );
    } catch (e) {
      console.error("Error building card for video:", video.title, e.message);
    }
  }

  return cards;
}

async function sendCarousel(m, client, searchQuery, videos) {
  const jid = getJid(m);
  const cards = await buildCarouselCards(client, videos);

  if (!cards.length) throw new Error("Could not build any carousel cards");

  const interactiveMessage = createProto(proto.Message.InteractiveMessage, {
    header: createProto(proto.Message.InteractiveMessage.Header, {
      title: OUTER_HEADER_TITLE,
      hasMediaAttachment: false,
    }),
    body: createProto(proto.Message.InteractiveMessage.Body, {
      text: `TikTok search results for: ${searchQuery}`,
    }),
    footer: createProto(proto.Message.InteractiveMessage.Footer, {
      text: OUTER_FOOTER_TEXT,
    }),
    carouselMessage: createProto(proto.Message.CarouselMessage, {
      cards,
      messageVersion: 1,
    }),
  });

  const message = generateWAMessageFromContent(
    jid,
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
    {
      quoted: m,
    }
  );

  await client.relayMessage(jid, message.message, {
    messageId: message.key.id,
  });
}

async function sendFallbackList(m, client, searchQuery, videos) {
  const lines = [
    `TikTok search results for: ${searchQuery}`,
    "",
    ...videos.map((video, index) => {
      const title = truncateText(video.title || `TikTok Result ${index + 1}`, 80);
      return `${index + 1}. ${title}\n${video.url}`;
    }),
  ];

  return sendText(m, client, lines.join("\n\n"));
}

Sparky(
  {
    name: "ts",
    fromMe: false,
    category: "search",
    desc: "Search TikTok videos independently without gatekeeping APIs.",
    description: "Search TikTok videos independently without gatekeeping APIs.",
  },
  async ({ m, client, args }) => {
    const searchQuery = getSearchQuery(args);

    if (!searchQuery) {
      return sendText(m, client, "❌ *Usage:* `.ts sadew`");
    }

    try {
      await safeReact(m, "🔍");

      const videos = await fetchTikTokResults(searchQuery);

      try {
        await sendCarousel(m, client, searchQuery, videos);
      } catch (carouselError) {
        console.error("ts command carousel build/send error, running fallback:", carouselError.message);
        await sendFallbackList(m, client, searchQuery, videos);
      }

      await safeReact(m, "⚡");
    } catch (error) {
      console.error("ts command error:", error);
      await safeReact(m, "❌");

      return sendText(
        m,
        client,
        `❌ TikTok search failed.\nReason: ${
          error?.response?.data?.message || error.message || "Unknown error"
        }`
      );
    }
  }
);
