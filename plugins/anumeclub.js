// commands/anime.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

if (!global.animeSessions) global.animeSessions = new Map();

const BOT_NAME = "★👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥 ★";
const POWERED_BY = "Powered by sadew rashmika";

// ---------- GOOGLE DRIVE DOWNLOADER ----------
const GDRIVE_API_TOKEN = "VK4fry";
const GDRIVE_API_BASE = "https://whiteshadow-x-api.onrender.com/api/download/gdrive";

async function downloadGoogleDrive(driveUrl) {
    try {
        // 1. WhiteShadow API එකට ඉල්ලීම
        const apiUrl = `${GDRIVE_API_BASE}?url=${encodeURIComponent(driveUrl)}&apitoken=${GDRIVE_API_TOKEN}`;
        const response = await axios.get(apiUrl, { timeout: 20000 });
        const data = response.data;

        if (!data || data.success !== true) {
            throw new Error(data?.error || "Google Drive API error");
        }

        // 2. බාගැනීම් සබැඳිය උපුටා ගන්න
        let downloadUrl = data.downloadUrl || data.download_url || data.url || null;

        if (!downloadUrl) {
            // API එකෙන් URL එකක් නැතිනම්, file ID එක භාවිතා කර සෘජු සබැඳියක් ගොඩනගන්න
            const fileId = driveUrl.match(/\/file\/d\/([^\/]+)/)?.[1] || 
                           driveUrl.match(/[?&]id=([^&]+)/)?.[1];
            if (fileId) {
                downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
            }
        }

        if (!downloadUrl) throw new Error("No download URL found");

        // 3. සැබෑ ගොනුව බාගත කිරීම
        const fileRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 180000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            },
            maxRedirects: 5
        });

        const buffer = Buffer.from(fileRes.data);
        const contentType = fileRes.headers['content-type'] || '';

        // HTML පිටුවක් ලැබුණොත් (විශාල ගොනු සඳහා)
        if (contentType.includes('text/html')) {
            const preview = buffer.slice(0, 1500).toString();
            if (preview.includes('quota') || preview.includes('limit')) {
                throw new Error("Download quota exceeded. Try again later.");
            }
            // HTML ලැබුණත්, එය Google Drive හි confirm පිටුවක් විය හැක.
            // අපි එම පිටුවෙන් confirm පරාමිතිය උකහාගෙන නැවත උත්සාහ කරමු.
            const confirmMatch = preview.match(/confirm=([^&"']+)/);
            if (confirmMatch && downloadUrl.includes('drive.usercontent.google.com')) {
                const newUrl = downloadUrl.replace(/&confirm=t/, `&confirm=${confirmMatch[1]}`);
                const retryRes = await axios.get(newUrl, {
                    responseType: 'arraybuffer',
                    timeout: 180000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const retryBuffer = Buffer.from(retryRes.data);
                if (retryBuffer.length > 10000) {
                    return { buffer: retryBuffer, fileName: data.fileName || data.file_name || 'file.mp4', size: (retryBuffer.length / (1024 * 1024)).toFixed(2) };
                }
            }
            throw new Error("Received HTML instead of file. Link may require manual download.");
        }

        if (buffer.length < 10000) throw new Error(`File too small (${buffer.length} bytes)`);
        if (buffer.length > 2000 * 1024 * 1024) throw new Error("File exceeds 2GB WhatsApp limit");

        const fileName = data.fileName || data.file_name || data.filename || 'gdrive_file.mp4';
        return { buffer, fileName, size: (buffer.length / (1024 * 1024)).toFixed(2) };
    } catch (err) {
        throw new Error(`GDrive: ${err.message}`);
    }
}

// ---------- ANIME FUNCTIONS ----------
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
        } catch (e) { console.error("Thumbnail sending failed:", e); }
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

        let resultsArray = [];
        if (Array.isArray(data)) resultsArray = data;
        else if (typeof data === 'object' && data !== null) {
            if (Array.isArray(data.data)) resultsArray = data.data;
            else if (Array.isArray(data.result)) resultsArray = data.result;
            else if (Array.isArray(data.results)) resultsArray = data.results;
            else if (Array.isArray(data.items)) resultsArray = data.items;
            else {
                for (const key in data) {
                    if (Array.isArray(data[key])) { resultsArray = data[key]; break; }
                }
            }
        }

        if (!resultsArray || resultsArray.length === 0) {
            await m.react("❌");
            return await m.reply(`❌ සමාවෙන්න, "${query}" සඳහා කිසිදු Anime එකක් හමුනොවිය.`);
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
                return await m.reply(`❌ සමාවෙන්න, මෙම Anime එක සඳහා *${qualityKey}* Quality එක ලබා දීමට නැත.`);
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
        return await m.reply(`❌ මෙම Anime එක සඳහා වලංගු URL එකක් API එකෙන් ලබා දී නොමැත.`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📥 බාගැනීම් විකල්ප සකසමින්: *${title}*...`);

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
                    if (qStr.includes("480")) { linksMap["480p"] = url; foundExplicit = true; }
                    if (qStr.includes("720")) { linksMap["720p"] = url; foundExplicit = true; }
                    if (qStr.includes("1080")) { linksMap["1080p"] = url; foundExplicit = true; }
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
                    if (!obj.endsWith('/') && !obj.endsWith('.lk') && !obj.endsWith('.com')) return obj;
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
                linksMap["720p"] = baseLink; 
                linksMap["480p"] = baseLink.replace(/(720p|1080p|1080|720)/gi, '480p');
                linksMap["1080p"] = baseLink.replace(/(480p|720p|480|720)/gi, '1080p');
            }
        }

        let qualMsg = `🎌 *${title}*\n\n📥 *බාගත කිරීම් විකල්ප:*\n\n`;
        let count = 0;

        if (linksMap["480p"]) { qualMsg += `🟢 *480p* (SD) ➡️ 📥 *.m1*\n`; count++; }
        if (linksMap["720p"]) { qualMsg += `🟢 *720p* (HD) ➡️ 📥 *.m2*\n`; count++; }
        if (linksMap["1080p"]) { qualMsg += `🟢 *1080p* (FHD) ➡️ 📥 *.m3*\n`; count++; }

        if (count === 0) return await m.reply(`❌ බාගත හැකි මට්ටමේ ලින්ක් එකක් API එකෙන් ලබා දී නැත.`);

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
// 5. DOWNLOAD & SEND FUNCTION (FIXED GOOGLE DRIVE)
// ==========================================
async function downloadAndSendAnime(client, m, finalUrl, qualityStr, animeTitle) {
    const metaQuote = getMetaQuote();
    const safeTitle = animeTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim();

    try {
        await m.react("⬇️");

        // 🔥 CHECK IF IT'S A GOOGLE DRIVE LINK
        if (finalUrl.includes("drive.google.com") || finalUrl.includes("drive.usercontent.google.com")) {
            await m.reply(`🔄 *Google Drive file detected!*\n_Downloading via GDrive API..._`);

            try {
                const result = await downloadGoogleDrive(finalUrl);
                
                // ගොනුවේ extension එක හඳුනාගන්න
                const ext = result.fileName.split('.').pop().toLowerCase() || 'mp4';
                const extMimeMap = {
                    'apk': 'application/vnd.android.package-archive',
                    'mp4': 'video/mp4',
                    'mkv': 'video/x-matroska',
                    'avi': 'video/x-msvideo',
                    'mp3': 'audio/mpeg',
                    'jpg': 'image/jpeg',
                    'png': 'image/png',
                    'pdf': 'application/pdf',
                    'zip': 'application/zip',
                    'srt': 'text/plain'
                };
                const mimetype = extMimeMap[ext] || 'video/mp4';

                const caption = `🎌 *${animeTitle}*\n⚙️ *Quality:* ${qualityStr}\n📦 *Size:* ${result.size} MB\n\n*${BOT_NAME}*\n_${POWERED_BY}_`;

                await client.sendMessage(m.jid, {
                    document: result.buffer,
                    mimetype: mimetype,
                    fileName: `${safeTitle} - ${qualityStr}.${ext}`,
                    caption: caption
                }, { quoted: metaQuote });

                await m.react("✅");
                await m.reply(`✅ *Download complete!* (${result.size} MB)`);
                return;
            } catch (gdriveErr) {
                console.error("GDrive download error:", gdriveErr);
                await m.reply(`⚠️ *Google Drive download failed!*\n\nSending direct link as fallback...`);
                await client.sendMessage(m.jid, {
                    text: `🔗 *${animeTitle}* (${qualityStr})\n\n${finalUrl}`
                }, { quoted: metaQuote });
                return;
            }
        }

        // ---------- NON-GOOGLE DRIVE LINKS ----------
        await m.reply(`📥 *Uploading Anime:* ${animeTitle}\n⚙️ *Quality:* ${qualityStr}\n\n_WhatsApp වෙත Upload වෙමින් පවතී. කරුණාකර රැඳී සිටින්න..._`);

        const caption = `🎌 *${animeTitle}*\n⚙️ *Quality:* ${qualityStr}\n\n*${BOT_NAME}*\n_${POWERED_BY}_`;

        await client.sendMessage(m.jid, {
            document: { url: finalUrl },
            mimetype: "video/mp4",
            fileName: `${safeTitle} - ${qualityStr}.mp4`,
            caption: caption
        }, { quoted: metaQuote });

        await m.react("✅");
        await m.reply(`✅ *Download complete!*`);

    } catch (err) {
        console.error("Download error:", err);
        await m.react("⚠️");
        await m.reply(`⚠️ *Upload failed.*\n\n🔗 *Direct link:*\n${finalUrl}`);
    }
}
