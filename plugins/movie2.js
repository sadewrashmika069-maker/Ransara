// plugins/dubflix.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

if (!global.dubflixSessions) global.dubflixSessions = new Map();

const BOT_NAME = "★👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥 ★";
const POWERED_BY = "Powered by sadew rashmika";
const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";

function getMetaQuote() {
    return {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "SADEW_X_MD_DF" },
        message: { contactMessage: { displayName: BOT_NAME, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME}\nORG:${POWERED_BY}\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };
}

async function sendMediaOrText(client, jid, text, imageUrl, quoted) {
    if (imageUrl && imageUrl !== "N/A") {
        try {
            await client.sendMessage(jid, { image: { url: imageUrl }, caption: text }, { quoted });
            return;
        } catch (e) {
            console.error("Thumbnail sending failed, falling back to text:", e);
        }
    }
    await client.sendMessage(jid, { text: text }, { quoted });
}

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    return "";
}

// ==========================================
// 1. MAIN SEARCH COMMAND (.df)
// ==========================================
Sparky({
    name: "df",
    alias: ["dubflix"],
    category: "download",
    fromMe: isPublic,
    desc: "🎬 Dubflix වෙබ් අඩවියෙන් චිත්‍රපට සොයන්න."
}, async ({ client, m, args }) => {
    try {
        const query = getQuery(args);

        if (!query) {
            return await m.reply(`🎬 *${BOT_NAME} - DUBFLIX*\n\n*භාවිතය:* ${m.prefix}df <movie_name>\n*උදා:* ${m.prefix}df venom\n\n📌 *චිත්‍රපටය තෝරා ගැනීමට:* .1 සිට .15\n📌 *Episode තෝරා ගැනීමට:* .ep1 සිට .ep15\n📌 *Quality තෝරා ගැනීමට:* .m1, .m2, .m3`);
        }

        await m.react("🔍");
        await client.sendPresenceUpdate('composing', m.jid);
        await m.reply(`🔎 Dubflix හි සොයමින් "${query}"...`);

        const searchUrl = `https://api.zanta-mini.store/api/dubflix/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { timeout: 15000 });

        if (!data.success || !data.results || data.results.length === 0) {
            await m.react("❌");
            return await m.reply(`❌ සමාවෙන්න, "${query}" සඳහා කිසිදු චිත්‍රපටයක් හමුනොවිය.`);
        }

        const results = data.results.slice(0, 15);
        let listMsg = `🎬 *${BOT_NAME} - DUBFLIX SEARCH*\n\n🔍 *සෙව්වේ:* ${query}\n📊 ප්‍රතිඵල ගණන: ${results.length}\n\n`;
        
        results.forEach((movie, i) => {
            listMsg += `*${i + 1}.* ${movie.title}\n`;
        });
        
        listMsg += `\n📌 *චිත්‍රපටය තෝරා ගැනීමට අංකය ටයිප් කරන්න:* .<අංකය>\n*උදාහරණ:* .1 හෝ .15 දක්වා ඕනෑම එකක්`;

        const firstMovieImg = results[0].thumbnail || "N/A";
        await sendMediaOrText(client, m.jid, listMsg, firstMovieImg, m);

        global.dubflixSessions.set(m.sender, {
            step: "awaiting_movie",
            results: results,
            timestamp: Date.now()
        });
        
        setTimeout(() => global.dubflixSessions.delete(m.sender), 5 * 60 * 1000);
        await m.react("✅");

    } catch (err) {
        console.error("Dubflix Search Error:", err);
        await m.react("❌");
        await m.reply(`❌ සෙවීම අසාර්ථකයි: ${err.message.substring(0, 100)}`);
    }
});

// ==========================================
// 2. DYNAMIC NUMBER SELECTORS FOR MOVIES (.1 To .15)
// ==========================================
for (let i = 1; i <= 15; i++) {
    Sparky({
        name: `${i}`,
        category: "download",
        fromMe: isPublic,
        desc: `චිත්‍රපට අංක ${i} තෝරා ගැනීමට.`
    }, async ({ client, m }) => {
        try {
            const session = global.dubflixSessions.get(m.sender);
            if (!session || session.step !== "awaiting_movie") return; 

            const idx = i - 1;
            if (idx < 0 || idx >= session.results.length) {
                return await m.reply(`❌ වැරදි අංකයක්! කරුණාකර ලයිස්තුවේ ඇති 1-${session.results.length} අතර අංකයක් ඇතුලත් කරන්න.`);
            }

            const selectedMovie = session.results[idx];
            global.dubflixSessions.delete(m.sender);
            
            await fetchDfQualityOptions(client, m, selectedMovie);
        } catch (err) {
            console.error(`Error in numeric command .${i}:`, err);
        }
    });
}

// ==========================================
// 3. DYNAMIC EPISODE SELECTORS (.ep1 To .ep15)
// ==========================================
for (let k = 1; k <= 15; k++) {
    Sparky({
        name: `ep${k}`,
        category: "download",
        fromMe: isPublic,
        desc: `Series Episode ${k} තෝරා ගැනීමට.`
    }, async ({ client, m }) => {
        try {
            const session = global.dubflixSessions.get(m.sender);
            if (!session || session.step !== "awaiting_episode") return; 

            const idx = k - 1;
            if (idx < 0 || idx >= session.episodes.length) {
                return await m.reply(`❌ වැරදි අංකයක්! කරුණාකර ලයිස්තුවේ ඇති 1-${session.episodes.length} අතර අංකයක් ඇතුලත් කරන්න.`);
            }

            const selectedEp = session.episodes[idx];
            global.dubflixSessions.delete(m.sender);
            
            await fetchDfQualityOptions(client, m, { url: selectedEp.link, thumbnail: session.movieImg, title: selectedEp.name });
        } catch (err) {
            console.error(`Error in episode command .ep${k}:`, err);
        }
    });
}

// ==========================================
// 4. DYNAMIC QUALITY SELECTORS (.m1, .m2, .m3)
// ==========================================
for (let j = 1; j <= 3; j++) {
    Sparky({
        name: `m${j}`,
        category: "download",
        fromMe: isPublic,
        desc: `Quality ${j} තෝරා බාගත කර ගැනීමට.`
    }, async ({ client, m }) => {
        try {
            const session = global.dubflixSessions.get(m.sender);
            if (!session || session.step !== "awaiting_quality") return;

            let qualityKey = "720p";
            if (j === 1) qualityKey = "480p";
            if (j === 2) qualityKey = "720p";
            if (j === 3) qualityKey = "1080p";

            const baseLink = session.baseLink;
            const movieTitle = session.movieTitle;

            if (!baseLink || baseLink === "N/A") {
                return await m.reply(`❌ සමාවෙන්න, බාගැනීම් සබැඳියක් හමු නොවීය.`);
            }

            let finalUrl = baseLink;
            if (qualityKey === '480p') {
                finalUrl = baseLink.replace(/(720p|1080p|1080|720)/gi, '480p');
            } else if (qualityKey === '720p') {
                finalUrl = baseLink.replace(/(480p|1080p|1080|480)/gi, '720p');
            } else if (qualityKey === '1080p') {
                finalUrl = baseLink.replace(/(480p|720p|480|720)/gi, '1080p');
            }

            global.dubflixSessions.delete(m.sender);

            await downloadAndSendDfMovie(client, m, finalUrl, qualityKey, movieTitle);
        } catch (err) {
            console.error(`Error in quality command .m${j}:`, err);
        }
    });
}

// ==========================================
// FETCH QUALITY OPTIONS FUNCTION
// ==========================================
async function fetchDfQualityOptions(client, m, selectedMovie) {
    const movieUrl = selectedMovie.url;
    const movieImg = selectedMovie.thumbnail || selectedMovie.image || "N/A";

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📥 තොරතුරු ලබා ගනිමින් පවතී... කරුණාකර රැඳී සිටින්න.`);

    try {
        const extractUrl = `https://api.zanta-mini.store/api/dubflix/dl?apiKey=${API_KEY}&text=${encodeURIComponent(movieUrl)}`;
        const { data } = await axios.get(extractUrl, { timeout: 15000 });

        if (!data.success || !data.results) {
            await m.react("❌");
            return await m.reply(`❌ මෙම චිත්‍රපටය සඳහා බාගැනීම් සබැඳි (Links) හමු නොවිණි.`);
        }

        const resultData = data.results;
        const title = resultData.title || selectedMovie.title;

        // 1. Direct Link available
        if (resultData.direct_link && resultData.direct_link !== "N/A") {
            const baseLink = resultData.direct_link;

            let qualMsg = `🎬 *${title}*\n📅 Release: ${resultData.release_date || 'N/A'}\n\n📥 *ඔබට අවශ්‍ය Quality එක තෝරන්න:*\n\n`;
            qualMsg += `🟢 *480p* (SD Quality) ➡️ 📥 *.m1*\n`;
            qualMsg += `🟢 *720p* (HD Quality) ➡️ 📥 *.m2*\n`;
            qualMsg += `🟢 *1080p* (Full HD) ➡️ 📥 *.m3*\n\n`;
            qualMsg += `📌 *බාගැනීමට කමාන්ඩ් එක දෙන්න:* .m1, .m2 හෝ .m3`;

            await sendMediaOrText(client, m.jid, qualMsg, movieImg, m);

            global.dubflixSessions.set(m.sender, {
                step: "awaiting_quality",
                baseLink: baseLink,
                movieTitle: title,
                timestamp: Date.now()
            });
            
            setTimeout(() => global.dubflixSessions.delete(m.sender), 5 * 60 * 1000);
            await m.react("🎬");

        // 2. Series / Collection List
        } else if (resultData.is_series && resultData.series_list && resultData.series_list.length > 0) {
            let caption = `🎬 *${title}*\n📌 *මෙය Series එකක් හෝ Collection එකකි.*\n\n👇 *පහතින් අවශ්‍ය කොටස තෝරාගන්න:*\n\n`;
            
            const filteredSeries = resultData.series_list.filter(item => !item.name.startsWith('#')).slice(0, 15);
            
            filteredSeries.forEach((episode, i) => {
                caption += `*${i + 1}.* ${episode.name}\n`;
            });
            
            caption += `\n_(කොටස තේරීමට .ep1, .ep2 ආදී වශයෙන් යවන්න)_`;

            await sendMediaOrText(client, m.jid, caption, movieImg, m);
            
            global.dubflixSessions.set(m.sender, {
                step: "awaiting_episode",
                episodes: filteredSeries,
                movieImg: movieImg,
                timestamp: Date.now()
            });

            setTimeout(() => global.dubflixSessions.delete(m.sender), 5 * 60 * 1000);
            await m.react("🎬");

        } else {
            await m.react("❌");
            return await m.reply(`❌ මෙම චිත්‍රපටිය සඳහා Download Links හමුවූයේ නැත.`);
        }

    } catch (err) {
        console.error("Dubflix Quality Fetch Error:", err);
        await m.react("❌");
        await m.reply(`❌ තොරතුරු ලබා ගැනීම අසාර්ථකයි: ${err.message.substring(0, 100)}`);
    }
}

// ==========================================
// DOWNLOAD & DIRECT SEND FUNCTION
// ==========================================
async function downloadAndSendDfMovie(client, m, finalUrl, qualityStr, movieTitle) {
    try {
        await m.react("⬇️");
        const metaQuote = getMetaQuote();
        
        // MEGA LINK DETECTION (HTML 2KB fix)
        if (finalUrl.includes("mega.nz")) {
            await m.react("⚠️");
            return await client.sendMessage(m.jid, { 
                text: `⚠️ *MEGA Link Detected!*\n\nමෙම චිත්‍රපටය MEGA හි අඩංගු බැවින් WhatsApp හරහා කෙලින්ම එවිය නොහැක. (එසේ එව්වොත් 2KB ෆයිල් එකක් පමණක් ලැබේ).\n\nකරුණාකර පහත ලින්ක් එකෙන් කෙලින්ම බාගත කරගන්න:\n\n🔗 ${finalUrl}\n\n*${BOT_NAME}*`
            }, { quoted: metaQuote });
        }

        await client.sendMessage(m.jid, { text: `📥 *Downloading:* ${movieTitle}\n⚙️ *Quality:* ${qualityStr}\n\n_මෙය WhatsApp වෙත Upload වීමට ටික වේලාවක් ගත විය හැක..._` }, { quoted: metaQuote });
        
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

        const safeTitle = movieTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim();
        const caption = `🎬 *${movieTitle}*\n⚙️ *Quality:* ${qualityStr}\n\n*${BOT_NAME}*\n_${POWERED_BY}_`;

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
        await m.reply(`❌ බාගත කර ඔබ වෙත එවීමට අපොහොසත් විය.\n_සමහරවිට මෙම චිත්‍රපටයේ ${qualityStr} සංස්කරණයක් සර්වර් එකේ නොමැත._\n\nError: ${err.message.substring(0, 80)}`);
    }
}
