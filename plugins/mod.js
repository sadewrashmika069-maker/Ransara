// commands/mod.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

// Helper: safely extract query from args
function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const API_BASE = "https://api.zanta-mini.store/api/modapk";

// Global session store (clears after 5 minutes)
if (!global.modSessions) global.modSessions = new Map();

// Main search command
Sparky({
    name: "mod",
    alias: ["modapk", "modgame"],
    category: "download",
    fromMe: isPublic,
    desc: "🎮 Search and download MOD APK games from AN1.com"
}, async ({ client, m, args }) => {
    const query = getQuery(args);
    if (!query) {
        return m.reply(`🎮 *MOD APK Downloader*\n\n*Usage:* ${m.prefix}mod <game name>\n*Example:* ${m.prefix}mod hill climb racing\n*Example:* ${m.prefix}mod subway surfers`);
    }

    await m.react("🔍");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔎 Searching for "${query}"...`);

    try {
        // Search API call
        const searchUrl = `${API_BASE}/search?apiKey=${API_KEY}&url=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, { timeout: 15000 });

        if (!data?.success || !data?.result?.length) {
            throw new Error("No results found");
        }

        const results = data.result.slice(0, 10);
        let listMsg = `🎮 *MOD APK Search Results*\n\n`;
        listMsg += `🔍 *Query:* ${query}\n`;
        listMsg += `📊 *Found:* ${results.length} games\n\n`;
        results.forEach((game, idx) => {
            listMsg += `${idx+1}. *${game.title}*\n`;
            listMsg += `   👤 ${game.developer || "Unknown"} | ⭐ ${game.rating || "N/A"}\n\n`;
        });
        listMsg += `📌 *How to download:*\nReply to this message with the game number (e.g., "1")`;

        const sentMsg = await client.sendMessage(m.jid, { text: listMsg }, { quoted: m });

        // Save session
        global.modSessions.set(m.sender, {
            step: "awaiting_selection",
            results: results,
            msgId: sentMsg.key.id,
            timestamp: Date.now()
        });
        // Auto clear after 5 minutes
        setTimeout(() => global.modSessions.delete(m.sender), 300000);

        await m.react("✅");
    } catch (error) {
        console.error("MOD search error:", error);
        await m.react("❌");
        m.reply(`❌ *Search failed*\n\n${error.message.substring(0, 100)}`);
    }
});

// Handle number replies (without prefix)
Sparky({
    name: "mod_reply",
    pattern: /^\d+$/,
    dontPrefix: true,
    fromMe: false,
    dontAddCommandList: true,
    desc: "Internal MOD reply handler"
}, async ({ client, m, args }) => {
    const user = m.sender;
    const session = global.modSessions.get(user);
    if (!session || session.step !== "awaiting_selection") return;

    // Must be a reply to the correct message
    if (!m.quoted || m.quoted.key.id !== session.msgId) return;

    const num = parseInt(args[0]);
    if (isNaN(num) || num < 1 || num > session.results.length) {
        return m.reply(`❌ Invalid number. Please choose 1-${session.results.length}.`);
    }

    const selected = session.results[num - 1];
    const gameUrl = encodeURIComponent(selected.url);
    const gameTitle = selected.title;

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`✅ *Selected:* ${gameTitle}\n⬇️ Getting download link...`);

    try {
        const dlUrl = `${API_BASE}/dl?apiKey=${API_KEY}&url=${gameUrl}`;
        const dlRes = await axios.get(dlUrl, { timeout: 15000 });

        if (!dlRes.data?.success || !dlRes.data?.download_url) {
            throw new Error("No download URL received from API");
        }

        const downloadUrl = dlRes.data.download_url;
        await m.reply(`📥 Downloading APK file... (this may take a moment)`);

        const apkRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 90000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            maxRedirects: 5
        });

        const buffer = Buffer.from(apkRes.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length < 500000) {
            throw new Error(`Downloaded file too small (${fileSizeMB} MB). Invalid APK.`);
        }

        const fileName = `${gameTitle.replace(/[^a-z0-9]/gi, '_')}.apk`;
        const caption = `🎮 *${gameTitle}* [MOD APK]\n📦 Size: ${fileSizeMB} MB\n📥 *File ready for installation*\n\n> *Powered by AN1.com*`;

        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: "application/vnd.android.package-archive",
            fileName: fileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        global.modSessions.delete(user); // Clear session on success

    } catch (error) {
        console.error("MOD download error:", error);
        await m.react("❌");
        m.reply(`❌ *Download failed*\n\n${error.message.substring(0, 150)}`);
    }
});

// Optional: Cancel command to clear session
Sparky({
    name: "cancelmod",
    category: "tools",
    fromMe: isPublic,
    desc: "❌ Cancel active MOD APK search"
}, async ({ client, m }) => {
    const user = m.sender;
    if (global.modSessions.has(user)) {
        global.modSessions.delete(user);
        m.reply("✅ MOD search session cancelled.");
    } else {
        m.reply("⚠️ No active MOD search session.");
    }
});
