const { Sparky } = require("../lib");
const axios = require("axios");

Sparky({
    pattern: "img2",
    alias: ["pinterest2", "pimg"],
    desc: "Download 20 High Quality Images from Pinterest split into 2 horizontal batches using RAM Buffers.",
    category: "download",
    use: '.img2 nature',
    filename: __filename
},
async (conn, mek, m, options) => {
    // 1. Framework එකෙන් එන ඔප්ෂන්ස් ආරක්ෂිතව ගන්නවා
    const { from, q, reply, args, body } = options || {};
    
    // 2. Chat JID එක ක්‍රම කිහිපයකින්ම චෙක් කරලා ගන්නවා (කවදාවත් මිස් වෙන්නේ නැහැ)
    const chatJid = from || (m && m.chat) || (mek && mek.key && mek.key.remoteJid);
    
    // 3. සර්ච් කරපු වචනය ක්‍රම කිහිපයකින්ම වෙන් කරලා ගන්නවා
    let searchQuery = q || "";
    if (!searchQuery && args && args.length > 0) {
        searchQuery = args.join(" ");
    } else if (!searchQuery && body) {
        searchQuery = body.split(" ").slice(1).join(" ");
    }
    searchQuery = searchQuery ? searchQuery.trim() : "";

    // 4. හැම තැනකදීම වැඩ කරන සේෆ් රිප්ලයි ෆන්ක්ෂන් එකක් හදනවා
    const sendReply = async (text) => {
        if (typeof reply === "function") {
            return await reply(text);
        } else if (conn && chatJid) {
            return await conn.sendMessage(chatJid, { text: text }, { quoted: mek });
        }
    };

    // PM2 Terminal එකේ බලාගන්න දාන Log එකක්
    console.log(`[Sadew-MD] .img2 command triggered! Chat: ${chatJid}, Query: ${searchQuery}`);

    try {
        if (!chatJid) {
            console.log("[Sadew-MD] Error: Could not determine chat JID.");
            return;
        }

        // සර්ච් ලොජික් එක චෙක් කිරීම
        if (!searchQuery) {
            return await sendReply("⚠️ කරුණාකර සර්ච් කරන්න ඕන දේ ඇතුළත් කරන්න!\n*උදාහරණ:* .img2 nature");
        }

        await sendReply("🔍 *Pinterest එකෙන් ඔයා ඉල්ලපු ෆොටෝ ටික හොයනවා... පොඩ්ඩක් ඉන්න මචං!*");

        const apiUrl = `https://whiteshadow-x-api.onrender.com/api/search/pinterest?q=${encodeURIComponent(searchQuery)}&apitoken=VK4fry`;
        console.log(`[Sadew-MD] Fetching API: ${apiUrl}`);
        
        const response = await axios.get(apiUrl);
        const results = response.data.result || response.data;

        if (!results || results.length === 0) {
            return await sendReply("❌ කණගාටුයි, ඒ නමින් ෆොටෝ කිසිවක් හමු වුණේ නැහැ!");
        }

        // උපරිම 20ක් වෙන් කර ගැනීම
        const top20Images = results.slice(0, 20);
        const firstBatch = top20Images.slice(0, 10);
        const secondBatch = top20Images.slice(10, 20);

        console.log(`[Sadew-MD] Sending ${top20Images.length} images in 2 horizontal batches.`);

        // ==== පළමෙනි ඉමේජ් 10 (Batch 1) ====
        await sendReply(`📸 *"${searchQuery}" පළමු ෆොටෝ 10 (Batch 1/2) මෙන්න:*`);
        for (const imgUrl of firstBatch) {
            try {
                // RAM Buffers වලින් කෙලින්ම GitHub Actions මත රන් වීම
                const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(imgRes.data);
                
                await conn.sendMessage(chatJid, { 
                    image: buffer, 
                    caption: `✨ ＳＡＤＥＷ－Ｘ－ＭＤ | Batch 1` 
                }, { quoted: mek });
            } catch (imgErr) {
                console.error("[Sadew-MD] Image download failed for URL:", imgUrl, imgErr.message);
            }
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        // ==== දෙවෙනි ඉමේජ් 10 (Batch 2) ====
        if (secondBatch.length > 0) {
            await sendReply(`📸 *"${searchQuery}" ඉතිරි ෆොටෝ 10 (Batch 2/2) මෙන්න:*`);
            for (const imgUrl of secondBatch) {
                try {
                    const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                    const buffer = Buffer.from(imgRes.data);
                    
                    await conn.sendMessage(chatJid, { 
                        image: buffer, 
                        caption: `✨ ＳＡＤＥＷ－Ｘ－ＭＤ | Batch 2` 
                    }, { quoted: mek });
                } catch (imgErr) {
                    console.error("[Sadew-MD] Image download failed for URL:", imgUrl, imgErr.message);
                }
                await new Promise(resolve => setTimeout(resolve, 600));
            }
        }

        await sendReply("✅ *ෆොටෝ 20ම සාර්ථකව යවා නිම කරලා තියෙන්නේ මචං!*");

    } catch (error) {
        console.error("[Sadew-MD] General Error in img2 command:", error);
        await sendReply("⚠️ API එකේ අවුලක් හෝ මොකක් හරි Error එකක් ආවා. පස්සේ උත්සාහ කරන්න!");
    }
});
