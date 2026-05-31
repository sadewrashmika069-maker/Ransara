const { Sparky } = require("../lib");
const axios = require("axios");

const SAFE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "*/*"
};

Sparky({
    name: "song",
    alias: ["play", "ytmp3", "music"],
    category: "download",
    desc: "Ultra Robust Multi-Engine YouTube Downloader"
}, async ({ client, m, args }) => {
    try {
        const query = Array.isArray(args) ? args.join(" ") : args;

        if (!query) {
            return m.reply("_මචං කරුණාකරලා සින්දුවක නමක් දාපන්!_ \n\n*Example:* `.song mithaya mayam`_");
        }

        await m.react("⏳");
        await client.sendPresenceUpdate('composing', m.jid);

        let videoUrl = null;
        let songTitle = query;
        let finalMp3Url = null;

        // ==========================================
        // 🔎 PHASE 1: YOUTUBE SEARCH ENGINE (FAST FAILOVER)
        // ==========================================
        console.log(`[SONG ENGINE] 🔎 [ENGINE 1] Searching via Whiteshadow...`);
        try {
            const searchApi = `https://whiteshadow-x-api.vercel.app/api/search/yt?q=${encodeURIComponent(query)}&apitoken=VK4fry`;
            const searchRes = await axios.get(searchApi, { timeout: 6000 });
            
            // Better null/undefined checking
            if (searchRes?.data) {
                const ytResult = searchRes.data?.result?.[0] || searchRes.data?.response?.[0];
                if (ytResult) {
                    videoUrl = ytResult?.url || ytResult?.link;
                    songTitle = ytResult?.title || query;
                    console.log(`[SONG ENGINE] ✅ Found video: ${songTitle}`);
                }
            }
        } catch (err) {
            console.log(`[SONG ENGINE] ⚠️ [ENGINE 1] Error: ${err.message}`);
        }

        // ==========================================
        // 📥 PHASE 2: MP3 LINK FETCHING (3 SERVERS BACKUP)
        // ==========================================
        
        if (videoUrl) {
            console.log(`[SONG ENGINE] 🎯 Video URL Found: ${videoUrl}`);
            
            // Server 1: Whiteshadow Downloader
            try {
                console.log(`[SONG ENGINE] 📥 [DL SERVER 1] Trying Whiteshadow Downloader...`);
                const dlApi1 = `https://whiteshadow-x-api.vercel.app/api/download/yt?url=${encodeURIComponent(videoUrl)}&apitoken=VK4fry`;
                const res1 = await axios.get(dlApi1, { timeout: 8000 });
                const d1 = res1.data?.result || res1.data?.response;
                if (d1) {
                    finalMp3Url = d1?.mp3 || d1?.download || d1?.url || d1?.link;
                }
            } catch (e) { 
                console.log(`[SONG ENGINE] ❌ [DL SERVER 1] Failed: ${e.message}`); 
            }

            // Server 2: Dark Shan Koyeb Downloader
            if (!finalMp3Url) {
                try {
                    console.log(`[SONG ENGINE] 📥 [DL SERVER 2] Trying Dark Shan Downloader...`);
                    const dlApi2 = `https://api-dark-shan-yt.koyeb.app/download/ytmp3?url=${encodeURIComponent(videoUrl)}`;
                    const res2 = await axios.get(dlApi2, { timeout: 8000 });
                    const d2 = res2.data?.result || res2.data?.response;
                    if (d2) {
                        finalMp3Url = d2?.mp3 || d2?.download || d2?.url || d2?.link;
                    }
                } catch (e) { 
                    console.log(`[SONG ENGINE] ❌ [DL SERVER 2] Failed: ${e.message}`); 
                }
            }
        }

        // Method B: If search failed or no links - Direct Scraper 3
        if (!finalMp3Url) {
            try {
                console.log(`[SONG ENGINE] 📥 [DL SERVER 3] Trying Direct Query Scraper...`);
                const dlApi3 = `https://api.dreaded.site/api/ytdl?url=${encodeURIComponent(query)}`;
                const res3 = await axios.get(dlApi3, { timeout: 10000 });
                const d3 = res3.data?.result || res3.data?.response;
                if (d3) {
                    finalMp3Url = d3?.audio || d3?.mp3 || d3?.download || d3?.url;
                    if (d3?.title) songTitle = d3.title;
                }
            } catch (e) { 
                console.log(`[SONG ENGINE] ❌ [DL SERVER 3] Failed: ${e.message}`); 
            }
        }

        // If all servers fail
        if (!finalMp3Url) {
            await m.react("❌");
            return m.reply("❌ *මචං සර්වර්ස් ඔක්කොම එකපාර බිසී වෙලා! සින්දුව බාගන්න ලැබුනෙ නැහැ. කරුණාකරලා පොඩ්ඩක් ඉඳලා ආයෙ ට්‍රැයි කරන්න!*");
        }

        // ==========================================
        // 🚀 PHASE 3: STREAMING & SENDING AUDIO
        // ==========================================
        console.log(`[SONG ENGINE] 🌊 Downloading Audio Stream from selected server...`);
        
        const audioStream = await axios.get(finalMp3Url, {
            responseType: 'arraybuffer',
            headers: SAFE_HEADERS,
            timeout: 35000
        });

        const audioBuffer = Buffer.from(audioStream.data);

        // Stricter buffer validation
        if (!audioBuffer || audioBuffer.length < 5000) {
            await m.react("❌");
            return m.reply("❌ *මචං ලැබුණු ඕඩියෝ එක කැඩිලා ආවේ. ආයෙ පාරක් කමාන්ඩ් එක දාලා බලන්න!*");
        }

        await m.react("✅");
        console.log(`[SONG ENGINE] 📤 Sending MP3 Audio to User: ${songTitle} (${audioBuffer.length} bytes)`);

        return await client.sendMessage(m.jid, {
            audio: audioBuffer,
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: m });

    } catch (error) {
        console.log(`[🚨 GLOBAL SONG ERROR]:`, error.message || error);
        await m.react("❌");
        return m.reply(`❌ *මචං සින්දුව සිස්ටම් එක ඇතුලේ වැඩ කරද්දී දෝෂයක් ආවා!* \n_\`Error: ${error.message || 'Unknown error'}\`_`);
    }
});
