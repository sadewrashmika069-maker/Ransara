Sparky({
    name: "x",
    alias: ["xdown", "xsearch"],
    fromMe: isPublic,
    category: "downloader",
    desc: "Search and download from XNXX using Zanta API",
},
async ({ m, client, args }) => {
    try {
        let query = args || m.quoted?.text;
        if (!query) return await m.reply("*කරුණාකර සෙවිය යුතු පදයක් ඇතුළත් කරන්න! (උදා: .x sri lanka)*");

        await m.react('🔎');
        
        // 1. 🔥 SEARCH API CALL
        // ඔයා දීපු ලින්ක් එකේ සර්ච් කරන්නත් පාවිච්චි කරලා තියෙන්නේ url= කියන එක නිසා ඒ විදිහටම දැම්මා මචං
        const searchUrl = `https://api.zanta-mini.store/api/xnxx/search?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(query)}`;
        const searchResponse = await axios.get(searchUrl);
        
        // API එකෙන් එන දත්ත ව්‍යුහය (Structure) අනුව Array එක වෙන් කරගන්නවා
        const results = searchResponse.data?.result || searchResponse.data?.data || searchResponse.data;
        
        if (!results || results.length === 0) {
            await m.react('❌');
            return await m.reply("_ප්‍රතිඵල කිසිවක් හමු වුණේ නැත!_");
        }
        
        // පළමු රිසල්ට් එකේ වීඩියෝ ලින්ක් එක (e.g. xnxx.com/video-...) ලබා ගැනීම
        const videoUrl = results[0]?.link || results[0]?.url;
        if (!videoUrl) {
            await m.react('❌');
            return await m.reply("_වීඩියෝ ලින්ක් එක සොයාගත නොහැකි විය!_");
        }

        await m.react('⬇️');
        
        // 2. 🔥 DOWNLOAD API CALL
        const downloadApiUrl = `https://api.zanta-mini.store/api/xnxx/dl?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(videoUrl)}`;
        const downloadResponse = await axios.get(downloadApiUrl);
        
        const dlData = downloadResponse.data?.result || downloadResponse.data?.data || downloadResponse.data;
        
        // වීඩියෝ එකේ සැබෑ ඩිරෙක්ට් ඩවුන්ලෝඩ් ලින්ක් එක සහ ටයිටල් එක වෙන් කර ගැනීම
        // API එක අනුව ලින්ක් එක එන කී (Key) එක වෙනස් වෙන්න පුළුවන් නිසා බහුලව පාවිච්චි වන ඒවා දැම්මා
        const directDownloadLink = dlData?.files?.high || dlData?.url || dlData?.download || dlData?.direct_link;
        const videoTitle = dlData?.title || "XNXX Video";

        if (!directDownloadLink) {
            // කෝඩ් එකේ ලින්ක් එක අහුවෙන්නේ නැත්නම් ටර්මිනල් එකේ බලාගන්න Response එක ලොග් කරා
            console.log("[Zanta-API Debug]:", JSON.stringify(downloadResponse.data));
            await m.react('❌');
            return await m.reply("_Direct Download Link එක ලබා ගැනීමට නොහැකි විය!_");
        }

        // 3. 🔥 WHATSAPP UPLOAD
        // බොට්ගේ තියෙන සර්වර් එකෙන් කෙලින්ම වට්සැප් එකට වීඩියෝ එක අප්ලෝඩ් කරනවා
        await m.sendFromUrl(directDownloadLink, { caption: `🎥 *${videoTitle}*` });
        await m.react('✅');

    } catch (error) {
        await m.react('❌');
        console.error("XNXX Command Error:", error);
        return m.reply(`_Error: ${error.message || error}_`);
    }
});
