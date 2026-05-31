const { Sparky } = require("../lib");
const axios = require("axios");

// 🌐 YouTube සර්වර් බ්ලොක් මඟහැරීමට Headers
const BYPASS_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*"
};

Sparky({
    name: "song",
    alias: ["play", "ytmp3", "music"],
    category: "download",
    desc: "Download high-quality YouTube audio by song name or link"
}, async ({ client, m, args }) => {
    try {
        // 1. යූසර් ටයිප් කරපු සින්දුවේ නම හෝ ලින්ක් එක එකතු කර ගැනීම
        const query = Array.isArray(args) ? args.join(" ") : args;

        if (!query) {
            return m.reply("_මචං කරුණාකරලා සින්දුවක නමක් හෝ YouTube ලින්ක් එකක් දාපන්!_ \n\n*Example:* `.song Alone Alan Walker` හෝ `.song https://youtu.be/xxxxxx`");
        }

        await m.react("⏳");
        await client.sendPresenceUpdate('composing', m.jid);

        console.log(`[SONG CMD] ⚡ Searching and fetching direct download link for: ${query}`);

        // 🔥 YouTube Throttling බයිපාස් කරපු, සැනෙකින් Direct MP3 CDN Link එක දෙන API එක
        const apiUrl = `https://api.dreaded.site/api/ytdl?url=${encodeURIComponent(query)}`;
        const res = await axios.get(apiUrl, { timeout: 10000 });

        if (!res.data || !res.data.success || !res.data.result || !res.data.result.audio) {
            await m.react("❌");
            return m.reply("❌ *මචං මේ සින්දුව සොයාගන්න ලැබුණේ නැහැ. කරුණාකරලා අකුරු නිවැරදිව ආයෙ ටයිප් කරලා බලන්න!*");
        }

        const ytData = res.data.result;
        const downloadUrl = ytData.audio; // Direct MP3 URL එක

        console.log(`[SONG CMD] 📥 Streaming audio directly to RAM Buffer...`);

        // 🚀 කිසිම physical disk එකක් පාවිච්චි නොකර කෙලින්ම GitHub Actions RAM Buffer එකට බාගැනීම
        const audioStream = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            headers: BYPASS_HEADERS,
            timeout: 25000 // බාගන්න තත්පර 25ක් උපරිම දෙනවා
        });

        const audioBuffer = Buffer.from(audioStream.data);

        // 🛑 Empty File Protection
        if (!audioBuffer || audioBuffer.length < 5000) {
            await m.react("❌");
            return m.reply("❌ *මචං ලැබුණු ඕඩියෝ ෆයිල් එක සර්වර් එකෙන් කැන්සල් කරලා. කරුණාකරලා ආයෙ පාරක් ට්‍රැයි කරන්න!*");
        }

        await m.react("✅");
        const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
        console.log(`[SONG CMD] 🚀 Sending high-quality audio document (${fileSizeMB} MB) to WhatsApp...`);

        // 📤 සින්දුවේ Quality එක (Bitrate) බහින්නේ නැති වෙන්න WhatsApp Document එකක් විදිහට යැවීම
        return await client.sendMessage(m.jid, {
            document: audioBuffer,
            mimetype: 'audio/mpeg',
            fileName: `${ytData.title || "Song"}.mp3`,
            caption: `🎵 *Title:* ${ytData.title || "Unknown YouTube Audio"}\n📦 *Size:* ${fileSizeMB} MB\n🛡️ *Speed Status:* Turbo Downloaded`
        }, { quoted: m });

    } catch (error) {
        console.log(`[🚨 SONG CMD ERROR] Details:`, error.message);
        await m.react("❌");
        return m.reply(`❌ *මචං සින්දුව ඩවුන්ලෝඩ් වීමේදී දෝෂයක් වුණා!* \n_\`Error: ${error.message}\`_`);
    }
});
