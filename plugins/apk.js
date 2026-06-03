// commands/apk.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

const API_TOKEN = "VK4fry";
const API_BASE = "https://whiteshadow-x-api.onrender.com/api";

Sparky({
    name: "apk",
    alias: ["apkdl", "getapk"],
    category: "download",
    fromMe: isPublic,
    desc: "📲 Download APK files from Aptoide (WhatsApp, etc.)"
}, async ({ client, m, args }) => {
    let query = getQuery(args);
    if (!query) {
        return m.reply(`📲 *APK Downloader (Aptoide)*\n\n*Usage:* ${m.prefix}apk <app name>\n*Example:* ${m.prefix}apk whatsapp`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔍 Searching for "${query}" on Aptoide...`);

    try {
        // 1. Search
        const searchUrl = `${API_BASE}/search/aptoide?q=${encodeURIComponent(query)}&apitoken=${API_TOKEN}`;
        const searchRes = await axios.get(searchUrl, { timeout: 15000 });

        // Check if API call succeeded and has data
        if (!searchRes.data?.success || !searchRes.data?.data?.length) {
            throw new Error("No apps found");
        }

        // Find the best match (exact match or first result)
        let bestMatch = searchRes.data.data[0];
        // Try to find exact match by package name or title
        const exactMatch = searchRes.data.data.find(app => 
            app.package === query.toLowerCase() || 
            app.title.toLowerCase() === query.toLowerCase()
        );
        if (exactMatch) bestMatch = exactMatch;

        const packageName = bestMatch.package;
        const appName = bestMatch.title;
        const appSize = bestMatch.size;

        await m.reply(`✅ *Found:* ${appName}\n📦 Size: ${appSize}\n⬇️ Downloading APK...`);

        // 2. Download using the package name
        const downloadUrl = `${API_BASE}/download/aptoide?package=${packageName}&apitoken=${API_TOKEN}`;
        const downloadRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            maxRedirects: 5,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const buffer = Buffer.from(downloadRes.data);
        if (buffer.length < 100000) throw new Error("Downloaded file too small (invalid APK)");

        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        const fileName = `${appName.replace(/[^a-z0-9]/gi, '_')}.apk`;

        const caption = `📲 *${appName}*\n📦 Size: ${fileSizeMB} MB\n📥 *APK ready for installation*\n\n> *Powered by Aptoide*`;

        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: "application/vnd.android.package-archive",
            fileName: fileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");

    } catch (error) {
        console.error("APK error:", error);
        await m.react("❌");
        let errMsg = `❌ *APK Download Failed*\n\n`;
        if (error.message.includes("No apps found")) {
            errMsg += `No results for "${query}".\nTry using a different name or exact package name.\nExample: ${m.prefix}apk com.whatsapp`;
        } else {
            errMsg += `📝 Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errMsg);
    }
});
