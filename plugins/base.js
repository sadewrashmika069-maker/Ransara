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
        if (!m.quoted) {
            return await m.reply("_❌ කරුණාකර ඕඩියෝ එකකට හෝ වොයිස් නෝට් එකකට Reply කරලා .bass ගහන්න!_");
        }

        await m.react("🎧");

        const media = await m.quoted.download().catch(() => null);
        
        if (!media) {
            await m.react("❌");
            return await m.reply("_❌ ඕඩියෝ එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා!_");
        }

        const tempIn = path.join(__dirname, `temp_in_${Date.now()}.mp3`);
        const tempOut = path.join(__dirname, `temp_out_${Date.now()}.mp3`);

        fs.writeFileSync(tempIn, media);

        // FFmpeg Bass Boost Command
        const ffmpegCmd = `ffmpeg -i "${tempIn}" -af "bass=g=15,volume=1.2" "${tempOut}" -y`;

        exec(ffmpegCmd, async (err, stdout, stderr) => {
            if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);

            if (err) {
                console.error("FFmpeg Raw Error:", err);
                await m.react("❌");
                // 🛠️ ඇත්තම එරර් එක වට්ස්ඇප් එකටම එවන්න හැදුවා මචං
                return await m.reply(`_❌ FFmpeg System Error:_\n\`\`\`${err.message}\`\`\``);
            }

            const audioBuffer = fs.readFileSync(tempOut);
            await m.sendMsg(m.jid, audioBuffer, { quoted: m, mimetype: 'audio/mpeg' }, "audio");
            await m.react("✅");

            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        });

    } catch (error) {
        console.error(error);
        await m.react("❌");
        m.reply(error.message || error);
    }
});
