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

// ==========================================
// 1. MAIN SEARCH COMMAND (.anime / .ac)
// ==========================================
Sparky({
    name: "anime",
    alias: ["ac", "animeclub"],
    category: "download",
    fromMe: isPublic,
    desc: "🎌 SL Anime Club වෙබ් අඩවියෙන් Anime සොයන්න."
}, async ({ client, m, args }) => {
    try {
        const query = getQuery(args);

        if (!query) {
            return await m.reply(`🎌 *${BOT_NAME} - ANIME CLUB*

*භාවිතය:* ${m.prefix}anime <නම>
*උදාහරණ:* ${m.prefix}anime naruto

📌 *Anime තෝරා ගැනීමට:* .<අංකය> (උදා: .1)
📌 *Quality තෝරා ගැනීමට:* .m1, .m2, .m3

_${POWERED_BY}_`);
        }

        await m.react("🔍");
        await client.sendPresenceUpdate('composing', m.jid);
        await m.reply(`🔎 Anime Club හි සොයමින් "${query}"...`);

        const searchUrl = `https://animeclub-api.udmodz-2ab.workers.dev/search?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { 
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 15000 
        });

        // 🧠 Smart Array Extraction Logic
        let resultsArray = [];
        if (Array.isArray(data)) {
            resultsArray = data;
        } else if (typeof data === 'object' && data !== null) {
            if (Array.isArray(data.data)) resultsArray = data.data;
            else if (Array.isArray(data.result)) resultsArray = data.result;
            else if (Array.isArray(data.results)) resultsArray = data.results;
            else if (Array.isArray(data.items)) resultsArray = data.items;
            else {
                for (const key in data) {
                    if (Array.isArray(data[key])) {
                        resultsArray = data[key];
                        break;
                    }
                }
            }
        }

        if (!resultsArray || resultsArray.length === 0) {
            await m.react("❌");
            return await m.reply(`❌ සමාවෙන්න, "${query}" සඳහා කිසිදු Anime එකක් හමුනොවිය.\n_(API එකෙන් හිස් ප්‍රතිඵලයක් ලැබුණි)_`);
        }

        const results = resultsArray.slice(0, 10);
        let listMsg = `🎌 *${BOT_NAME} - ANIME SEARCH*\n\n🔍 *සෙව්වේ:* ${query}\n📊 ප්‍රතිඵල ගණන: ${results.length}\n\n`;
        
        results.forEach((anime, i) => {
            const title = anime.title || anime.name || "Unknown Title";
            listMsg += `*${i + 1}.* ${title}\n`;
        });
        
        listMsg += `\n📌 *Anime එක තෝරා ගැනීමට අංකය ටයිප් කරන්න:* .<අංකය>\n*උදාහරණ:* .1 හෝ .10 දක්වා`;

        const firstImg = results[0].image || results[0].img || results[0].thumbnail || results[0].cover;
        await sendMediaOrText(client, m.jid, listMsg, firstImg, m);

        global.animeSessions.set(m.sender, {
            step: "awaiting_anime",
            results: results,
            timestamp: Date.now()
        });
        
        setTimeout(() => global.animeSessions.delete(m.sender), 5 * 60 * 1000);
        await m.react("✅");

    } catch (err) {
        console.error("Anime Search Error:", err);
        await m.react("❌");
        await m.reply(`❌ සෙවීම අසාර්ථකයි: ${err.message.substring(0, 80)}`);
    }
});

// ==========================================
// 2. DYNAMIC NUMBER SELECTORS (.1 To .10)
// ==========================================
for (let i = 1; i <= 10; i++) {
    Sparky({
        name: `${i}`,
        category: "download",
        fromMe: isPublic,
        desc: `Anime අංක ${i} තෝරා ගැනීමට.`
    }, async ({ client, m }) => {
        try {
            const session = global.animeSessions.get(m.sender);
            if (!session || session.step !== "awaiting_anime") return; 

            const idx = i - 1;
            if (idx < 0 || idx >= session.results.length) {
                return await m.reply(`❌ වැරදි අංකයක්! කරුණාකර ලයිස්තුවේ ඇති අංකයක් ඇතුලත් කරන්න.`);
            }

            const selectedAnime = session.results[idx];
            global.animeSessions.delete(m.sender);
            
            await fetchAnimeQualityOptions(client, m, selectedAnime);
        } catch (err) {
            console.error(`Error in anime numeric command .${i}:`, err);
        }
    });
}

// ==========================================
// 3. DYNAMIC QUALITY SELECTORS (.m1, .m2, .m3)
// ==========================================
for (let j = 1; j <= 3; j++) {
    Sparky({
        name: `m${j}`,
        category: "download",
        fromMe: isPublic,
        desc: `Anime Quality ${j} තෝරා බාගත කර ගැනීමට.`
    }, async ({ client, m }) => {
        try {
            const session = global.animeSessions.get(m.sender);
            if (!session || session.step !== "awaiting_anime_quality") return;

            let qualityKey = "720p";
            if (j === 1) qualityKey = "480p";
            if (j === 2) qualityKey = "720p";
            if (j === 3) qualityKey = "1080p";

            const finalUrl = session.linksMap[qualityKey];
            const animeTitle = session.animeTitle;

            if (!finalUrl) {
                return await m.reply(`❌ සමාවෙන්න, මෙම Anime එක සඳහා *${qualityKey}* Quality එක ලබා දීමට නැත. කරුණාකර වෙනත් Quality එකක් තෝරන්න.`);
            }

            global.animeSessions.delete(m.sender);

            await downloadAndSendAnime(client, m, finalUrl, qualityKey, animeTitle);
        } catch (err) {
            console.error(`Error in anime quality command .m${j}:`, err);
        }
    });
}

// ==========================================
// FETCH QUALITY OPTIONS FUNCTION
// ==========================================
async function fetchAnimeQualityOptions(client, m, selectedAnime) {
    const title = selectedAnime.title || selectedAnime.name || "Anime Episode";
    const animeUrl = selectedAnime.url || selectedAnime.link;
    const animeImg = selectedAnime.image || selectedAnime.img || selectedAnime.thumbnail || selectedAnime.cover;

    if (!animeUrl) {
        return await m.reply(`❌ මෙම Anime එක සඳහා වලංගු URL එකක් API එකෙන් ලබා දී නොමැත.`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📥 බාගැනීම් විකල්ප සකසමින්: *${title}*...`);

    try {
        const extractUrl = `https://animeclub-api.udmodz-2ab.workers.dev/dl?url=${encodeURIComponent(animeUrl)}`;
        const { data } = await axios.get(extractUrl, { 
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 15000 
        });

        // 🧠 Smart Array Extraction for Links
        let dlData = null;
        if (Array.isArray(data)) {
            dlData = data;
        } else if (typeof data === 'object' && data !== null) {
            dlData = data.data || data.result || data.results || data.links || data.url || data;
        } else {
            dlData = data; // If it's a direct string
        }

        if (!dlData) {
            await m.react("❌");
            return await m.reply(`❌ මෙම Anime එක සඳහා බාගැනීම් සබැඳි හමු නොවිණි.`);
        }

        const linksMap = { "480p": null, "720p": null, "1080p": null };

        if (Array.isArray(dlData)) {
            dlData.forEach(linkObj => {
                const qStr = (linkObj.quality || linkObj.resolution || linkObj.name || "").toLowerCase();
                if (qStr.includes("480")) linksMap["480p"] = linkObj.url || linkObj.link;
                else if (qStr.includes("720")) linksMap["720p"] = linkObj.url || linkObj.link;
                else if (qStr.includes("1080")) linksMap["1080p"] = linkObj.url || linkObj.link;
            });
        } 
        else if (typeof dlData === "object" && (dlData.url || dlData.link)) {
            linksMap["720p"] = dlData.url || dlData.link; 
            linksMap["480p"] = linksMap["720p"].replace(/(720p|1080p|1080|720)/gi, '480p');
            linksMap["1080p"] = linksMap["720p"].replace(/(480p|720p|480|720)/gi, '1080p');
        } else if (typeof dlData === "string") {
            linksMap["720p"] = dlData;
        }

        let qualMsg = `🎌 *${title}*\n\n📥 *බාගත කිරීම් විකල්ප:*\n\n`;
        let count = 0;

        if (linksMap["480p"]) { qualMsg += `🟢 *480p* (SD) ➡️ 📥 *.m1*\n`; count++; }
        if (linksMap["720p"]) { qualMsg += `🟢 *720p* (HD) ➡️ 📥 *.m2*\n`; count++; }
        if (linksMap["1080p"]) { qualMsg += `🟢 *1080p* (FHD) ➡️ 📥 *.m3*\n`; count++; }

        if (count === 0) {
             return await m.reply(`❌ බාගත හැකි මට්ටමේ ලින්ක් එකක් API එකෙන් ලබා දී නැත.`);
        }

        qualMsg += `\n📌 *බාගැනීමට අදාළ කමාන්ඩ් එක දෙන්න.*`;

        await sendMediaOrText(client, m.jid, qualMsg, animeImg, m);

        global.animeSessions.set(m.sender, {
            step: "awaiting_anime_quality",
            linksMap: linksMap,
            animeTitle: title,
            timestamp: Date.now()
        });
        
        setTimeout(() => global.animeSessions.delete(m.sender), 5 * 60 * 1000);
        await m.react("🎬");

    } catch (err) {
        console.error("Anime Quality Fetch Error:", err);
        await m.react("❌");
        await m.reply(`❌ Quality විකල්ප ලබා ගැනීම අසාර්ථකයි: ${err.message.substring(0, 100)}`);
    }
}

// ==========================================
// DOWNLOAD & DIRECT SEND FUNCTION
// ==========================================
async function downloadAndSendAnime(client, m, finalUrl, qualityStr, animeTitle) {
    try {
        await m.react("⬇️");
        const metaQuote = getMetaQuote();

        await client.sendMessage(m.jid, { text: `📥 *Downloading Anime:* ${animeTitle}\n⚙️ *Quality:* ${qualityStr}\n\n_මෙය WhatsApp වෙත Upload වීමට ටික වේලාවක් ගත විය හැක..._` }, { quoted: metaQuote });
        
        try {
            const headRes = await axios.head(finalUrl, { timeout: 10000 });
            if (headRes && headRes.headers['content-length']) {
                const sizeInMB = parseInt(headRes.headers['content-length']) / (1024 * 1024);
                if (sizeInMB > 1990) {
                    await m.react("❌");
                    return await m.reply(`❌ *ගොනුව විශාල වැඩියි! (${sizeInMB.toFixed(2)} MB)*\nවට්ස්ඇප් හරහා යැවිය හැක්කේ 2GB ට අඩු ෆයිල් පමණි.`);
                }
            }
        } catch (hErr) {
            console.log("Size check bypassed.");
        }

        const safeTitle = animeTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim();
        const caption = `🎌 *${animeTitle}*\n⚙️ *Quality:* ${qualityStr}\n\n*${BOT_NAME}*\n_${POWERED_BY}_`;

        await client.sendMessage(m.jid, {
            document: { url: finalUrl },
            mimetype: "video/mp4",
            fileName: `${safeTitle} - ${qualityStr}.mp4`,
            caption: caption
        }, { quoted: metaQuote });

        await m.react("✅");

    } catch (err) {
        console.error("Direct Upload Error:", err);
        await m.react("❌");
        await m.reply(`❌ බාගත කර ඔබ වෙත එවීමට අපොහොසත් විය.\n_සමහරවිට මෙම Anime එකේ ${qualityStr} සංස්කරණයක් සර්වර් එකේ නොමැත._\n\nError: ${err.message.substring(0, 80)}`);
    }
}
