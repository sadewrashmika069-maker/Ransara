// commands/apk.js (debug version)
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
    desc: "📲 Download APK files from Aptoide"
}, async ({ client, m, args }) => {
    let query = getQuery(args);
    if (!query) {
        return m.reply(`📲 *APK Downloader*\n\n*Usage:* ${m.prefix}apk <app name>\n*Example:* ${m.prefix}apk whatsapp`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔍 Searching for "${query}"...`);

    try {
        // 1. Search
        const searchUrl = `${API_BASE}/search/aptoide?q=${encodeURIComponent(query)}&apitoken=${API_TOKEN}`;
        const searchRes = await axios.get(searchUrl, { timeout: 15000 });

        if (!searchRes.data?.success || !searchRes.data?.data?.length) {
            throw new Error("No apps found");
        }

        let bestMatch = searchRes.data.data[0];
        const exactMatch = searchRes.data.data.find(app => 
            app.package === query.toLowerCase() || 
            app.title.toLowerCase() === query.toLowerCase()
        );
        if (exactMatch) bestMatch = exactMatch;

        const packageName = bestMatch.package;
        const appName = bestMatch.title;
        const appSize = bestMatch.size;

        await m.reply(`✅ *Found:* ${appName}\n📦 Size: ${appSize}\n⬇️ Fetching download link...`);

        // 2. Try to get download URL (the API might return JSON with a direct link)
        const downloadUrl = `${API_BASE}/download/aptoide?package=${packageName}&apitoken=${API_TOKEN}`;
        
        // First, try with responseType 'json' to see if we get a direct link
        try {
            const jsonRes = await axios.get(downloadUrl, { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
            console.log("[APK] Download API response (JSON):", JSON.stringify(jsonRes.data, null, 2));
            
            // If response contains a download URL, use it
            if (jsonRes.data && jsonRes.data.download_url) {
                const directUrl = jsonRes.data.download_url;
                await m.reply(`✅ Got direct link. Downloading APK...`);
                const apkRes = await axios.get(directUrl, {
                    responseType: 'arraybuffer',
                    timeout: 60000,
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    maxRedirects: 5
                });
                const buffer = Buffer.from(apkRes.data);
                if (buffer.length < 100000) throw new Error("Downloaded file too small");
                const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
                const fileName = `${appName.replace(/[^a-z0-9]/gi, '_')}.apk`;
                const caption = `📲 *${appName}*\n📦 Size: ${fileSizeMB} MB\n📥 *APK ready*\n\n> *Powered by Aptoide*`;
                await client.sendMessage(m.jid, { document: buffer, mimetype: "application/vnd.android.package-archive", fileName: fileName, caption: caption }, { quoted: m });
                await m.react("✅");
                return;
            }
        } catch (e) {
            console.log("[APK] JSON request failed, trying binary download...");
        }

        // 3. If no JSON, try to download directly as binary
        const apkRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 60000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 5
        });

        const buffer = Buffer.from(apkRes.data);
        console.log(`[APK] Downloaded buffer size: ${buffer.length} bytes, content-type: ${apkRes.headers['content-type']}`);

        // Check if response is HTML or error (size too small or content-type text/html)
        if (buffer.length < 100000 || (apkRes.headers['content-type'] || '').includes('text/html')) {
            // Log first 500 bytes to see what's returned
            const preview = buffer.slice(0, 500).toString('utf-8');
            console.log("[APK] Response preview:", preview);
            throw new Error(`Invalid APK response (maybe HTML or error). Size: ${buffer.length} bytes`);
        }

        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        const fileName = `${appName.replace(/[^a-z0-9]/gi, '_')}.apk`;
        const caption = `📲 *${appName}*\n📦 Size: ${fileSizeMB} MB\n📥 *APK ready*\n\n> *Powered by Aptoide*`;

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
        if (error.message.includes("No apps")) {
            errMsg += `No results for "${query}".\nTry using exact package name: ${m.prefix}apk com.whatsapp`;
        } else {
            errMsg += `📝 Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errMsg);
    }
});
