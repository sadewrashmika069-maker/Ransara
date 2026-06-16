// commands/anime.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

if (!global.animeSessions) global.animeSessions = new Map();

const BOT_NAME = "★👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥 ★";
const POWERED_BY = "Powered by sadew rashmika";

function getMetaQuote() {
    return {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "SADEW_X_MD" },
        message: { contactMessage: { displayName: BOT_NAME, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME}\nORG:${POWERED_BY}\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };
}

async function sendMediaOrText(client, jid, text, imageUrl, quoted) {
    if (imageUrl) {
        try {
            await client.sendMessage(jid, { image: { url: imageUrl }, caption: text }, { quoted });
            return;
        } catch (e) {
            console.error("Thumbnail sending failed:", e);
        }
    }
    await client.sendMessage(jid, { text: text }, { quoted });
}

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

function convertToDirectLink(url) {
    if (!url) return null;
    const gdMatch = url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=))([-\w]+)/);
    if (gdMatch && gdMatch[1]) {
        return `https://drive.google.com/uc?export=download&confirm=t&id=${gdMatch[1]}`;
    }
    return url;
}

// ==========================================
// 1. MAIN SEARCH COMMAND (.anime)
// ==========================================
Sparky({
    name: "anime",
    alias: ["ac", "animeclub"],
    category: "download",
    fromMe: isPublic,
    desc: "🎌 SL Anime Club"
}, async ({ client, m, args }) => {
    try {
        const query = getQuery(args);
        if (!query) return await m.reply(`🎌 *${BOT_NAME} - ANIME CLUB*\n\nUsage: .anime <name>\nEx: .anime naruto`);

        await m.react("🔍");
        const { data } = await axios.get(`https://animeclub-api.udmodz-2ab.workers.dev/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });

        let resultsArray = Array.isArray(data) ? data : (data.data || data.result || []);
        if (resultsArray.length === 0) return await m.reply("❌ නැත.");

        const results = resultsArray.slice(0, 10);
        let listMsg = `🎌 *${BOT_NAME} - ANIME SEARCH*\n\n`;
        results.forEach((anime, i) => listMsg += `*${i + 1}.* ${anime.title || anime.name}\n`);
        listMsg += `\n📌 .<අංකය> තෝරන්න (Ex: .1)`;

        await sendMediaOrText(client, m.jid, listMsg, results[0].image || results[0].thumbnail, m);
        global.animeSessions.set(m.sender, { step: "awaiting_anime", results: results });
        await m.react("✅");
    } catch (err) { await m.react("❌"); await m.reply("❌ Error."); }
});

// ==========================================
// 2. NUMBER SELECTORS (.1 To .10)
// ==========================================
for (let i = 1; i <= 10; i++) {
    Sparky({ name: `${i}`, category: "download", fromMe: isPublic }, async ({ client, m }) => {
        const session = global.animeSessions.get(m.sender);
        if (!session || session.step !== "awaiting_anime") return;

        const selected = session.results[i - 1];
        global.animeSessions.delete(m.sender);
        await fetchAnimeQualityOptions(client, m, selected);
    });
}

// ==========================================
// 3. QUALITY SELECTORS (.m1, .m2)
// ==========================================
for (let j = 1; j <= 2; j++) {
    Sparky({ name: `m${j}`, category: "download", fromMe: isPublic }, async ({ client, m }) => {
        const session = global.animeSessions.get(m.sender);
        if (!session || session.step !== "awaiting_anime_quality") return;

        const key = j === 1 ? "480p" : "720p";
        const url = session.linksMap[key];
        if (!url) return await m.reply(`❌ ${key} නැත.`);
        
        global.animeSessions.delete(m.sender);
        await downloadAndSendAnime(client, m, url, key, session.animeTitle);
    });
}

// ==========================================
// 4. QUALITY OPTIONS
// ==========================================
async function fetchAnimeQualityOptions(client, m, selected) {
    await m.react("⏳");
    const { data } = await axios.get(`https://animeclub-api.udmodz-2ab.workers.dev/dl?url=${encodeURIComponent(selected.url || selected.link)}`);
    const linksMap = { "480p": null, "720p": null };
    
    // Scan links
    function scan(obj) {
        if (typeof obj !== 'object' || !obj) return;
        let url = obj.url || obj.link || obj.download;
        let q = (obj.quality || obj.name || "").toLowerCase();
        if (url && typeof url === 'string' && url.startsWith('http')) {
            let d = convertToDirectLink(url);
            if (q.includes("480")) linksMap["480p"] = d;
            if (q.includes("720")) linksMap["720p"] = d;
        }
        for (let k in obj) scan(obj[k]);
    }
    scan(data);

    let msg = `🎌 *${selected.title}*\n\n🟢 *480p* ➡️ .m1\n🟢 *720p* ➡️ .m2`;
    await m.reply(msg);
    global.animeSessions.set(m.sender, { step: "awaiting_anime_quality", linksMap, animeTitle: selected.title });
    await m.react("🎬");
}

// ==========================================
// 5. DOWNLOAD & BYPASS
// ==========================================
async function downloadAndSendAnime(client, m, finalUrl, qualityStr, animeTitle) {
    try {
        await m.react("⬇️");
        let downloadUrl = finalUrl;

        // Drive Bypass
        if (finalUrl.includes("drive.google.com")) {
            const wsRes = await axios.get(`https://whiteshadow-x-api.onrender.com/api/download/gdrive?url=${encodeURIComponent(finalUrl)}&apitoken=VK4fry`);
            if (wsRes.data && wsRes.data.success !== false) {
                downloadUrl = wsRes.data.downloadUrl || wsRes.data.url || finalUrl;
            }
        }

        // 116KB check
        const head = await axios.head(downloadUrl);
        if (parseInt(head.headers['content-length']) < 150000) {
            return await m.reply(`⚠️ *Error:* Google Drive සීමා කිරීම් නිසා කෙලින්ම Upload කළ නොහැක.\n\n🔗 *බාගත කිරීමේ ලින්ක්:* ${downloadUrl}\n(මෙය Click කර බ්‍රව්සර් එකෙන් බාගන්න)`);
        }

        await client.sendMessage(m.jid, { document: { url: downloadUrl }, mimetype: "video/mp4", fileName: `${animeTitle}.mp4`, caption: `${animeTitle} | ${qualityStr}` });
        await m.react("✅");
    } catch (err) {
        await m.react("⚠️");
        await m.reply(`⚠️ Upload අසාර්ථකයි.\n\n🔗 *ලින්ක් එක:* ${finalUrl}`);
    }
}
