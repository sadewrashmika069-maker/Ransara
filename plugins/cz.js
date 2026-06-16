// commands/cinesubz.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

if (!global.cinesubzSessions) global.cinesubzSessions = new Map();

// බොට් බ්‍රෑන්ඩින්ග් විස්තර
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

📌 *චිත්‍රපටය තෝරා ගැනීමට:* .<අංකය> (උදා: .1 සිට .10 දක්වා)
📌 *Quality තෝරා ගැනීමට:* .m1, .m2, .m3

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
        
        listMsg += `\n📌 *චිත්‍රපටය තෝරා ගැනීමට අංකය ටයිප් කරන්න:* .<අංකය>\n*උදාහරණ:* .1 හෝ .10 දක්වා ඕනෑම එකක්`;

        const firstMovieImg = results[0].image || results[0].img || results[0].thumbnail;
        await sendMediaOrText(client, m.jid, listMsg, firstMovieImg, m);

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
// 2. DYNAMIC NUMBER SELECTORS (.1 To .10)
// ==========================================
for (let i = 1; i <= 10; i++) {
    Sparky({
        name: `${i}`,
        category: "download",
        fromMe: isPublic,
        desc: `Cinesubz චිත්‍රපට අංක ${i} තෝරා ගැනීමට.`
    }, async ({ client, m }) => {
        try {
            const session = global.cinesubzSessions.get(m.sender);
            if (!session || session.step !== "awaiting_movie") return; 

            const idx = i - 1;
            if (idx < 0 || idx >= session.results.length) {
                return await m.reply(`❌ වැරදි අංකයක්! කරුණාකර ලයිස්තුවේ ඇති 1-${session.results.length} අතර අංකයක් ඇතුලත් කරන්න.`);
            }

            const selectedMovie = session.results[idx];
            global.cinesubzSessions.delete(m.sender);
            
            await fetchQualityOptions(client, m, selectedMovie);
        } catch (err) {
            console.error(`Error in numeric command .${i}:`, err);
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
        desc: `Quality ${j} තෝරා බාගත කර ගැනීමට.`
    }, async ({ client, m }) => {
        try {
            const session = global.cinesubzSessions.get(m.sender);
            if (!session || session.step !== "awaiting_quality") return;

            let qualityKey = "720p";
            if (j === 1) qualityKey = "480p";
            if (j === 2) qualityKey = "720p";
            if (j === 3) qualityKey = "1080p";

            const baseLink = session.baseLink;
            const movieTitle = session.movieTitle;

            if (!baseLink) {
                return await m.reply(`❌ සමාවෙන්න, බාගැනීම් සබැඳියක් හමු නොවීය.`);
            }

            // පරණ ක්‍රමයටම URL එකේ අකුරු මාරු කරලා Quality එක වෙනස් කිරීම
            let finalUrl = baseLink;
            if (qualityKey === '480p') {
                finalUrl = baseLink.replace(/(720p|1080p|1080|720)/gi, '480p');
            } else if (qualityKey === '720p') {
                finalUrl = baseLink.replace(/(480p|1080p|1080|480)/gi, '720p');
            } else if (qualityKey === '1080p') {
                finalUrl = baseLink.replace(/(480p|720p|480|720)/gi, '1080p');
            }

            global.cinesubzSessions.delete(m.sender);

            await downloadAndSendMovie(client, m, finalUrl, qualityKey, movieTitle);
        } catch (err) {
            console.error(`Error in quality command .m${j}:`, err);
        }
    });
}

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

        // API එකෙන් එන ප්‍රධාන ලින්ක් එක අල්ලා ගැනීම
        const directVideo = data.data.find(v => v.is_direct_mp4) || data.data[0];
        const baseLink = directVideo.link;

        if (!baseLink) {
            await m.react("❌");
            return await m.reply(`❌ බාගත හැකි මට්ටමේ කිසිදු ලින්ක් එකක් හමු නොවිණි.`);
        }

        // හැම ෆිල්ම් එකකටම Quality 3ම පෙන්වමු
        let qualMsg = `🎬 *${title}*\n\n📥 *ඔබට අවශ්‍ය Quality එක තෝරන්න:*\n\n`;
        qualMsg += `🟢 *480p* (SD Quality) ➡️ 📥 *.m1*\n`;
        qualMsg += `🟢 *720p* (HD Quality) ➡️ 📥 *.m2*\n`;
        qualMsg += `🟢 *1080p* (Full HD) ➡️ 📥 *.m3*\n\n`;
        qualMsg += `📌 *බාගැනීමට කමාන්ඩ් එක දෙන්න:* .m1, .m2 හෝ .m3`;

        await sendMediaOrText(client, m.jid, qualMsg, movieImg, m);

        global.cinesubzSessions.set(m.sender, {
            step: "awaiting_quality",
            baseLink: baseLink, // ප්‍රධාන ලින්ක් එක සේව් කර තබයි
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
async function downloadAndSendMovie(client, m, finalUrl, qualityStr, movieTitle) {
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
