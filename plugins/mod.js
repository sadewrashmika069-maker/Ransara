const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

// Helper to extract query from args
function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    return "";
}

const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const API_BASE = "https://api.zanta-mini.store/api/modapk";

// 🔴 1. Global Context එක හැදීම (Reply අල්ලගන්න)
if (!global.modContexts) global.modContexts = {};

// ==========================================
// 🔥 SEARCH COMMAND (.mod)
// ==========================================
Sparky({
    name: "mod",
    category: "download",
    fromMe: isPublic,
    desc: "🎮 Search and download MOD APK games (AN1.com)"
}, async ({ client, m, args }) => {
    let query = getQuery(args);
    
    if (!query) {
        return m.reply(`🎮 *MOD APK Downloader*\n\n*භාවිතය:*\n• ${m.prefix}mod <game name>\n\n*උදාහරණ:*\n${m.prefix}mod subway surfers`);
    }

    await m.react("🔍");
    await client.sendPresenceUpdate('composing', m.jid);

    try {
        let searchRes = await axios.get(`${API_BASE}/search?apiKey=${API_KEY}&url=${encodeURIComponent(query)}`, { timeout: 15000 });
        if (!searchRes.data?.success || !searchRes.data?.result?.length) throw new Error("No results found");

        let results = searchRes.data.result.slice(0, 10);
        let listMsg = `🎮 *MOD APK Results*\n🔍 *${query}*\n📊 *Found:* ${results.length}\n\n`;
        
        results.forEach((game, i) => {
            listMsg += `*${i+1}.* ${game.title}\n👤 ${game.developer || "Unknown"} | ⭐ ${game.rating || "N/A"}\n\n`;
        });
        
        listMsg += `_💡 App එක Download කිරීමට අදාළ අංකය මෙම පණිවිඩයට Reply කරන්න._`;

        // 🔴 2. මැසේජ් එක යවලා ID එක අල්ලගන්නවා
        let sentMsg = await client.sendMessage(m.jid, { text: listMsg }, { quoted: m });

        // 🔴 3. ID එකයි රිසල්ට්ස් ටිකයි සේව් කරනවා
        global.modContexts[m.sender] = { 
            quotedId: sentMsg.key.id, 
            results: results 
        };

        // විනාඩි 5කින් Auto Clear වෙන්න හදනවා
        setTimeout(() => {
            if (global.modContexts[m.sender]) delete global.modContexts[m.sender];
        }, 5 * 60 * 1000);

        await m.react("📑");
        
    } catch (err) {
        console.error("Search error:", err);
        await m.react("❌");
        m.reply(`❌ Search failed: ${err.message.substring(0, 100)}`);
    }
});

// ==========================================
// 🔥 DYNAMIC REPLY LISTENER (ඩවුන්ලෝඩ් එක)
// ==========================================
Sparky({
    on: "text",
    fromMe: isPublic,
    dontAddCommandList: true
}, async ({ client, m }) => {
    let context = global.modContexts[m.sender];
    
    if (!context || !m.quoted) return;

    // රිප්ලයි කරලා තියෙන්නේ සර්ච් ලිස්ට් එකටමද බලනවා
    if (m.quoted.key.id === context.quotedId) {
        let num = parseInt(m.text.trim());
        
        if (!isNaN(num) && num >= 1 && num <= context.results.length) {
            let selected = context.results[num - 1];
            let gameUrl = encodeURIComponent(selected.url);
            let gameTitle = selected.title;

            await m.react("⏳");
            await client.sendPresenceUpdate('composing', m.jid);
            await client.sendMessage(m.jid, { text: `📥 Downloading *${gameTitle}* ...\n*මෙයට සුළු වේලාවක් ගත විය හැක, රැඳී සිටින්න.*` }, { quoted: m });

            try {
                // APK ලින්ක් එක ගන්නවා
                let dlRes = await axios.get(`${API_BASE}/dl?apiKey=${API_KEY}&url=${gameUrl}`, { timeout: 15000 });
                if (!dlRes.data?.success || !dlRes.data?.download_url) throw new Error("No download link");

                // APK එක Download කරනවා (Buffer)
                let apkRes = await axios.get(dlRes.data.download_url, {
                    responseType: 'arraybuffer',
                    timeout: 90000, // ලොකු ෆයිල් නිසා තත්පර 90ක් දීලා තියෙනවා
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });

                let buffer = Buffer.from(apkRes.data);
                let sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
                if (buffer.length < 500000) throw new Error("File too small");

                let fileName = `${gameTitle.replace(/[^a-z0-9]/gi, '_')}.apk`;
                let caption = `🎮 *${gameTitle}* [MOD]\n📦 Size: ${sizeMB} MB\n\n> 💫 Powered by SADEW-MD`;

                // Document එකක් විදිහට යවනවා
                await client.sendMessage(m.jid, {
                    document: buffer,
                    mimetype: "application/vnd.android.package-archive",
                    fileName: fileName,
                    caption: caption
                }, { quoted: m });

                await m.react("✅");
                
                // වැඩේ ඉවර නිසා Context එක මකනවා
                delete global.modContexts[m.sender]; 

            } catch (err) {
                console.error("Download error:", err);
                await m.react("❌");
                m.reply(`❌ Download failed: ${err.message.substring(0, 100)}`);
            }
        }
    }
});
