const { Sparky } = require("../lib");
const axios = require("axios");

Sparky({
    pattern: "img2",
    alias: ["pinterest2", "pimg"],
    desc: "Download 20 High Quality Images from Pinterest split into 2 horizontal batches using RAM Buffers.",
    category: "download",
    use: '.img2 <search_query>',
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, args, q, reply }) => {
    try {
        // 1. සර්ච් කරන්න ඕන දේ ඇතුළත් කරලාද බලනවා
        if (!q) return reply("⚠️ කරුණාකර සර්ච් කරන්න ඕන දේ ඇතුළත් කරන්න!\n*උදාහරණ:* .img2 nature");

        await reply("🔍 *Pinterest එකෙන් ඔයා ඉල්ලපු ෆොටෝ ටික හොයනවා... පොඩ්ඩක් ඉන්න මචං!*");

        // 2. WhiteShadow API එකට Request එක යවනවා
        const apiUrl = `https://whiteshadow-x-api.onrender.com/api/search/pinterest?q=${encodeURIComponent(q)}&apitoken=VK4fry`;
        const response = await axios.get(apiUrl);
        
        // API එකෙන් එන රิසල්ට් Array එක ගන්නවා
        const results = response.data.result || response.data;

        if (!results || results.length === 0) {
            return reply("❌ කණගාටුයි, ඒ නමින් ෆොටෝ කිසිවක් හමු වුණේ නැහැ!");
        }

        // 3. උපරිම ඉමේජ් 20ක් විතරක් වෙන් කරලා ගන්නවා
        const top20Images = results.slice(0, 20);

        // 4. ඔයා කියපු ලොජික් එකට 10 ගානේ කෑලි දෙකකට (Batches) වෙන් කරනවා
        const firstBatch = top20Images.slice(0, 10);
        const secondBatch = top20Images.slice(10, 20);

        // ==== පළවෙනි ඉමේජ් 10 යැවීම (Batch 1) ====
        await reply(`📸 *"${q}" පළමු ෆොටෝ 10 (Batch 1/2) මෙන්න:*`);
        for (const imgUrl of firstBatch) {
            try {
                // GitHub Actions වල ඩිස්ක් එක සේෆ් කරන්න කෙලින්ම RAM Buffer එකකට ගන්නවා
                const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(imgRes.data);
                
                await conn.sendMessage(from, { 
                    image: buffer, 
                    caption: `✨ ＳＡＤＥＷ－Ｘ－ＭＤ | Batch 1` 
                }, { quoted: mek });
            } catch (imgErr) {
                console.error("Image download failed:", imgErr.message);
            }
            
            // WhatsApp Spam නොවෙන්න සහ සර්වර් එක ස්මූත් වෙන්න පොඩි ඩිලේ එකක්
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        // ==== දෙවෙනි ඉමේජ් 10 යැවීම (Batch 2) ====
        if (secondBatch.length > 0) {
            await reply(`📸 *"${q}" ඉතිරි ෆොටෝ 10 (Batch 2/2) මෙන්න:*`);
            for (const imgUrl of secondBatch) {
                try {
                    // මේකත් කෙලින්ම RAM Buffer එකෙන් යවන්නේ
                    const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(imgRes.data);
                    
                    await conn.sendMessage(from, { 
                        image: buffer, 
                        caption: `✨ ＳＡＤＥＷ－Ｘ－ＭＤ | Batch 2` 
                    }, { quoted: mek });
                } catch (imgErr) {
                    console.error("Image download failed:", imgErr.message);
                }
                
                await new Promise(resolve => setTimeout(resolve, 600));
            }
        }

        await reply("✅ *ෆොටෝ 20ම සාර්ථකව යවා නිම කරලා තියෙන්නේ මචං!*");

    } catch (error) {
        console.error(error);
        reply("⚠️ API එකේ අවුලක් හෝ මොකක් හරි Error එකක් ආවා. පස්සේ උත්සාහ කරන්න!");
    }
});
