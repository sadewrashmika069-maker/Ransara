const axios = require('axios');

cmd({
    pattern: "img2",
    alias: ["pinterest2", "pimg"],
    desc: "Download 20 High Quality Images from Pinterest split into 2 horizontal batches.",
    category: "download",
    use: '.img2 <search_query>',
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, args, q, reply }) => {
    try {
        // 1. සර්ච් කරන්න ඕන දේ ඇතුළත් කරලාද බලනවා
        if (!q) return reply("⚠️ කරුණාකර සර්ච් කරන්න ඕන දේ ඇතුළත් කරන්න!\n*උදාහරණ:* .img2 anime boy");

        await reply("🔍 *Pinterest එකෙන් ඔයා ඉල්ලපු ෆොටෝ ටික හොයනවා... පොඩ්ඩක් ඉන්න මචං!*");

        // 2. WhiteShadow API එකට Request එක යවනවා
        const apiUrl = `https://whiteshadow-x-api.onrender.com/api/search/pinterest?q=${encodeURIComponent(q)}&apitoken=VK4fry`;
        const response = await axios.get(apiUrl);
        
        // API එකෙන් එන රිසල්ට් Array එක ගන්නවා (සාමාන්‍යයෙන් response.data.result හෝ response.data විදිහට එන්නේ)
        const results = response.data.result || response.data;

        if (!results || results.length === 0) {
            return reply("❌ කණගාටුයි, ඒ නමින් ෆොටෝ කිසිවක් හමු වුණේ නැහැ!");
        }

        // 3. උපරිම ඉමේජ් 20ක් විතරක් වෙන් කරලා ගන්නවා
        const top20Images = results.slice(0, 20);

        // 4. ඔයා ඉල්ලපු විදිහට 10 ගානේ කෑලි දෙකකට (Batches) වෙන් කරනවා
        const firstBatch = top20Images.slice(0, 10);
        const secondBatch = top20Images.slice(10, 20);

        // ==== පළවෙනි ඉමේජ් 10 යැවීම (Batch 1) ====
        await reply(`📸 *"${q}" පළමු ෆොටෝ 10 (Batch 1/2) මෙන්න:*`);
        for (const imgUrl of firstBatch) {
            await conn.sendMessage(from, { 
                image: { url: imgUrl }, 
                caption: `✨ Sadew-X-MD | Batch 1` 
            }, { quoted: mek });
            
            // සර්වර් එක crash නොවෙන්න සහ WhatsApp block නොවෙන්න පොඩි ඩිලේ (Delay) එකක් දානවා
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        // ==== දෙවෙනි ඉමේජ් 10 යැවීම (Batch 2) ====
        if (secondBatch.length > 0) {
            await reply(`📸 *"${q}" ඉතිරි ෆොටෝ 10 (Batch 2/2) මෙන්න:*`);
            for (const imgUrl of secondBatch) {
                await conn.sendMessage(from, { 
                    image: { url: imgUrl }, 
                    caption: `✨ Sadew-X-MD | Batch 2` 
                }, { quoted: mek });
                
                await new Promise(resolve => setTimeout(resolve, 600));
            }
        }

        await reply("✅ *ෆොටෝ 20ම සාර්ථකව යවා නිම කරලා තියෙන්නේ මචං!*");

    } catch (error) {
        console.error(error);
        reply("⚠️ API එකේ අවුලක් හෝ මොකක් හරි Error එකක් ආවා. පස්සේ උත්සාහ කරන්න!");
    }
});
