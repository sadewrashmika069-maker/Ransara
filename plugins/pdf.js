const { Sparky, isPublic } = require("../lib");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

Sparky({
    name: "pdf",
    category: "misc",
    fromMe: isPublic,
    desc: "Converts a replied image into a high-quality PDF document"
}, async ({ client, m }) => {
    let tempImg = null;
    let tempPdf = null;
    
    try {
        // 🔍 රිප්ලයි කරපු මැසේජ් එකක් තියෙනවද සහ ඒක ෆොටෝ එකක්ද කියලා බලනවා
        const isImage = m.quoted && (m.quoted.mimetype?.startsWith("image/") || m.quoted.msg?.mimetype?.startsWith("image/"));
        
        if (!isImage) {
            return await m.reply("_❌ කරුණාකර PDF එකක් බවට හරවන්න ඕනේ ෆොටෝ එකකට Reply කරලා .pdf ගහන්න!_");
        }

        await m.react("📄"); // 📄 ඉමෝජි එකෙන් වැඩේ පටන් ගත්තා කියලා පෙන්වනවා

        // 📥 ෆොටෝ එක සර්වර් එකට ඩවුන්ලෝඩ් කරගන්නවා
        const media = await m.quoted.download().catch(() => null);
        
        if (!media) {
            await m.react("❌");
            return await m.reply("_❌ ෆොටෝ එක ඩවුන්ලෝඩ් කරගැනීමේ ගැටලුවක් ඇතිවුණා!_");
        }

        // 📂 ටෙම්පරි ෆයිල් පාත් හදාගන්නවා
        tempImg = path.join(__dirname, `temp_pdf_img_${Date.now()}.jpg`);
        tempPdf = path.join(__dirname, `temp_pdf_out_${Date.now()}.pdf`);
        
        fs.writeFileSync(tempImg, media);

        // 🛠️ PDF එක නිර්මාණය කිරීම ආරම්භ කරනවා (Standard A4 Page, No Margins)
        const doc = new PDFDocument({ size: "A4", margin: 0 });
        const writeStream = fs.createWriteStream(tempPdf);
        
        doc.pipe(writeStream);

        // 🎨 ෆොටෝ එක A4 පිටුවට හරියටම මැදිවෙලා ෆිට් වෙන විදිහට (Fit to Page) සකසනවා
        doc.image(tempImg, 0, 0, {
            fit: [595.28, 841.89],
            align: "center",
            valign: "center"
        });
        
        doc.end();

        // ⏳ PDF එක සම්පූර්ණයෙන්ම සර්වර් එකේ ලියලා ඉවර වෙනකන් පොඩ්ඩක් ඉන්නවා
        writeStream.on("finish", async () => {
            try {
                const pdfBuffer = fs.readFileSync(tempPdf);

                // 🗑️ වැඩේ ඉවර වුණු ගමන් ටෙම්පරි ෆයිල්ස් ඩිලීට් කරනවා Storage ඉතුරු වෙන්න
                if (fs.existsSync(tempImg)) fs.unlinkSync(tempImg);
                if (fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);

                await m.react("✅");

                // 📤 හදපු PDF එක වට්ස්ඇප් එකට Document එකක් විදිහට යවනවා
                return await client.sendMessage(m.jid, {
                    document: pdfBuffer,
                    mimetype: "application/pdf",
                    fileName: `SADEW-MD_${Date.now()}.pdf`
                }, { quoted: m });

            } catch (innerError) {
                throw innerError;
            }
        });

    } catch (error) {
        console.error("PDF Tools Error:", error);
        await m.react("❌");
        
        // 🗑️ එරර් එකක් ආවත් ටෙම්පරි ෆයිල්ස් ක්ලීන් කරනවා
        if (tempImg && fs.existsSync(tempImg)) fs.unlinkSync(tempImg);
        if (tempPdf && fs.existsSync(tempPdf)) fs.unlinkSync(tempPdf);
        
        // 📝 ඔයා ඉල්ලපු විදිහටම සම්පූර්ණ සිස්ටම් එරර් එක ලස්සනට වට්ස්ඇප් එකට එනවා මචං
        let errorMsg = `_❌ PDF System Error:_\n\`\`\`${error.message || error}\`\`\`\n\n`;
        errorMsg += `*📊 Debug Info:*\n`;
        errorMsg += `• Error Code: \`${error.code || "UNKNOWN"}\`\n\n`;
        errorMsg += `*💡 ෂුවර් එකටම මේවා කලාද බලන්න:* \n`;
        errorMsg += `1. \`package.json\` එකට \`"pdfkit"\` පැකේජ් එක ඇතුලත් කරලා GitHub එකට Push කරාද?\n`;
        errorMsg += `2. සර්වර් එක අලුතෙන් Build වෙලා ඉවර වෙනකන් විනාඩියක් විතර ඉඳලා ආයේ ට්‍රැයි කරන්න මචං.`;
        
        return await m.reply(errorMsg);
    }
});