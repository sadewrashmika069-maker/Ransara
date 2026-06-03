// commands/apk.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");
const cheerio = require("cheerio"); // Needed for parsing HTML

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

// Helper: Get the latest WhatsApp version
async function getWhatsAppApkUrl() {
    try {
        const pageUrl = 'https://www.apkmirror.com/apk/whatsapp-inc/whatsapp/whatsapp-messenger-2-25-20-13-release/';
        const { data } = await axios.get(pageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const downloadLink = $('.tableWidget dd a').first().attr('href');
        if (!downloadLink) throw new Error('Download link not found');
        const fullUrl = `https://www.apkmirror.com${downloadLink}`;
        const { data: detailData } = await axios.get(fullUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $detail = cheerio.load(detailData);
        const apkLink = $detail('.downloadButton a').attr('href');
        if (!apkLink) throw new Error('APK link not found');
        return `https://www.apkmirror.com${apkLink}`;
    } catch (error) {
        console.error("APKMirror fetch failed:", error);
        return null;
    }
}

Sparky({
    name: "apk",
    alias: ["apkdl", "getapk"],
    category: "download",
    fromMe: isPublic,
    desc: "📲 Download APK files (WhatsApp, etc.) from APKMirror"
}, async ({ client, m, args }) => {
    let query = getQuery(args);
    if (!query) {
        return m.reply(`📲 *APK Downloader*\n\n*Usage:* ${m.prefix}apk <app name>\n*Example:* ${m.prefix}apk whatsapp`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    m.reply(`🔍 *Searching for APK of "${query}"...*`);

    try {
        let downloadUrl = null;
        let appName = query;

        // Special case for WhatsApp (most requested)
        if (query.toLowerCase().includes('whatsapp')) {
            const waUrl = await getWhatsAppApkUrl();
            if (waUrl) {
                downloadUrl = waUrl;
                appName = 'WhatsApp Messenger';
            } else {
                throw new Error('Failed to fetch WhatsApp APK link');
            }
        } else {
            throw new Error('Only WhatsApp is supported in this demo version.');
        }

        if (!downloadUrl) throw new Error('Could not generate download link');

        // Download APK buffer
        const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 60000,
            maxRedirects: 5
        });

        const buffer = Buffer.from(response.data);
        if (buffer.length < 10000) throw new Error('Downloaded file is too small (invalid APK)');

        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        const fileName = `${appName.replace(/[^a-z0-9]/gi, '_')}.apk`;

        const caption = `📲 *${appName}*\n📦 Size: ${fileSizeMB} MB\n📥 *APK file ready*\n\n> *Powered by APKMirror*`;

        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: 'application/vnd.android.package-archive',
            fileName: fileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");

    } catch (error) {
        console.error("APK download error:", error);
        await m.react("❌");
        let errMsg = `❌ *APK Download Failed*\n\n`;
        errMsg += `Could not fetch APK for "${query}".\n`;
        errMsg += `📝 Error: ${error.message.substring(0, 100)}`;
        await m.reply(errMsg);
    }
});
