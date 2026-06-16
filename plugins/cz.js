// commands/cinesubz.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

if (!global.cinesubzSessions) global.cinesubzSessions = new Map();

// බ්‍රෑන්ඩින්ග් විස්තර
const BOT_NAME = "★👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥 ★";
const POWERED_BY = "Powered by sadew rashmika";

// Fake Quote එකක් සැකසීමට පොදු ෆන්ක්ෂන් එකක්
function getMetaQuote() {
    return {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "SADEW_X_MD" },
        message: { contactMessage: { displayName: BOT_NAME, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${BOT_NAME}\nORG:${POWERED_BY}\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };
}

// පින්තූරයක් හෝ ටෙක්ස්ට් එකක් බිඳෙන්නේ නැතිව යැවීමට සකසන ලද සේෆ් ෆන්ක්ෂන් එකක්
async function sendMediaOrText(client, jid, text, imageUrl, quoted) {
    if (imageUrl) {
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
// 1. MAIN SEARCH COMMAND (.cinesubz / .cz)
// ==========================================
Sparky({
    name: "cinesubz",
    alias: ["cz", "movie2"],
    category: "download",
    fromMe: isPublic,
    desc: "🎬 Cinesubz වෙබ් අඩවියෙන් චිත්‍රපට සොයන්න."
}, async ({ client, m, args }) => {
    try {
        const query = getQuery(args);

        if (!query) {
            return await m.reply(`🎬 *${BOT_NAME} - CINESUBZ*

*භාවිතය:* ${m.prefix}cz <movie_name>
*උදාහරණ:* ${m.prefix}cz harry potter

📌 *චිත්‍රපටය තෝරා ගැනීමට:* .<අංකය> (උදා: .1)
📌 *Quality තෝරා ගැනීමට:* .dl <අංකය> (උදා: .dl 1)

_${POWERED_BY}_`);
        }

        await m.react("🔍");
        await client.sendPresenceUpdate('composing', m.jid);
        await m.reply(`🔎 Cinesubz හි සොයමින් "${query}"...`);

        const searchUrl = `https://cinesubz-api-cnw.vercel.app/api/search?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { timeout: 15000 });

        if (!data.status || !data.data || data.data.length === 0) {
            await m.react("❌");
            return await m.reply(`❌ සමාවෙන්න, "${query}" සඳහා කිසිදු චිත්‍රපටයක් හමුනොවිය.`);
        }

        const results = data.data.slice(0, 10);
        let listMsg = `🎬 *${BOT_NAME} - SEARCH RESULTS*\n\n🔍 *සෙව්වේ:* ${query}\n📊 ප්‍රතිඵල ගණන: ${results.length}\n\n`;
        
        results.forEach((movie, i) => {
            listMsg += `*${i + 1}.* ${movie.title} (${movie.year || 'N/A'})\n`;
        });
        
        listMsg += `\n📌 *චිත්‍රපටය තෝරා ගැනීමට අංකය ටයිප් කරන්න:* .<අංකය>\n*උදාහරණ:* .1`;

        // පළවෙනි ෆිල්ම් එකේ Thumbnail එක අරගෙන මැසේජ් එක යැවීම
        const firstMovieImg = results[0].image || results[0].img || results[0].thumbnail;
        await sendMediaOrText(client, m.jid, listMsg, firstMovieImg, m);

        // සෙශන් එක සේව් කර තැබීම
        global.cinesubzSessions.set(m.sender, {
            step: "awaiting_movie",
            results: results,
            timestamp: Date.now()
        });
        
        setTimeout(() => global.cinesubzSessions.delete(m.sender), 5 * 60 * 1000);
        await m.react("✅");

    } catch (err) {
        console.error("Search Error:", err);
        await m.react("❌");
        await m.reply(`❌ සෙවීම අසාර්ථකයි: ${err.message.substring(0, 100)}`);
    }
});

// ==========================================
// 2. DIRECT NUMBER SELECTOR (.1, .2, .3, ... .10)
// ==========================================
Sparky({
    name: "1",
    alias: ["2", "3", "4", "5", "6", "7", "8", "9", "10"],
    category: "download",
    fromMe: isPublic,
    desc: "චිත්‍රපට අංකය කෙලින්ම තෝරා ගැනීමට."
}, async ({ client, m }) => {
    const session = global.cinesubzSessions.get(m.sender);
    if (!session || session.step !== "awaiting_movie") return; // සෙශන් එකක් නැත්නම් කමාන්ඩ් එක වැඩ කරන්නේ නැත

    // යූසර් ටයිප් කරපු මැසේජ් එකෙන් නම්බර් එක පමණක් වෙන් කර ගැනීම
    const num = parseInt(m.body.replace(/[^0-9]/g, ''));
    if (isNaN(num)) return;

    const idx = num - 1;
    if (idx < 0 || idx >= session.results.length) {
        return await m.reply(`❌ වැරදි අංකයක්! කරුණාකර ලයිස්තුවේ ඇති අංකයක් ඇතුලත් කරන්න.`);
    }

    const selectedMovie = session.results[idx];
    
    // චිත්‍රපට සෙශන් පියවර මකා දමයි
    global.cinesubzSessions.delete(m.sender);
    
    // බාගැනීම් විකල්ප සහ Thumbnail ලබා ගැනීමට යැවීම
    await fetchQualityOptions(client, m, selectedMovie);
});

// ==========================================
// 3. QUALITY SELECTOR COMMAND (.dl 1, .dl 2)
// ==========================================
Sparky({
    name: "dl",
    category: "download",
    fromMe: isPublic,
    desc: "Quality එක තෝරා බාගත කර ගැනීමට."
}, async ({ client, m, args }) => {
    const session = global.cinesubzSessions.get(m.sender);
    if (!session || session.step !== "awaiting_quality") return;

    const query = getQuery(args);
    const num = parseInt(query);

    if (isNaN(num) || num < 1 || num > 3) {
        return await m.reply(`❌ වැරදි අංකයක්! කරුණාකර .dl 1, .dl 2 හෝ .dl 3 ලෙස ඇතුලත් කරන්න.\n\n1. 480p\n2. 720p\n3. 1080p`);
    }
    
    let qualityStr = "720p";
    if (num === 1) qualityStr = "480p";
    if (num === 2) qualityStr = "720p";
    if (num === 3) qualityStr = "1080p";

    const baseLink = session.baseLink;
    const movieTitle = session.movieTitle;

    // වැඩේ ඉවර නිසා සෙශන් එක ක්ලියර් කරයි
    global.cinesubzSessions.delete(m.sender);

    await downloadAndSendMovie(client, m, baseLink, qualityStr, movieTitle);
});

// ==========================================
// FETCH QUALITY OPTIONS FUNCTION
// ==========================================
async function fetchQualityOptions(client, m, selectedMovie) {
    const title = selectedMovie.title;
    const movieId = selectedMovie.id;
    const movieImg = selectedMovie.image || selectedMovie.img || selectedMovie.thumbnail;

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📥 බාගැනීම් විකල්ප සකසමින්: *${title}*...`);

    try {
        const extractUrl = `https://cinesubz-api-cnw.vercel.app/api/extract?id=${movieId}&type=mv`;
        const { data } = await axios.get(extractUrl, { timeout: 15000 });

        if (!data.status || !data.data || data.data.length === 0) {
            await m.react("❌");
            return await m.reply(`❌ මෙම චිත්‍රපටය සඳහා බාගැනීම් සබැඳි (Links) හමු නොවිණි.`);
        }

        const directVideo = data.data.find(v => v.is_direct_mp4) || data.data[0];
        const baseLink = directVideo.link;

        if (!baseLink) {
            await m.react("❌");
            return await m.reply(`❌ බාගත හැකි මට්ටමේ කිසිදු ලින්ක් එකක් හමු නොවිණි.`);
        }

        let qualMsg = `🎬 *${title}*\n\n📥 *ඔබට අවශ්‍ය Quality එක තෝරන්න:*\n\n`;
        qualMsg += `1. *480p* (SD Quality)\n`;
        qualMsg += `2. *720p* (HD Quality)\n`;
        qualMsg += `3. *1080p* (Full HD Quality)\n\n`;
        qualMsg += `📌 *බාගැනීමට කමාන්ඩ් එක දෙන්න:* .dl <අංකය>\n*උදාහරණ:* .dl 1`;

        // තෝරාගත් චිත්‍රපටයේ Thumbnail එක සමඟ Quality මැසේජ් එක යැවීම
        await sendMediaOrText(client, m.jid, qualMsg, movieImg, m);

        // ඊළඟ පියවර සඳහා Quality සෙශන් එක සක්‍රීය කිරීම
        global.cinesubzSessions.set(m.sender, {
            step: "awaiting_quality",
            baseLink: baseLink,
            movieTitle: title,
            timestamp: Date.now()
        });
        
        setTimeout(() => global.cinesubzSessions.delete(m.sender), 5 * 60 * 1000);
        await m.react("🎬");

    } catch (err) {
        console.error("Quality Fetch Error:", err);
        await m.react("❌");
        await m.reply(`❌ Quality විකල්ප ලබා ගැනීම අසාර්ථකයි: ${err.message.substring(0, 100)}`);
    }
}

// ==========================================
// DOWNLOAD & DIRECT SEND FUNCTION
// ==========================================
async function downloadAndSendMovie(client, m, baseLink, qualityStr, movieTitle) {
    try {
        await m.react("⬇️");
        const metaQuote = getMetaQuote();

        await client.sendMessage(m.jid, { text: `📥 *Downloading:* ${movieTitle}\n⚙️ *Quality:* ${qualityStr}\n\n_මෙය විශාල file එකක් බැවින්, WhatsApp වෙත Upload වීමට ටික වේලාවක් ගත විය හැක..._` }, { quoted: metaQuote });

        // Quality එකට අනුව ලින්ක් එක වෙනස් කිරීම
        let finalUrl = baseLink;
        if (qualityStr === '480p') {
            finalUrl = baseLink.replace(/(720p|1080p|1080|720)/i, '480p');
        } else if (qualityStr === '720p') {
            finalUrl = baseLink.replace(/(480p|1080p|1080|480)/i, '720p');
        } else if (qualityStr === '1080p') {
            finalUrl = baseLink.replace(/(480p|720p|480|720)/i, '1080p');
        }
        
        // 2GB වට්ස්ඇප් සීමාව චෙක් කිරීම
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

        // Direct stream download
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
        await m.reply(`❌ බාගත කර ඔබ වෙත එවීමට අපොහොසත් විය. සර්වර් සබැඳියේ දෝෂයකි.\nError: ${err.message.substring(0, 80)}`);
    }
}
