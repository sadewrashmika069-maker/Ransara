const { Sparky, isPublic } = require("../lib");
const axios = require('axios');

Sparky({
    name: "aio",
    alias: ["download", "dl", "get", "x"],
    fromMe: isPublic,
    category: "downloader",
    desc: "All-In-One Downloader for 50+ platforms using WhiteShadow API",
},
async ({ m, client, args }) => {
    try {
        let url = args || m.quoted?.text;

        // ලින්ක් එකක් දීලා නැත්නම් පෙන්වන මැසේජ් එක
        if (!url) {
            let menuText = `📥 *SADEW-MD AIO DOWNLOADER* 📥\n\n`;
            menuText += `*💡 භාවිතය:* \n.aio [වීඩියෝ හෝ ඕඩියෝ ලින්ක් එක]\n\n`;
            menuText += `*📌 SUPPORTED PLATFORMS:* \n`;
            menuText += `» TikTok, YT, Spotify, FB, IG, XNXX, etc. (50+ Sites)\n\n`;
            menuText += `_© Powered by WhiteShadow API_`;
            return await m.reply(menuText);
        }

        // ටෙක්ස්ට් එක අස්සෙන් ලින්ක් එක විතරක් කපා ගැනීම
        const linkRegex = /(https?:\/\/[^\s]+)/g;
        const match = url.match(linkRegex);
        if (!match) return await m.reply("*⚠️ කරුණාකර වලංගු HTTP/HTTPS මීඩියා ලින්ක් එකක් ඇතුළත් කරන්න!*");
        url = match[0];

        await m.react('⏳');

        // API URL එක
        const apiUrl = `https://whiteshadow-x-api.onrender.com/api/download/aio?url=${encodeURIComponent(url)}&apitoken=VK4fry`;
        const response = await axios.get(apiUrl);

        // API Response එක සාර්ථක නම්
        if (response.data && response.data.Code === 200 && response.data.Result) {
            const res = response.data.Result;
            
            // සර්වර් ලොග් එකේ බලාගන්න API එකෙන් එන දේ පින්ට් කරමු
            console.log("--- WhiteShadow API Result ---", res);

            let downloadLink = "";
            let title = "AIO Downloaded Media";
            
            // 1. Array එකක් ආවොත් (සමහර සයිට් වල ලිස්ට් එකක් එනවා)
            if (Array.isArray(res) && res.length > 0) {
                const first = res[0];
                downloadLink = first.url || first.link || first.download || first.dl_link || first.video || first.audio;
                title = first.title || first.caption || title;
            } 
            // 2. Object එකක් ආවොත්
            else if (typeof res === 'object' && res !== null) {
                downloadLink = res.url || res.link || res.download || res.dl_link || res.video || res.audio || res.url_download;
                title = res.title || res.caption || title;
            } 
            // 3. කෙලින්ම String එකක් ආවොත්
            else if (typeof res === 'string') {
                downloadLink = res;
            }

            if (!downloadLink) {
                await m.react('❌');
                return await m.reply("_⚠️ කණගාටුයි, මෙම ලින්ක් එකෙන් ඩවුන්ලෝඩ් URL එක වෙන් කර ගැනීමට නොහැකි විය!_");
            }

            // 🔥 [FIX] m.sendFromUrl වෙනුවට අපිම Buffer එක අරන් කෙලින්ම යවන සුපිරි සිස්ටම් එක
            const mediaRes = await axios.get(downloadLink, { 
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            
            const contentType = mediaRes.headers['content-type'] || '';
            const buffer = Buffer.from(mediaRes.data, 'binary');

            // Content-Type එක අනුව වීඩියෝ/ඕඩියෝ වෙන් කර යැවීම
            if (contentType.includes('video')) {
                await client.sendMessage(m.jid, { 
                    video: buffer, 
                    caption: `🎥 *${title}*\n\n_Powered by SADEW-MD_` 
                }, { quoted: m });
            } 
            else if (contentType.includes('audio')) {
                await client.sendMessage(m.jid, { 
                    audio: buffer, 
                    mimetype: 'audio/mp4', 
                    ptt: false 
                }, { quoted: m });
            } 
            else if (contentType.includes('image')) {
                await client.sendMessage(m.jid, { 
                    image: buffer, 
                    caption: `📸 *${title}*\n\n_Powered by SADEW-MD_` 
                }, { quoted: m });
            } 
            else {
                // Content-Type එක අඳුරගන්න බැරි වුණොත් Default වීඩියෝ එකක් විදිහට ට්‍රයි කරනවා
                await client.sendMessage(m.jid, { 
                    video: buffer, 
                    caption: `🎥 *${title}*\n\n_Powered by SADEW-MD_` 
                }, { quoted: m });
            }
            
            await m.react('✅');
        } else {
            await m.react('❌');
            const errorMsg = response.data?.Error || "මෙම ලින්ක් එක දැනට ක්‍රියාත්මක නොවේ!";
            return await m.reply(`*⚠️ API Error:* ${errorMsg}`);
        }

    } catch (error) {
        await m.react('❌');
        console.error("AIO Downloader Global Error:", error);
        return m.reply(`_Error: ${error.message || error}_`);
    }
});
