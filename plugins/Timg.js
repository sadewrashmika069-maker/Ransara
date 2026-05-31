const { Sparky } = require("../lib");
const axios = require("axios");

// 🌐 සයිට් බ්ලොක් බයිපාස් කරන්න සාමාන්‍ය Google Chrome බ්‍රවුසර් එකක් අනුකරණය කරන Headers
const BYPASS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.tikwm.com/",
    "Origin": "https://www.tikwm.com"
};

Sparky({
    name: "timg",
    alias: ["ttimg", "slideshow", "ttphoto"],
    category: "download",
    desc: "Download TikTok Media safely with Anti-Block & Empty Video protection"
}, async ({ client, m, args }) => {
    try {
        const tiktokUrl = Array.isArray(args) ? args[0] : args;

        if (!tiktokUrl || !tiktokUrl.includes("tiktok.com")) {
            return m.reply("_මචං කරුණාකරලා වලංගු TikTok ලින්ක් එකක් දාපන්!_");
        }

        await m.react("⏳");
        await client.sendPresenceUpdate('composing', m.jid);

        console.log(`\n[TIKTOK BYPASS] ⚡ Fetching data with Anti-Block headers...`);
        
        // 1. API එකට බ්‍රවුසර් හෙඩර්ස් එක්ක Timeout එකක් දාලා රික්වෙස්ට් එක යැවීම
        const response = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`, {
            headers: BYPASS_HEADERS,
            timeout: 10000 // තත්පර 10කින් API එක රෙස්පොන්ස් නොකලොත් කැන්සල් කරනවා
        });

        const result = response.data;

        if (!result || result.code !== 0 || !result.data) {
            await m.react("❌");
            return m.reply("❌ *මචං TikWM සර්වර් එකෙන් මේ වෙලාවේ රික්වෙස්ට් එක බ්ලොක් කළා. විනාඩියක් ඉඳලා ආයෙ ට්‍රැයි කරපන්!*");
        }

        const data = result.data;
        const videoUrl = data.play;

        if (!videoUrl) {
            await m.react("❌");
            return m.reply("❌ *මචං මේ ලින්ක් එක ඇතුලේ වීඩියෝවක් හෝ ෆොටෝ ස්ලයිඩ්ෂෝ එකක් සොයාගන්න නැහැ.*");
        }

        console.log(`\n[TIKTOK BYPASS] 📥 Downloading actual video into RAM Buffer...`);

        // 2. වීඩියෝ ෆයිල් එක බාගැනීම (මෙතනටත් බයිපාස් හෙඩර්ස් අනිවාර්යයි)
        const videoStream = await axios.get(videoUrl, {
            responseType: 'arraybuffer',
            headers: BYPASS_HEADERS,
            timeout: 20000 // බාගන්න තත්පර 20ක් උපරිම දෙනවා
        });

        const videoBuffer = Buffer.from(videoStream.data);

        // 🛑 [CRITICAL PROTECTION] Empty (හිස්) හෝ Corrupted වීඩියෝ වැළැක්වීම
        // සාමාන්‍යයෙන් වීඩියෝ එකක් 10KB (10240 Bytes) වලට වඩා අඩු වෙන්න බැහැ. හිස් නම් එන්නේ 0 Bytes.
        if (!videoBuffer || videoBuffer.length < 10240) { 
            console.log(`[TIKTOK WARNING] 🛑 Empty Buffer detected! Size: ${videoBuffer?.length || 0} bytes`);
            await m.react("❌");
            return m.reply("❌ *මචං සර්වර් එකෙන් ආවේ හිස් (Empty) වීඩියෝ එකක්. GitHub IP එක සයිට් එකෙන් තාවකාලිකව බ්ලොක් කරලා. කරුණාකරලා ආයෙ පාරක් කමාන්ඩ් එක දීලා බලන්න!*");
        }

        await m.react("✅");
        const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`\n[TIKTOK BYPASS] 🚀 Sending valid video file (${fileSizeMB} MB) to WhatsApp...`);
        
        // 3. සාර්ථකව WhatsApp වෙත යැවීම
        return await client.sendMessage(m.jid, {
            video: videoBuffer,
            caption: `✨ *TikTok Media Downloaded Successfully!* 🎬\n\n🎵 *Song:* ${data.music_info?.title || "Unknown"}\n👤 *Creator:* ${data.author?.nickname || "Unknown"}\n🛡️ *Anti-Block Status:* Passed (${fileSizeMB} MB)`,
            mimetype: 'video/mp4'
        }, { quoted: m });

    } catch (error) {
        console.log(`\n[🚨 TIKTOK BYPASS ERROR] Details:`, error.message);
        await m.react("❌");
        
        // නෙට්වර්ක් බ්ලොක් එකක් ආවොත් Workflow එක ක්‍රෑෂ් කරන්නේ නැතුව යූසර්ට පණිවිඩය දීම
        return m.reply(`❌ *මචං නෙට්වර්ක් සම්බන්ධතා දෝෂයක් ආවා!* \n_\`Error: ${error.message}\`_\n\n*විසඳුම:* පොඩ්ඩක් ඉඳලා ආයෙත් උත්සාහ කරන්න.`);
    }
});
