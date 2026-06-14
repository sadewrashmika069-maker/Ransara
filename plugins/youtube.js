const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

// 🌐 WhiteShadow YT APIs & Token
const API_TOKEN = "VK4fry";
const YT_SEARCH_API = "https://whiteshadow-x-api.onrender.com/api/search/yt";
const YT_DOWNLOAD_API = "https://whiteshadow-x-api.onrender.com/api/download/ytmp3";

/**
 * 📱 යූටියුබ් මොබයිල් (youtu.be, shorts) සහ PC ලින්ක්ස් නිවැරදිව වෙන්කර හඳුනාගන්නා ශ්‍රිතය
 */
function extractYoutubeUrl(text) {
    const regex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[^\s?#]+)/i;
    const match = String(text || "").match(regex);
    return match ? match[0].trim() : null;
}

/**
 * 🎶 සින්දු සෙවීම සහ 320kbps MP3 ලබාදීම සිදුකරන ප්‍රධාන සිස්ටම් එක
 */
async function coreAudioDownloader({ m, client, args }) {
    // 🛡️ Fail-Safe Text Message Sender
    const sendMsg = async (text) => {
        try {
            if (typeof m.reply === "function") {
                await m.reply(text);
            } else {
                await client.sendMessage(m.jid, { text }, { quoted: m });
            }
        } catch (e) {
            console.error("[SADEW-MD MUSIC] Text reply failed:", e.message);
            try {
                await client.sendMessage(m.jid, { text });
            } catch (err) {
                console.error("[SADEW-MD MUSIC] Completely failed to send text:", err.message);
            }
        }
    };

    try {
        let textInput = Array.isArray(args) ? args.join(" ").trim() : String(args || "").trim();
        textInput = textInput || m.quoted?.text || "";

        if (!textInput) {
            return await sendMsg("🎵 කරුණාකර සින්දුවක නමක් හෝ YouTube ලින්ක් එකක් ලබා දෙන්න.\n\n💡 උදා: `.music master sir` හෝ `.music <link> හෝ `.song mithaya mayam`");
        }

        try { if (typeof m.react === "function") await m.react("🔎"); } catch {}

        // 1. පරිශීලකයා දුන්නේ ලින්ක් එකක්ද නැත්නම් නමක්ද කියා පරික්ෂා කිරිම
        const checkedUrl = extractYoutubeUrl(textInput);
        let youtubeUrl = null;
        let songTitle = "Sadew-MD Audio";

        if (checkedUrl) {
            // ඇතුළත් කළේ කෙලින්ම YouTube ලින්ක් එකක් නම්
            youtubeUrl = checkedUrl;
            console.log("[SADEW-MD MUSIC] Direct YouTube Link Detected:", youtubeUrl);
            await sendMsg("🔗 _YouTube direct link detected. Fetching data from server..._");
        } else {
            // ඇතුළත් කළේ සින්දුවක නමක් නම් (WhiteShadow YT Search API)
            await sendMsg(`🔍 _Searching YouTube for: "${textInput}"..._`);
            console.log("[SADEW-MD MUSIC] Searching YT for name:", textInput);

            try {
                const searchResponse = await axios.get(`${YT_SEARCH_API}?q=${encodeURIComponent(textInput)}&apitoken=${API_TOKEN}`, { timeout: 20000 });
                
                if (searchResponse.data?.success && searchResponse.data?.result?.length > 0) {
                    const bestResult = searchResponse.data.result[0];
                    youtubeUrl = bestResult.url;
                    songTitle = bestResult.title || "YouTube Audio";
                    console.log("[SADEW-MD MUSIC] Search success. Found URL:", youtubeUrl);
                }
            } catch (searchErr) {
                console.error("[SADEW-MD MUSIC] YT Search API Error:", searchErr.message);
            }
        }

        // යූටියුබ් ලින්ක් එකක් හොයාගන්න බැරි වුණොත්
        if (!youtubeUrl) {
            try { if (typeof m.react === "function") await m.react("❌"); } catch {}
            return await sendMsg("❌ *Error:* සින්දුව හෝ වීඩියෝව සොයා ගැනීමට නොහැකි විය. කරුණාකර නම නිවැරදිව ටයිප් කරන්න.");
        }

        // 2. 320kbps MP3 ලින්ක් එක ලබාගැනීම (WhiteShadow YTMP3 API)
        await sendMsg("📥 _ _*👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥*_ Extracting 320kbps High-Quality MP3 stream..._");
        console.log(`[SADEW-MD MUSIC] Triggering Downloader for: ${youtubeUrl}`);

        let audioDownloadUrl = null;
        let finalTitle = songTitle;

        try {
            const downloadResponse = await axios.get(`${YT_DOWNLOAD_API}?url=${encodeURIComponent(youtubeUrl)}&quality=320&apitoken=${API_TOKEN}`, { timeout: 40000 });
            
            if (downloadResponse.data?.success && downloadResponse.data?.result?.download_url) {
                audioDownloadUrl = downloadResponse.data.result.download_url;
                if (downloadResponse.data.result.title) {
                    finalTitle = downloadResponse.data.result.title;
                }
                console.log("[SADEW-MD MUSIC] API Download URL Success:", audioDownloadUrl);
            }
        } catch (dlErr) {
            console.error("[SADEW-MD MUSIC] YT Download API Error:", dlErr.message);
        }

        if (!audioDownloadUrl) {
            try { if (typeof m.react === "function") await m.react("❌"); } catch {}
            return await sendMsg("❌ *Error:* සේවාදායකයේ බිඳවැටීමක් හේතුවෙන් 320kbps ඕඩියෝ එක ලබා ගැනීමට නොහැකි විය.");
        }

        try { if (typeof m.react === "function") await m.react("📥"); } catch {}

        // 3. WhatsApp Audio පණිවිඩයක් ලෙස ජංගම දුරකථනයට යැවීම
        const cleanFileName = finalTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60) + ".mp3";
        
        await sendMsg(`✨ *_👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥_ Music System* ✨\n\n📌 *Title:* ${finalTitle}\n💿 *Quality:* 320kbps Ultra-High Quality\n🚀 *Status:* download via ~*👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥*~`);

        await client.sendMessage(
            m.jid,
            {
                audio: { url: audioDownloadUrl },
                mimetype: "audio/mpeg", // මොබයිල් ඩිවයිස් වල සුපිරියට වැඩ කරන්න
                ptt: false,             // සින්දුවක් විදිහටම යන්න
                fileName: cleanFileName
            },
            { quoted: m }
        );

        try { if (typeof m.react === "function") await m.react("✅"); } catch {}

    } catch (globalError) {
        console.error("[SADEW-MD MUSIC] CRITICAL GLOBAL ERROR:", globalError);
        try { if (typeof m.react === "function") await m.react("❌"); } catch {}
        await sendMsg(`❌ *Sadew-MD Music Internal Error:* ${globalError.message}`);
    }
}

// 🎧 Commands ලියාපදිංචි කිරීම (ඔයා ඉල්ලපු ඔක්කොම එකම සුපිරි ක්‍රමයට වැඩ කරයි)

Sparky({
    name: "song",
    fromMe: isPublic,
    category: "youtube",
    desc: "Search and download 320kbps MP3 audio via name or link."
}, coreAudioDownloader);

Sparky({
    name: "music",
    fromMe: isPublic,
    category: "youtube",
    desc: "Search and download 320kbps MP3 audio via name or link."
}, coreAudioDownloader);

Sparky({
    name: "yta",
    fromMe: isPublic,
    category: "youtube",
    desc: "Download YouTube audio via link (Supports PC and Mobile app links)."
}, coreAudioDownloader);
