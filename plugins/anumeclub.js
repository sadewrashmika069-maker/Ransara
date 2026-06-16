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
// GOOGLE DRIVE DIRECT LINK CONVERTER
// ==========================================
function convertToDirectLink(url) {
    if (!url) return null;
    const gdMatch = url.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=))([-\w]+)/);
    if (gdMatch && gdMatch[1]) {
        return `https://drive.google.com/uc?export=download&confirm=t&id=${gdMatch[1]}`;
    }
    return url;
}

// ==========================================
// 1. MAIN SEARCH COMMAND (.anime / .ac)
// ==========================================
Sparky({
    name: "anime",
    alias: ["ac", "animeclub"],
    category: "download",
    fromMe: isPublic,
    desc: "🎌 SL Anime Club API inda Anime huduki."
}, async ({ client, m, args }) => {
    try {
        const query = getQuery(args);

        if (!query) {
            return await m.reply(`🎌 *${BOT_NAME} - ANIME CLUB*

*Bhavitha:* ${m.prefix}anime <hesaru>
*Udaharane:* ${m.prefix}anime naruto

📌 *Anime ayke madalu:* .<number> (Ex: .1)
📌 *Quality ayke madalu:* .m1, .m2, .m3

_${POWERED_BY}_`);
        }

        await m.react("🔍");
        await client.sendPresenceUpdate('composing', m.jid);
        await m.reply(`🔎 Anime Club nalli hudukuttide "${query}"...`);

        const searchUrl = `https://animeclub-api.udmodz-2ab.workers.dev/search?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { 
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 15000 
        });

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
            return await m.reply(`❌ Kshamisabeku, "${query}" ge yavude Anime sigilla.`);
        }

        const results = resultsArray.slice(0, 10);
        let listMsg = `🎌 *${BOT_NAME} - ANIME SEARCH*\n\n🔍 *Hudukiddu:* ${query}\n📊 Phalithamsha: ${results.length}\n\n`;
        
        results.forEach((anime, i) => {
            const title = anime.title || anime.name || "Unknown Title";
            listMsg += `*${i + 1}.* ${title}\n`;
        });
        
        listMsg += `\n📌 *Anime ayke madalu number type madi:* .<number>\n*Udaharane:* .1 anthu .10 varege`;

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
        await m.reply(`❌ Search fail aagide: ${err.message.substring(0, 80)}`);
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
        desc: `Anime number ${i} ayke madalu.`
    }, async ({ client, m }) => {
        try {
            const session = global.animeSessions.get(m.sender);
            if (!session || session.step !== "awaiting_anime") return; 

            const idx = i - 1;
            if (idx < 0 || idx >= session.results.length) {
                return await m.reply(`❌ Thappu number! Dayavittu list nalli irova number haki.`);
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
        desc: `Anime Quality ${j} download madalu.`
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
                return await m.reply(`❌ Kshamisabeku, ee Anime ge *${qualityKey}* Quality siguthilla. Bere Quality ayke madi.`);
            }

            global.animeSessions.delete(m.sender);

            await downloadAndSendAnime(client, m, finalUrl, qualityKey, animeTitle);
        } catch (err) {
            console.error(`Error in anime quality command .m${j}:`, err);
        }
    });
}

// ==========================================
// 4. FETCH QUALITY OPTIONS FUNCTION
// ==========================================
async function fetchAnimeQualityOptions(client, m, selectedAnime) {
    const title = selectedAnime.title || selectedAnime.name || "Anime Episode";
    const animeUrl = selectedAnime.url || selectedAnime.link;
    const animeImg = selectedAnime.image || selectedAnime.img || selectedAnime.thumbnail || selectedAnime.cover;

    if (!animeUrl) {
        return await m.reply(`❌ Ee Anime ge API yalli valid URL sigilla.`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📥 Download options prepare aaguttide: *${title}*...`);

    try {
        const extractUrl = `https://animeclub-api.udmodz-2ab.workers.dev/dl?url=${encodeURIComponent(animeUrl)}`;
        const { data } = await axios.get(extractUrl, { 
            headers: { "User-Agent": "Mozilla/5.0" },
            timeout: 20000 
        });

        const linksMap = { "480p": null, "720p": null, "1080p": null };
        let foundExplicit = false;

        function findExplicitQualities(obj) {
            if (typeof obj === 'object' && obj !== null) {
                let qStr = (obj.quality || obj.resolution || obj.name || "").toLowerCase();
                let url = obj.url || obj.link || obj.download || obj.file || obj.direct_link;
                
                if (qStr && url && typeof url === 'string' && url.startsWith('http')) {
                    // Google Drive idre direct link ge convert madutte
                    let directUrl = convertToDirectLink(url);
                    if (qStr.includes("480")) { linksMap["480p"] = directUrl; foundExplicit = true; }
                    if (qStr.includes("720")) { linksMap["720p"] = directUrl; foundExplicit = true; }
                    if (qStr.includes("1080")) { linksMap["1080p"] = directUrl; foundExplicit = true; }
                }
                for (let key in obj) {
                    findExplicitQualities(obj[key]);
                }
            }
        }
        findExplicitQualities(data);

        if (!foundExplicit) {
            function getAnyLink(obj) {
                if (typeof obj === 'string' && obj.startsWith('http') && !obj.match(/\.(jpg|jpeg|png|gif|webp|ico)$/i)) {
                    if (!obj.endsWith('/') && !obj.endsWith('.lk') && !obj.endsWith('.com')) {
                        return obj;
                    }
                }
                if (typeof obj === 'object' && obj !== null) {
                    if (obj.download_link && typeof obj.download_link === 'string') return obj.download_link;
                    if (obj.direct_link && typeof obj.direct_link === 'string') return obj.direct_link;
                    if (obj.url && typeof obj.url === 'string' && !obj.url.match(/\.(jpg|png)/i)) return obj.url;
                    
                    for (let key in obj) {
                        let link = getAnyLink(obj[key]);
                        if (link) return link;
                    }
                }
                return null;
            }

            let baseLink = getAnyLink(data);
            if (baseLink) {
                let directBase = convertToDirectLink(baseLink);
                linksMap["720p"] = directBase; 
                linksMap["480p"] = directBase.replace(/(720p|1080p|1080|720)/gi, '480p');
                linksMap["1080p"] = directBase.replace(/(480p|720p|480|720)/gi, '1080p');
            }
        }

        let qualMsg = `🎌 *${title}*\n\n📥 *Download Options:*\n\n`;
        let count = 0;

        if (linksMap["480p"]) { qualMsg += `🟢 *480p* (SD) ➡️ 📥 *.m1*\n`; count++; }
        if (linksMap["720p"]) { qualMsg += `🟢 *720p* (HD) ➡️ 📥 *.m2*\n`; count++; }
        if (linksMap["1080p"]) { qualMsg += `🟢 *1080p* (FHD) ➡️ 📥 *.m3*\n`; count++; }

        if (count === 0) {
             return await m.reply(`❌ API yalli download link sigilla.`);
        }

        qualMsg += `\n📌 *Download madalu command kodi.*`;

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
        await m.reply(`❌ Quality options thegeyuvalli error: ${err.message.substring(0, 100)}`);
    }
}

// ==========================================
// 5. DOWNLOAD & DIRECT SEND FUNCTION
// ==========================================
async function downloadAndSendAnime(client, m, finalUrl, qualityStr, animeTitle) {
    try {
        await m.react("⬇️");
        const metaQuote = getMetaQuote();

        await client.sendMessage(m.jid, { text: `📥 *Downloading Anime:* ${animeTitle}\n⚙️ *Quality:* ${qualityStr}\n\n_Idu WhatsApp ge upload aagalu swalpa samaya thegedukollabuhudu..._` }, { quoted: metaQuote });
        
        try {
            const headRes = await axios.head(finalUrl, { timeout: 10000 });
            if (headRes && headRes.headers['content-length']) {
                const sizeInMB = parseInt(headRes.headers['content-length']) / (1024 * 1024);
                if (sizeInMB > 1990) {
                    await m.react("❌");
                    return await m.reply(`❌ *File size tumba doddadagide! (${sizeInMB.toFixed(2)} MB)*\nWhatsApp nalli 2GB ginta kadime size irova file matra kalisabahudu.`);
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
        await m.reply(`❌ Download madi kalisalu sadhyavagilla.\n_Bahuysha ee Anime ya ${qualityStr} version server nalli illa._\n\nError: ${err.message.substring(0, 80)}`);
    }
}
