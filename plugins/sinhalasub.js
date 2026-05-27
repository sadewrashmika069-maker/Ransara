// commands/sinhalasub.js
const { Sparky } = require("../lib");
const axios = require("axios");
const config = require("../config");

const API_KEY = config.SINHALASUB_API_KEY || "zanta_fCZXpI08BXyizOiRJlDBShW6";
const API_BASE = "https://api.zanta-mini.store/api/sinhalasub";

// User session store: { [userJid]: { step, results, selectedMovieIndex, qualityOptions, selectedMovieUrl, selectedTitle } }
const userSessions = new Map();

// Helper: args extract
function getQuery(args) {
  if (!args) return "";
  if (Array.isArray(args)) return args.join(" ").trim();
  if (typeof args === "string") return args.trim();
  if (typeof args === "object") return Object.values(args).join(" ").trim();
  return "";
}

// Helper: clean up session after timeout (5 minutes)
function setSessionTimeout(userJid) {
  setTimeout(() => {
    if (userSessions.has(userJid)) {
      userSessions.delete(userJid);
    }
  }, 5 * 60 * 1000);
}

Sparky({
  name: "sinhalasub",
  category: "download",
  fromMe: false,
  desc: "🎬 සිංහල උපසිරැසි සහිත චිත්‍රපට සොයා බාගන්න (interactive)"
}, async ({ client, m, args }) => {
  try {
    const query = getQuery(args);
    const userJid = m.sender;

    // ---- Step 0: If user is already in a session, ask them to cancel first ----
    if (userSessions.has(userJid)) {
      return m.reply(`⚠️ ඔබ දැනටමත් ක්‍රියාකාරී සැසියක සිටී. කරුණාකර \`${m.prefix}cancel\` ටයිප් කර අවලංගු කර නැවත උත්සාහ කරන්න.`);
    }

    // ---- Step 1: Search movies ----
    if (!query) {
      return m.reply(`📌 *සිංහල චිත්‍රපට සෙවුම*

*භාවිතය:* \`${m.prefix}sinhalasub [චිත්‍රපට නම]\`

*උදා:*
\`${m.prefix}sinhalasub RRR\`
\`${m.prefix}sinhalasub good news\`

*මෙහෙයුම් පියවර:*
1. චිත්‍රපට නම යවන්න
2. ලැයිස්තුවෙන් අංකයක් (reply වශයෙන්) එවන්න
3. ගුණාත්මක අංකයක් (reply වශයෙන්) එවන්න
4. චිත්‍රපටය බාගත වේ`);
    }

    await m.react("⏳");

    // Search API
    const searchUrl = `${API_BASE}/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;
    const searchRes = await axios.get(searchUrl, { timeout: 15000 });

    if (!searchRes.data?.success || !searchRes.data.results?.length) {
      await m.react("❌");
      return m.reply(`😞 *${query}* සඳහා ප්‍රතිඵල නැත. වෙනත් නමක් උත්සාහ කරන්න.`);
    }

    const results = searchRes.data.results.slice(0, 8); // max 8

    // Create numbered list message
    let listMsg = `🎬 *"${query}"* සඳහා ප්‍රතිඵල:\n\n`;
    results.forEach((movie, idx) => {
      listMsg += `${idx+1}. ${movie.title}\n`;
    });
    listMsg += `\n📌 *ඊළඟ පියවර:* ඔබට අවශ්‍ය චිත්‍රපටයේ *අංකය* මෙම පණිවිඩයට *Reply* කරන්න.`;

    const sentMsg = await client.sendMessage(m.jid, { text: listMsg }, { quoted: m });

    // Store session with results and message ID
    userSessions.set(userJid, {
      step: "waiting_movie_choice",
      results: results,
      listMsgId: sentMsg.key.id,
      query: query,
      timestamp: Date.now()
    });
    setSessionTimeout(userJid);

    await m.react("✅");

  } catch (error) {
    console.error("Search error:", error);
    await m.react("❌");
    m.reply(`⚠️ සෙවුම අසාර්ථකයි.\n📝 හේතුව: ${error.message.substring(0, 100)}`);
  }
});

// ========== HANDLER FOR REPLY MESSAGES (within interactive session) ==========
// We need to listen to all messages that are replies to our bot's messages.
// In Sparky, we can create a command with a special pattern that matches numbers
// and also check if the quoted message is from bot and session exists.

// This is a separate command that will trigger when user sends a number (as a message)
// But only if it's a reply to a bot message that is part of an active session.
Sparky({
  name: "subreply",   // invisible command, users won't call it directly
  pattern: /^\d+$/,   // only numbers
  fromMe: false,
  dontAddCommandList: true,  // hide from menu
  desc: "Internal handler"
}, async ({ client, m, args }) => {
  const userJid = m.sender;
  const session = userSessions.get(userJid);
  if (!session) return; // no active session

  // Check if the user replied to a message from the bot (any bot message)
  if (!m.quoted || m.quoted.key.remoteJid !== m.jid) return;
  const quotedMsgId = m.quoted.key.id;

  const number = parseInt(args[0]);  // since pattern matches digits, args[0] is the number

  // ---- Step 2: User replied with a movie number ----
  if (session.step === "waiting_movie_choice" && quotedMsgId === session.listMsgId) {
    const idx = number - 1;
    if (isNaN(idx) || idx < 0 || idx >= session.results.length) {
      await m.reply(`❌ වලංගු අංකයක් නොවේ. කරුණාකර 1-${session.results.length} අතර අංකයක් එවන්න.`);
      return;
    }

    const selected = session.results[idx];
    const movieUrl = selected.url;
    const title = selected.title;

    // Now fetch download links (qualities) from API
    await m.reply(`⏳ *${title}* සඳහා ගුණාත්මක විකල්ප සොයමින්...`);
    const dlUrl = `${API_BASE}/dl?apiKey=${API_KEY}&text=${encodeURIComponent(movieUrl)}`;
    const dlRes = await axios.get(dlUrl, { timeout: 15000 });

    if (!dlRes.data?.success || !dlRes.data.results?.links?.length) {
      await m.reply(`❌ ${title} සඳහා බාගැනීම් සබැඳි හමු නොවුණා.`);
      userSessions.delete(userJid);
      return;
    }

    const allLinks = dlRes.data.results.links;
    // Separate subtitle SRT and video links
    const videoLinks = allLinks.filter(link => link.quality !== "Subtitles");
    const subLink = allLinks.find(link => link.quality === "Subtitles" && link.size === "SRT");

    if (videoLinks.length === 0) {
      await m.reply(`❌ මෙම චිත්‍රපටය සඳහා වීඩියෝ ගොනු නැත. (උපසිරැසි පමණක් තිබේ නම්, එය වෙනම ලබාගත හැක)`, { quoted: m });
      userSessions.delete(userJid);
      return;
    }

    // Build quality options message
    let qualMsg = `🎬 *${title}*\n📥 ගුණාත්මක තේරීම:\n\n`;
    videoLinks.forEach((link, i) => {
      qualMsg += `${i+1}. ${link.quality} (${link.size || "N/A"})\n`;
    });
    if (subLink) {
      qualMsg += `\n🔤 *උපසිරැසි (SRT)* පමණක් අවශ්‍ය නම්, උපසිරැසි quality එක තෝරාගන්න (${videoLinks.length+1}).`;
    }
    qualMsg += `\n\n📌 *පියවර:* ඔබට අවශ්‍ය ගුණාත්මක *අංකය* මෙම පණිවිඩයට *Reply* කරන්න.`;

    const qualSent = await client.sendMessage(m.jid, { text: qualMsg }, { quoted: m });

    // Update session
    session.step = "waiting_quality_choice";
    session.qualityLinks = videoLinks;
    session.subLink = subLink || null;
    session.selectedTitle = title;
    session.qualMsgId = qualSent.key.id;
    userSessions.set(userJid, session);
    setSessionTimeout(userJid);
    return;
  }

  // ---- Step 3: User replied with quality number ----
  if (session.step === "waiting_quality_choice" && quotedMsgId === session.qualMsgId) {
    const idx = number - 1;
    const videoLinks = session.qualityLinks;
    const subLink = session.subLink;

    // Check if user selected subtitle only (if exists)
    if (subLink && idx === videoLinks.length) {
      // Send subtitle SRT link
      await client.sendMessage(m.jid, {
        text: `✅ *${session.selectedTitle}* - උපසිරැසි SRT\n\n📥 *සබැඳිය:* ${subLink.direct_link}\n\n💡 උපසිරැසි file එක බාගත කර VLC වැනි player එකක එකතු කරගන්න.`
      }, { quoted: m });
      userSessions.delete(userJid);
      return;
    }

    if (isNaN(idx) || idx < 0 || idx >= videoLinks.length) {
      await m.reply(`❌ වලංගු අංකයක් නොවේ. කරුණාකර 1-${videoLinks.length + (subLink ? 1 : 0)} අතර අංකයක් එවන්න.`);
      return;
    }

    const selectedQuality = videoLinks[idx];
    const downloadUrl = selectedQuality.direct_link;
    const quality = selectedQuality.quality;
    const fileSize = selectedQuality.size || "unknown";

    // Send the video file directly (if bot supports sending video)
    // Or send the download link. Many bots prefer sending direct link due to size limits.
    // Here we'll send the direct download link.
    let finalMsg = `🎬 *${session.selectedTitle}*\n📀 Quality: ${quality}\n📦 Size: ${fileSize}\n\n🔗 *Download Link:* ${downloadUrl}\n\n*Instructions:* සබැඳිය click කර බාගත කරගන්න. (File එක WhatsApp එකට auto download නොවේ නම්, browser එකෙන් open කරන්න)`;

    if (subLink) {
      finalMsg += `\n\n📝 *Subtitles SRT:* ${subLink.direct_link}`;
    }

    await client.sendMessage(m.jid, { text: finalMsg }, { quoted: m });
    userSessions.delete(userJid);  // session complete
    return;
  }
});

// Cancel command to clear session
Sparky({
  name: "cancel",
  category: "tools",
  fromMe: false,
  desc: "❌ ක්‍රියාකාරී සැසිය අවලංගු කරන්න"
}, async ({ client, m }) => {
  const userJid = m.sender;
  if (userSessions.has(userJid)) {
    userSessions.delete(userJid);
    m.reply("✅ ක්‍රියාකාරී සැසිය සාර්ථකව අවලංගු කරන ලදි. නව සෙවුමක් ආරම්භ කළ හැක.");
  } else {
    m.reply("⚠️ කිසිදු ක්‍රියාකාරී සැසියක් නැත.");
  }
});
