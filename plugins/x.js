const { Sparky, isPublic } = require("../lib");
const axios = require('axios');

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
        const searchUrl = `https://api.zanta-mini.store/api/xnxx/search?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(query)}`;
        const searchResponse = await axios.get(searchUrl);
        
        // API එකෙන් එන විවිධ දත්ත ව්‍යුහයන් චෙක් කිරීම
        const results = searchResponse.data?.result || searchResponse.data?.data || searchResponse.data;
        
        if (!results || (Array.isArray(results) && results.length === 0)) {
            await m.react('❌');
            return await m.reply("_ප්‍රතිඵල කිසිවක් හමු වුණේ නැත!_");
        }
        
        // පළමු රිසල්ට් එක වෙන් කර ගැනීම
        let firstResult = Array.isArray(results) ? results[0] : results;
        let videoUrl = "";

        // API එක කෙලින්ම Strings Array එකක් ["https://...", "https://..."] එවනවා නම්
        if (typeof firstResult === 'string') {
            videoUrl = firstResult;
        } else if (firstResult && typeof firstResult === 'object') {
            // Object එකක් විදිහට එවනවා නම් පොදු හැම Key එකක්ම චෙක් කරනවා
            videoUrl = firstResult.link || firstResult.url || firstResult.video || firstResult.href;
        }

        // ලින්ක් එක අහු වුණේ නැත්නම් චැට් එකටම JSON එක එවන්න හැදුවා ට්‍රබල්ෂූට් කරන්න ලේසි වෙන්න
        if (!videoUrl) {
            await m.react('❌');
            return await m.reply(`_වීඩියෝ ලින්ක් එක සොයාගත නොහැකි විය!_\n\n*API Response:* \`\`\`${JSON.stringify(searchResponse.data).slice(0, 400)}\`\`\``);
        }

        await m.react('⬇️');
        
        // 2. 🔥 DOWNLOAD API CALL
        const downloadApiUrl = `https://api.zanta-mini.store/api/xnxx/dl?apiKey=zan_FIAO7Ayh_eo1vllkep6&url=${encodeURIComponent(videoUrl)}`;
        const downloadResponse = await axios.get(downloadApiUrl);
        
        const dlData = downloadResponse.data?.result || downloadResponse.data?.data || downloadResponse.data;
        
        let directDownloadLink = "";
        let videoTitle = "XNXX Video";

        if (typeof dlData === 'string') {
            directDownloadLink = dlData;
        } else if (dlData && typeof dlData === 'object') {
            directDownloadLink = dlData.files?.high || dlData.files?.low || dlData.url || dlData.download || dlData.direct_link;
            videoTitle = dlData.title || "XNXX Video";
        }

        if (!directDownloadLink) {
            await m.react('❌');
            return await m.reply(`_Direct Download Link එක ලබා ගැනීමට නොහැකි විය!_\n\n*API Response:* \`\`\`${JSON.stringify(downloadResponse.data).slice(0, 400)}\`\`\``);
        }

        // 3. 🔥 WHATSAPP UPLOAD
        await m.sendFromUrl(directDownloadLink, { caption: `🎥 *${videoTitle}*` });
        await m.react('✅');

    } catch (error) {
        await m.react('❌');
        console.error("XNXX Command Error:", error);
        return m.reply(`_Error: ${error.message || error}_`);
    }
});
