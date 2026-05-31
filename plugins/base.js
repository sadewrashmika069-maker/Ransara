const { Sparky, isPublic } = require("../lib");
const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

Sparky({
    name: "bass",
    category: "misc",
    fromMe: isPublic,
    desc: "Boosts the bass of a replied audio or voice note"
}, async ({ client, m }) => {
    try {
        // 🔍 රිප්ලයි එකක් තියෙනවද කියලා විතරක් මුලින්ම බලනවා
        if (!m.quoted) {
            return await m.reply("_❌ කරුණාකර ඕඩියෝ එකකට හෝ වොයිස් නෝට් එකකට Reply කරලා .bass ගහන්න!_");
        }

        await m.react("🎧"); // වැඩේ පටන් ගත්තා කියලා හෙඩ්ෆෝන් එකෙන් රියැක්ට් කරනවා

        // 📥 මීඩියා එක කෙලින්ම ඩවුන්ලෝඩ් කරන්න ට්‍රයි කරනවා (Validation ඔක්කොම අයින් කරා)
        const media = await m.quoted.download().catch(() => null);
        
        if (!media) {
            await m.react("❌");
            return await m.reply("_❌ ඕඩියෝ එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා! කරුණාකර වලංගු ඕඩියෝ එකකට රිප්ලයි කරන්න._");
        }

        // 📂 ටෙම්පරි ෆයිල් පාත් සෙට් කරගන්නවා
        const tempIn = path.join(__dirname, `temp_in_${Date.now()}.mp3`);
        const tempOut = path.join(__dirname, `temp_out_${Date.now()}.mp3`);

        // 💾 බෆර් එක ෆයිල් එකක් විදිහට සේව් කරනවා
        fs.writeFileSync(tempIn, media);

        // ⚡ FFmpeg එකෙන් බේස් එක 15dB වලින් බූස්ට් කරන කමාන්ඩ් එක
        const ffmpegCmd = `ffmpeg -i "${tempIn}" -af "bass=g=15,volume=1.2" "${tempOut}" -y`;

        exec(ffmpegCmd, async (err) => {
            // 🗑️ ඉන්පුට් ෆයිල් එක ක්ලීන් කරනවා
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);

            if (err) {
                console.error(err);
                await m.react("❌");
                return await m.reply("_❌ බේස් එක එකතු කරන්න ගිය වෙලාවේ සිස්ටම් අවුලක් වුණා!_");
            }

            // 🎵 අලුත් බේස් ඕඩියෝ එක කියවනවා
            const audioBuffer = fs.readFileSync(tempOut);

            // 📤 ඕඩියෝ එකක් විදිහට ආපහු යවනවා
            await m.sendMsg(m.jid, audioBuffer, { quoted: m, mimetype: 'audio/mpeg' }, "audio");
            await m.react("✅");

            // 🗑️ අවුට්පුට් ටෙම්පරි ෆයිල් එකත් ක්ලීන් කරනවා
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        });

    } catch (error) {
        console.error(error);
        await m.react("❌");
        m.reply(error.message || error);
    }
});
