// movie2.js
const { Sparky, isPublic } = require("../lib"); // ✅ FIX: Import Sparky
const axios = require("axios");

// Dubflix සඳහා වෙනම Session Map එකක්
if (!global.dubflixSessions) global.dubflixSessions = new Map();

// බොට් බ්‍රෑන්ඩින්ග් විස්තර
const BOT_NAME = "★👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥 ★";
const POWERED_BY = "Powered by sadew rashmika";
const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";

// Fake Quote එකක් සැකසීමට පොදු ෆන්ක්ෂන් එකක්
function getMetaQuote() {
    return {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "SADEW_X_MD_DF" },
        message: { contactMessage: { displayName: BOT_NAME, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME}\nORG:${POWERED_BY}\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };
}

// පින්තූරයක් හෝ ටෙක්ස්ට් එකක් බිඳෙන්නේ නැතිව යැවීමට සකසන ලද සේෆ් ෆන්ක්ෂන් එකක්
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
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

// ==========================================
// 1. MAIN DUBFLIX SEARCH COMMAND (.dubflix / .df)
// ==========================================
Sparky({
    name: "dubflix",
    alias: ["df"],
    category: "download",
    fromMe: isPublic,
    desc: "🎬 Dubflix වෙබ් අඩවියෙන් චිත්‍රපට සොයන්න."
}, async ({ client, m, args }) => {
    try {
        const query = getQuery(args);

        if (!query) {
            return await m.reply(`🎬 *${BOT_NAME} - DUBFLIX*

*භාවිතය:* ${m.prefix}df <movie_name>
*උදාහරණ:* ${m.prefix}df venom

📌 *චිත්‍රපටය තෝරා ගැනීමට:* .d<අංකය> (උදා: .d1 සිට .d10 දක්වා)
📌 *Quality තෝරා ගැනීමට:* .dm1, .dm2, .dm3

_${POWERED_BY}_`);
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

        const results = data.results.slice(0, 10);
        let listMsg = `🎬 *${BOT_NAME} - DUBFLIX SEARCH*\n\n🔍 *සෙව්වේ:* ${query}\n📊 ප්‍රතිඵල ගණන: ${results.length}\n\n`;
        
        results.forEach((movie, i) => {
            listMsg += `*${i + 1}.* ${movie.title}\n`;
        });
        
        listMsg += `\n📌 *චිත්‍රපටය තෝරා ගැනීමට අංකය ටයිප් කරන්න:* .d<අංකය>\n*උදාහරණ:* .d1 හෝ .d10 දක්වා ඕනෑම එකක්`;

        const firstMovieImg = results[0].thumbnail || results[0].image || results[0].img;
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
// 2. DYNAMIC NUMBER SELECTORS (.d1 To .d10)
// ==========================================
for (let i = 1; i <= 10; i++) {
    Sparky({
        name: `d${i}`,
        category: "download",
        fromMe: isPublic,
        desc: `Dubflix චිත්‍රපට අංක ${i} තෝරා ගැනීමට.`
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
            console.error(`Error in numeric command .d${i}:`, err);
        }
    });
}

// ==========================================
// 3. DYNAMIC QUALITY SELECTORS (.dm1, .dm2, .dm3)
// ==========================================
for (let j = 1; j <= 3; j++) {
    Sparky({
        name: `dm${j}`,
        category: "download",
        fromMe: isPublic,
        desc: `Dubflix Quality ${j} තෝරා බාගත කර ගැනීමට.`
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
            console.error(`Error in quality command .dm${j}:`, err);
        }
    });
}

// ==========================================
// FETCH QUALITY OPTIONS FUNCTION
// ==========================================
async function fetchDfQualityOptions(client, m, selectedMovie) {
    const movieUrl = selectedMovie.url;
    const movieImg = selectedMovie.thumbnail;

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

        // 1. Direct Link එකක් තියෙනවා නම් (Movie එකක් නම්)
        if (resultData.direct_link && resultData.direct_link !== "N/A") {
            const baseLink = resultData.direct_link;

            let qualMsg = `🎬 *${title}*\n📅 Release: ${resultData.release_date || 'N/A'}\n\n📥 *ඔබට අවශ්‍ය Quality එක තෝරන්න:*\n\n`;
            qualMsg += `🟢 *480p* (SD Quality) ➡️ 📥 *.dm1*\n`;
            qualMsg += `🟢 *720p* (HD Quality) ➡️ 📥 *.dm2*\n`;
            qualMsg += `🟢 *1080p* (Full HD) ➡️ 📥 *.dm3*\n\n`;
            qualMsg += `📌 *බාගැනීමට කමාන්ඩ් එක දෙන්න:* .dm1, .dm2 හෝ .dm3`;

            await sendMediaOrText(client, m.jid, qualMsg, movieImg, m);

            global.dubflixSessions.set(m.sender, {
                step: "awaiting_quality",
                baseLink: baseLink,
                movieTitle: title,
                timestamp: Date.now()
            });
            
            setTimeout(() => global.dubflixSessions.delete(m.sender), 5 * 60 * 1000);
            await m.react("🎬");

        // 2. Series එකක් නම් (Direct Link එක නැත්නම්) එපිසෝඩ් ලිස්ට් එක යවනවා
        } else if (resultData.is_series && resultData.series_list && resultData.series_list.length > 0) {
            let caption = `🎬 *${title}*\n📌 *මෙය Series එකක් හෝ Collection එකකි.*\n\n👇 *පහතින් අවශ්‍ය කොටස තෝරාගන්න:*\n\n`;
            
            const filteredSeries = resultData.series_list.filter(item => !item.name.startsWith('#'));
            
            filteredSeries.forEach((episode, i) => {
                caption += `*${i + 1}.* ${episode.name}\n🔗 *Command:* .df_ep ${episode.link}\n\n`;
            });
            
            caption += `_(ඉහත Command එක Copy කර යැවීමෙන් අදාළ කොටස බාගත කරගත හැක)_`;

            await sendMediaOrText(client, m.jid, caption, movieImg, m);
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
// SERIES EPISODE HANDLER (.df_ep)
// ==========================================
Sparky({
    name: "df_ep",
    category: "download",
    fromMe: isPublic,
    desc: "Dubflix Series Episode ලබා ගැනීම"
}, async ({ client, m, args }) => {
    try {
        const url = getQuery(args);
        if (!url) return await m.reply("❌ කරුණාකර Episode Link එක ලබා දෙන්න.");

        await fetchDfQualityOptions(client, m, { url: url, thumbnail: null, title: "Episode" });
    } catch (err) {
        console.error("df_ep Error:", err);
    }
});

// ==========================================
// DOWNLOAD & DIRECT SEND FUNCTION
// ==========================================
async function downloadAndSendDfMovie(client, m, finalUrl, qualityStr, movieTitle) {
    try {
        await m.react("⬇️");
        const metaQuote = getMetaQuote();

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
