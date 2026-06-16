// 5. DOWNLOAD & DIRECT SEND FUNCTION (WITH WS API BYPASS)
async function downloadAndSendAnime(client, m, finalUrl, qualityStr, animeTitle) {
    try {
        await m.react("⬇️");
        const metaQuote = getMetaQuote();
        let downloadUrl = finalUrl;

        // 🧠 WhiteShadow API Google Drive Bypass Logic
        if (finalUrl.includes("drive.google.com")) {
            await m.reply(`🔄 Google Drive ගොනුවක් හඳුනාගත්තා!\n_WhiteShadow API හරහා Direct Link එක ලබාගනිමින්..._`);
            try {
                // API එකට ගිහින් ලින්ක් එක අරගන්නවා
                const wsApiUrl = `https://whiteshadow-x-api.onrender.com/api/download/gdrive?url=${encodeURIComponent(finalUrl)}&apitoken=VK4fry`;
                const wsRes = await axios.get(wsApiUrl, { timeout: 25000 });
                const wsData = wsRes.data;

                // මෙතන තමයි API එකෙන් එන විවිධ JSON formats අල්ලගන්න තැන
                if (wsData) {
                    // සාමාන්‍යයෙන් API වල එන පොදු කීස් ටික බලනවා
                    downloadUrl = wsData.downloadUrl || wsData.url || wsData.link || wsData.direct_link || 
                                 (wsData.data && (wsData.data.url || wsData.data.downloadUrl)) || 
                                 (wsData.result && (wsData.result.url || wsData.result.downloadUrl)) || 
                                 finalUrl;
                }
            } catch (wsErr) {
                console.error("WhiteShadow API Error:", wsErr);
                // API එක වැඩ කළේ නැත්නම් ෆයිල් එක ලොකු වෙන්න පුළුවන්, ඉතිං Direct Link එකම යවනවා
            }
        }

        await client.sendMessage(m.jid, { text: `📥 *Uploading Anime:* ${animeTitle}\n⚙️ *Quality:* ${qualityStr}\n\n_කරුණාකර රැඳී සිටින්න, WhatsApp වෙත Upload වෙමින් පවතී..._` }, { quoted: metaQuote });

        const safeTitle = animeTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim();
        const caption = `🎌 *${animeTitle}*\n⚙️ *Quality:* ${qualityStr}\n\n*${BOT_NAME}*\n_${POWERED_BY}_`;

        // මෙතැනදී කෙලින්ම Document විදිහට පටවනවා
        await client.sendMessage(m.jid, {
            document: { url: downloadUrl },
            mimetype: "video/mp4",
            fileName: `${safeTitle} - ${qualityStr}.mp4`,
            caption: caption
        }, { quoted: metaQuote });

        await m.react("✅");

    } catch (err) {
        console.error("Direct Upload Error:", err);
        await m.react("⚠️");
        // Upload ෆේල් වුණොත් අන්තිම බලාපොරොත්තුව විදිහට Direct Link එක යවනවා
        await m.reply(`⚠️ Upload අසාර්ථක විය (සමහරවිට ගොනුව විශාල වැඩි නිසා).\n\n🔗 *බාගත කිරීම සඳහා සබැඳිය:* ${finalUrl}`);
    }
}
