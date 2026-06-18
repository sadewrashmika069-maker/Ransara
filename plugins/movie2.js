const { Sparky } = require("../lib");
const axios = require('axios');

const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";

// ==========================================
// 1. DUBFLIX SEARCH COMMAND (.dubflix / .df)
// ==========================================
Sparky({
    pattern: "dubflix",
    alias: ["df"],
    desc: "Search and get download links for movies from Dubflix",
    category: "download",
    use: '.dubflix <movie name>',
    filename: __filename
},
async ({ m, client, args }) => {
    try {
        const query = args.join(" ");

        if (!query) {
            return await client.sendMessage(m.chat, { text: "🎬 *කරුණාකර Movie එකේ නම ලබා දෙන්න!*\n_උදා: .df avatar_" }, { quoted: m });
        }

        const botName = "SADEW-MD";
        const metaQuote = {
            key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_DF" },
            message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Dubflix\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
        };

        await client.sendMessage(m.chat, { react: { text: "🔍", key: m.key } });

        // Search API එකෙන් ඩේටා ලබා ගැනීම
        const searchUrl = `https://api.zanta-mini.store/api/dubflix/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;
        const res = await axios.get(searchUrl);
        const data = res.data;

        if (!data.success || !data.results || data.results.length === 0) {
            return await client.sendMessage(m.chat, { text: "❌ *සමාවෙන්න, එම නමින් Movies කිසිවක් හමුවූයේ නැත.*" }, { quoted: m });
        }

        // මුල් ප්‍රතිපල 10 වෙන්කර ගැනීම
        const topResults = data.results.slice(0, 10);
        let listText = `🎬 *SADEW MD DUBFLIX SEARCH*\n\n🔍 *සෙව්වේ:* ${query}\n👇 *ඔබට අවශ්‍ය ෆිල්ම් එකේ අංකය Reply කරන්න*\n\n`;
        
        topResults.forEach((mv, index) => {
            listText += `*${index + 1}.* ${mv.title}\n`;
        });
        listText += `\n> **Reply with 1 - ${topResults.length}**`;

        const listMsg = await client.sendMessage(m.chat, { text: listText }, { quoted: metaQuote });

        // ==========================================
        // REPLY LISTENER
        // ==========================================
        const listener = async ({ messages }) => {
            const replyMsg = messages[0];
            if (!replyMsg.message) return;

            const replyContext = replyMsg.message.extendedTextMessage?.contextInfo;
            const isReplyToBot = replyContext?.stanzaId === listMsg.key.id;

            if (isReplyToBot) {
                const userReply = (replyMsg.message.conversation || replyMsg.message.extendedTextMessage?.text || "").trim();
                const selectedIndex = parseInt(userReply) - 1;

                if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= topResults.length) {
                    return await client.sendMessage(m.chat, { text: "❌ *වැරදි අංකයක්! කරුණාකර නිවැරදි අංකයක් reply කරන්න.*" }, { quoted: replyMsg });
                }

                const selectedMovie = topResults[selectedIndex];

                try {
                    await client.sendMessage(m.chat, { react: { text: "🎬", key: replyMsg.key } });

                    // Download API එකට URL එක යවා විස්තර ලබා ගැනීම
                    const extractUrl = `https://api.zanta-mini.store/api/dubflix/dl?apiKey=${API_KEY}&text=${encodeURIComponent(selectedMovie.url)}`;
                    const extRes = await axios.get(extractUrl);
                    const extData = extRes.data;

                    if (!extData.success || !extData.results) {
                        return await client.sendMessage(m.chat, { text: "❌ *මෙම චිත්‍රපටියේ Direct Links ලබාගත නොහැක.*" }, { quoted: replyMsg });
                    }

                    const resultData = extData.results;
                    let caption = `🎬 *${resultData.title || selectedMovie.title}*\n\n📅 *Release Date:* ${resultData.release_date || 'N/A'}\n⏱ *Duration:* ${resultData.duration || 'N/A'}\n🎭 *Genres:* ${(resultData.genres || []).join(", ")}\n\n`;

                    // 1. Direct Link එකක් තියෙනවා නම් කෙලින්ම යවනවා
                    if (resultData.direct_link && resultData.direct_link !== "N/A") {
                        const shortTitle = (resultData.title || selectedMovie.title).substring(0, 20).replace(/[^a-zA-Z0-9 ]/g, "").trim();
                        caption += `> *Buttons වැඩ කරන්නේ නැත්නම් පහත Command එක Copy කර යවන්න:*\n\n🎥 *Download:*\n.df_dl ${shortTitle} || ${resultData.direct_link}`;
                        
                        const buttons = [
                            { buttonId: `.df_dl ${shortTitle} || ${resultData.direct_link}`, buttonText: { displayText: "🎥 Download Movie" }, type: 1 }
                        ];

                        await client.sendMessage(m.chat, {
                            image: { url: selectedMovie.thumbnail },
                            caption: caption,
                            footer: 'Sadew MD Dubflix',
                            buttons: buttons,
                            headerType: 4
                        }, { quoted: replyMsg });

                    // 2. Series එකක් නම් (Direct Link එක නැත්නම්) එපිසෝඩ් ලිස්ට් එක යවනවා
                    } else if (resultData.is_series && resultData.series_list && resultData.series_list.length > 0) {
                        caption += `📌 *මෙය Series එකක් හෝ Collection එකකි. පහතින් අවශ්‍ය කොටස තෝරාගන්න:*\n\n`;
                        
                        // # වලින් පටන් ගන්න බොරු Categories (උදා: #Action) අයින් කිරීම
                        const filteredSeries = resultData.series_list.filter(item => !item.name.startsWith('#'));
                        
                        filteredSeries.forEach((episode, i) => {
                            caption += `*${i + 1}.* ${episode.name}\n🔗 *Command:* .df_get ${episode.link}\n\n`;
                        });

                        await client.sendMessage(m.chat, {
                            image: { url: selectedMovie.thumbnail },
                            caption: caption
                        }, { quoted: replyMsg });
                    } else {
                        return await client.sendMessage(m.chat, { text: "❌ *මෙම චිත්‍රපටිය සඳහා Download Links හමුවූයේ නැත.*" }, { quoted: replyMsg });
                    }

                    client.ev.off('messages.upsert', listener);

                } catch (e) {
                    console.error("Dubflix Detail Fetch Error:", e);
                    client.ev.off('messages.upsert', listener);
                }
            }
        };

        client.ev.on('messages.upsert', listener);
        setTimeout(() => { client.ev.off('messages.upsert', listener); }, 60000); 

    } catch (e) {
        console.error("Dubflix Search Error:", e);
        await client.sendMessage(m.chat, { text: "❌ *සෙවීමේදී දෝෂයක් ඇතිවිය.*" }, { quoted: m });
    }
});

// ==========================================
// 2. SERIES EPISODE GETTER (.df_get)
// ==========================================
Sparky({
    pattern: "df_get",
    dontAddCommandList: true, // ලිස්ට් එකේ පෙන්වන්න ඕනේ නෑ
    category: "download",
    filename: __filename
},
async ({ m, client, args }) => {
    try {
        const url = args[0];
        if (!url) return;

        await client.sendMessage(m.chat, { react: { text: "⏳", key: m.key } });

        const extractUrl = `https://api.zanta-mini.store/api/dubflix/dl?apiKey=${API_KEY}&text=${encodeURIComponent(url)}`;
        const extRes = await axios.get(extractUrl);
        const extData = extRes.data;

        if (!extData.success || !extData.results || extData.results.direct_link === "N/A") {
            return await client.sendMessage(m.chat, { text: "❌ *මෙම කොටසේ Direct Link ලබාගත නොහැක.*" }, { quoted: m });
        }

        const resultData = extData.results;
        const shortTitle = resultData.title.substring(0, 20).replace(/[^a-zA-Z0-9 ]/g, "").trim();
        
        const caption = `🎬 *${resultData.title}*\n\n> *Buttons වැඩ කරන්නේ නැත්නම් පහත Command එක Copy කර යවන්න:*\n\n🎥 *Download:*\n.df_dl ${shortTitle} || ${resultData.direct_link}`;
        
        const buttons = [
            { buttonId: `.df_dl ${shortTitle} || ${resultData.direct_link}`, buttonText: { displayText: "🎥 Download Video" }, type: 1 }
        ];

        await client.sendMessage(m.chat, {
            text: caption,
            footer: 'Sadew MD Dubflix',
            buttons: buttons,
            headerType: 1
        }, { quoted: m });

    } catch (e) {
        console.error("df_get Error:", e);
    }
});

// ==========================================
// 3. MOVIE DOWNLOAD COMMAND (.df_dl)
// ==========================================
Sparky({
    pattern: "df_dl",
    dontAddCommandList: true,
    category: "download",
    filename: __filename
},
async ({ m, client }) => {
    const textContent = m.message?.buttonsResponseMessage?.selectedButtonId || m.text || '';
    const inputData = textContent.replace(/^[.\/!#]df_dl\s*/i, '').trim();
    
    if (!inputData.includes('||')) return;

    const [title, finalUrl] = inputData.split(' || ');
    if (!finalUrl) return;

    const botName = "SADEW-MD";
    const metaQuote = {
        key: { remoteJid: "status@broadcast", participant: "0@s.whatsapp.net", fromMe: false, id: "META_AI_DF_DL" },
        message: { contactMessage: { displayName: botName, vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${botName}\nORG:Dubflix Downloader\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD` } }
    };

    try {
        await client.sendMessage(m.chat, { react: { text: "⬇️", key: m.key } });
        await client.sendMessage(m.chat, { text: `⬇️ *Downloading ${title}...*\n_මෙය විශාල file එකක් බැවින්, WhatsApp වෙත Upload වීමට ටික වේලාවක් ගත විය හැක._` }, { quoted: metaQuote });

        // Memory Check (Prevent GitHub Actions Out-Of-Memory / WA 2GB Limit)
        try {
            const headRes = await axios.head(finalUrl);
            if (headRes && headRes.headers['content-length']) {
                const sizeMB = parseInt(headRes.headers['content-length']) / (1024 * 1024);
                if (sizeMB > 1950) { 
                    await client.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
                    return await client.sendMessage(m.chat, { text: `❌ *Error: File එක 2GB වලට වඩා විශාලයි! (${sizeMB.toFixed(2)} MB)*\nWhatsApp හරහා මෙය යැවිය නොහැක.` }, { quoted: m });
                }
            }
        } catch (headErr) {
            console.log("Size check failed, proceeding with direct upload...");
        }

        const caption = `🎬 *${title}*\n\n> **SADEW MD DUBFLIX DL ✨**`;

        // Direct stream to WA to bypass GitHub memory limits
        await client.sendMessage(m.chat, {
            document: { url: finalUrl },
            mimetype: "video/mp4",
            fileName: `${title}.mp4`,
            caption: caption
        }, { quoted: metaQuote });

        await client.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error("Dubflix DL Error:", e.message);
        await client.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
        await client.sendMessage(m.chat, { text: "❌ *Download Failed! ලින්ක් එක දෝෂ සහිතයි හෝ Expire වී ඇත.*" }, { quoted: m });
    }
});
