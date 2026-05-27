// commands/sinhalasub.js
const { Sparky } = require("../lib");
const axios = require("axios");
const config = require("../config");

const API_KEY = config.SINHALASUB_API_KEY || "zanta_fCZXpI08BXyizOiRJlDBShW6";
const API_BASE = "https://api.zanta-mini.store/api/sinhalasub";

const userSessions = new Map();

function getQuery(args) {
  if (!args) return "";
  if (Array.isArray(args)) return args.join(" ").trim();
  if (typeof args === "string") return args.trim();
  if (typeof args === "object") return Object.values(args).join(" ").trim();
  return "";
}

function setSessionTimeout(userJid) {
  setTimeout(() => {
    if (userSessions.has(userJid)) userSessions.delete(userJid);
  }, 5 * 60 * 1000);
}

Sparky({
  name: "sinhalasub",
  category: "download",
  fromMe: false,
  desc: "🎬 සිංහල චිත්‍රපට සොයා බාගන්න"
}, async ({ client, m, args }) => {
  try {
    const query = getQuery(args);
    const userJid = m.sender;

    if (userSessions.has(userJid)) {
      return m.reply(`⚠️ ඔබ දැනටමත් ක්‍රියාකාරී සැසියක සිටී. \`${m.prefix}cancel\` ටයිප් කර අවලංගු කර නැවත උත්සාහ කරන්න.`);
    }

    if (!query) {
      return m.reply(`📌 *සිංහල චිත්‍රපට සෙවුම*\n\n*භාවිතය:* \`${m.prefix}sinhalasub [චිත්‍රපට නම]\`\n\n*උදා:* \`${m.prefix}sinhalasub RRR\``);
    }

    await m.react("⏳");

    const searchUrl = `${API_BASE}/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 15000 });

    if (!searchRes.data?.success || !searchRes.data.results?.length) {
      await m.react("❌");
      return m.reply(`😞 *${query}* සඳහා ප්‍රතිඵල නැත.`);
    }

    const results = searchRes.data.results.slice(0, 8);
    let listMsg = `🎬 *"${query}"* සඳහා ප්‍රතිඵල:\n\n`;
    results.forEach((movie, idx) => {
      listMsg += `${idx+1}. ${movie.title}\n`;
    });
    listMsg += `\n📌 *ඊළඟ පියවර:* ඔබට අවශ්‍ය චිත්‍රපටයේ අංකය **පෙරවරු සමඟ** මෙම පණිවිඩයට *Reply* කරන්න.\n`;
    listMsg += `💡 *උදා:* \`${m.prefix}1\` (අංක 1 සඳහා)`;

    const sentMsg = await client.sendMessage(m.jid, { text: listMsg }, { quoted: m });

    userSessions.set(userJid, {
      step: "waiting_movie_choice",
      results: results,
      listMsgId: sentMsg.key.id,
      query: query,
      prefix: m.prefix
    });
    setSessionTimeout(userJid);
    await m.react("✅");

  } catch (error) {
    console.error("Search error:", error);
    await m.react("❌");
    m.reply(`⚠️ සෙවුම අසාර්ථකයි.\n${error.message.substring(0, 100)}`);
  }
});

// This command will trigger when user types .1, .2, etc. (number with prefix)
Sparky({
  name: "subreply",
  pattern: /^\d+$/,
  fromMe: false,
  dontAddCommandList: true,
  desc: "internal"
}, async ({ client, m, args }) => {
  const userJid = m.sender;
  const session = userSessions.get(userJid);
  if (!session) return;

  // Must be a reply to a bot message
  if (!m.quoted || m.quoted.key.remoteJid !== m.jid) return;
  const quotedMsgId = m.quoted.key.id;
  const number = parseInt(args[0]);

  // ---- Step: movie choice ----
  if (session.step === "waiting_movie_choice" && quotedMsgId === session.listMsgId) {
    const idx = number - 1;
    if (idx < 0 || idx >= session.results.length) {
      return m.reply(`❌ වලංගු අංකයක් නොවේ. 1-${session.results.length} අතර අංකයක් එවන්න.`);
    }
    const selected = session.results[idx];
    const movieUrl = selected.url;
    const title = selected.title;

    await m.reply(`⏳ *${title}* සඳහා ගුණාත්මක විකල්ප සොයමින්...`);

    const dlUrl = `${API_BASE}/dl?apiKey=${API_KEY}&text=${encodeURIComponent(movieUrl)}`;
    const dlRes = await axios.get(dlUrl, { timeout: 15000 });

    if (!dlRes.data?.success || !dlRes.data.results?.links?.length) {
      await m.reply(`❌ ${title} සඳහා බාගැනීම් සබැඳි හමු නොවුණා.`);
      userSessions.delete(userJid);
      return;
    }

    const allLinks = dlRes.data.results.links;
    const videoLinks = allLinks.filter(link => link.quality !== "Subtitles");
    const subLink = allLinks.find(link => link.quality === "Subtitles" && link.size === "SRT");

    if (videoLinks.length === 0) {
      await m.reply(`❌ මෙම චිත්‍රපටය සඳහා වීඩියෝ ගොනු නැත.`);
      userSessions.delete(userJid);
      return;
    }

    let qualMsg = `🎬 *${title}*\n📥 ගුණාත්මක තේරීම:\n\n`;
    videoLinks.forEach((link, i) => {
      qualMsg += `${i+1}. ${link.quality} (${link.size || "N/A"})\n`;
    });
    if (subLink) {
      qualMsg += `\n🔤 *උපසිරැසි (SRT)* පමණක් අවශ්‍ය නම් ${videoLinks.length+1} එවන්න.`;
    }
    qualMsg += `\n\n📌 *පියවර:* ඔබට අවශ්‍ය ගුණාත්මක අංකය **පෙරවරු සමඟ** මෙම පණිවිඩයට *Reply* කරන්න.\n💡 *උදා:* \`${session.prefix}2\``;

    const qualSent = await client.sendMessage(m.jid, { text: qualMsg }, { quoted: m });

    session.step = "waiting_quality_choice";
    session.qualityLinks = videoLinks;
    session.subLink = subLink;
    session.selectedTitle = title;
    session.qualMsgId = qualSent.key.id;
    userSessions.set(userJid, session);
    setSessionTimeout(userJid);
    return;
  }

  // ---- Step: quality choice ----
  if (session.step === "waiting_quality_choice" && quotedMsgId === session.qualMsgId) {
    const videoLinks = session.qualityLinks;
    const subLink = session.subLink;
    const idx = number - 1;

    if (subLink && idx === videoLinks.length) {
      await client.sendMessage(m.jid, {
        text: `✅ *${session.selectedTitle}* - උපසිරැසි SRT\n\n📥 *සබැඳිය:* ${subLink.direct_link}`
      }, { quoted: m });
      userSessions.delete(userJid);
      return;
    }

    if (idx < 0 || idx >= videoLinks.length) {
      return m.reply(`❌ වලංගු අංකයක් නොවේ. 1-${videoLinks.length + (subLink ? 1 : 0)} අතර අංකයක් එවන්න.`);
    }

    const selected = videoLinks[idx];
    const downloadUrl = selected.direct_link;
    const quality = selected.quality;
    const fileSize = selected.size || "unknown";

    let finalMsg = `🎬 *${session.selectedTitle}*\n📀 Quality: ${quality}\n📦 Size: ${fileSize}\n\n🔗 *Download Link:* ${downloadUrl}`;
    if (subLink) {
      finalMsg += `\n\n📝 *Subtitles SRT:* ${subLink.direct_link}`;
    }
    await client.sendMessage(m.jid, { text: finalMsg }, { quoted: m });
    userSessions.delete(userJid);
  }
});

Sparky({
  name: "cancel",
  category: "tools",
  fromMe: false,
  desc: "❌ ක්‍රියාකාරී සැසිය අවලංගු කරන්න"
}, async ({ client, m }) => {
  const userJid = m.sender;
  if (userSessions.has(userJid)) {
    userSessions.delete(userJid);
    m.reply("✅ සැසිය අවලංගු කරන ලදි.");
  } else {
    m.reply("⚠️ කිසිදු ක්‍රියාකාරී සැසියක් නැත.");
  }
});
