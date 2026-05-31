const { Sparky, isPublic } = require("../lib");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const FormData = require("form-data");

Sparky({
    name: "tourl",
    category: "misc",
    fromMe: isPublic,
    desc: "Converts replied media into a permanent URL link"
}, async ({ client, m }) => {
    let tempFile = null;
    try {
        // 🔍 රිප්ලයි එකක් තියෙනවද බලනවා
        if (!m.quoted) {
            return await m.reply("_❌ කරුණාකර ෆොටෝ එකකට, වීඩියෝ එකකට හෝ ඕඩියෝ එකකට Reply කරලා .tourl ගහන්න!_");
        }

        await m.react("🔗"); // 🔗 ඉමෝජි එකෙන් වැඩේ පටන් ගත්තා කියලා පෙන්වනවා

        // 📥 මීඩියා එක ඩවුන්ලෝඩ් කරගන්නවා
        const media = await m.quoted.download().catch(() => null);
        
        if (!media) {
            await m.react("❌");
            return await m.reply("_❌ මීඩියා එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා!_");
        }

        // 📂 ෆයිල් එකේ වර්ගය (Extension) අල්ලගෙන ටෙම්පරි ෆයිල් එකක් හදනවා
        const mime = m.quoted.mimetype || m.quoted.msg?.mimetype || "image/jpeg";
        const ext = mime.split("/")[1] || "jpeg";
        tempFile = path.join(__dirname, `temp_tourl_${Date.now()}.${ext}`);
        
        fs.writeFileSync(tempFile, media);

        // 🌐 Catbox API එකට Upload කරන්න FormData එක සකසනවා
        const bodyForm = new FormData();
        bodyForm.append("reqtype", "fileupload");
        bodyForm.append("fileToUpload", fs.createReadStream(tempFile));

        // 🚀 API එකට පෝස්ට් රික්වෙස්ට් එක දානවා
        const response = await axios.post("https://catbox.moe/user/api.php", bodyForm, {
            headers: {
                ...bodyForm.getHeaders(),
            },
        });

        // 🗑️ අප්ලෝඩ් වුණු ගමන් ටෙම්පරි ෆයිල් එක සර්වර් එකෙන් ඩිලීට් කරනවා
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

        // 🔗 ලින්ක් එක හරියට ආවද බලලා රිප්ලයි කරනවා
        if (response.data && response.data.includes("http")) {
            await m.react("✅");
            let successMsg = `*🔗 YOUR URL IS READY!* \n\n`;
            successMsg += `• *Link:* ${response.data.trim()}\n`;
            successMsg += `• *Size:* ${(media.length / (1024 * 1024)).toFixed(2)} MB`;
            return await m.reply(successMsg);
        } else {
            throw new Error("Invalid response from hosting server: " + response.data);
        }

    } catch (error) {
        console.error("Tourl Error:", error);
        await m.react("❌");
        
        // 🗑️ එරර් එකක් ආවත් ටෙම්පරි ෆයිල් එක ක්ලීන් කරනවා Space ඉතුරු වෙන්න
        if (tempFile && fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        
        // 📝 ඔයා ඉල්ලපු විදිහටම එරර් එක ලස්සනට වට්ස්ඇප් එකට එනවා මචං
        let errorMsg = `_❌ Tourl System Error:_\n\`\`\`${error.message || error}\`\`\`\n\n`;
        errorMsg += `*📊 Debug Info:*\n`;
        errorMsg += `• Error Code: \`${error.code || "UNKNOWN"}\`\n\n`;
        errorMsg += `*💡 පියවර:* සර්වර් එකේ ඉන්ටර්නෙට් බ්ලොක් එකක් හෝ \`axios\` / \`form-data\` පැකේජ් වල ගැටලුවක්දැයි ෂුවර් කරගන්න මචං.`;
        
        return await m.reply(errorMsg);
    }
});
