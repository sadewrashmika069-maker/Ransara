// commands/gdrive.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

const API_TOKEN = "VK4fry";
const API_BASE = "https://whiteshadow-x-api.onrender.com/api/download/gdrive";

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

// Function to extract file ID from various Google Drive URL formats
function extractFileId(url) {
    // Pattern for: https://drive.google.com/file/d/FILE_ID/view
    let match = url.match(/\/file\/d\/([^\/]+)/);
    if (match) return match[1];
    
    // Pattern for: https://drive.google.com/open?id=FILE_ID
    match = url.match(/[?&]id=([^&]+)/);
    if (match) return match[1];
    
    // Pattern for: https://drive.google.com/uc?id=FILE_ID
    match = url.match(/[?&]id=([^&]+)/);
    if (match) return match[1];
    
    // Pattern for: short URLs like https://drive.google.com/.../FILE_ID
    match = url.match(/\/d\/([^\/]+)/);
    if (match) return match[1];
    
    return null;
}

Sparky({
    name: "gdrive",
    alias: ["gd", "googledrive"],
    category: "download",
    fromMe: isPublic,
    desc: "📁 Google Drive file එකක් ඩවුන්ලෝඩ් කරන්න"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`📁 *Google Drive Downloader*

*Usage:* ${m.prefix}gdrive <google_drive_link>
*Example:* ${m.prefix}gdrive https://drive.google.com/file/d/xxxxx/view

*Supports:* Google Drive file links (public or shared)`);
    }

    // Validate URL
    if (!url.includes("drive.google.com")) {
        return m.reply(`❌ *Invalid URL*\n\nPlease provide a valid Google Drive link.\nExample: https://drive.google.com/file/d/xxxxx/view`);
    }

    // Extract file ID for better validation
    const fileId = extractFileId(url);
    if (!fileId) {
        return m.reply(`❌ *Invalid Google Drive URL*\n\nCould not extract file ID from the URL. Please check the link and try again.`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔍 *Processing Google Drive file...*\n📎 File ID: ${fileId}`);

    try {
        // Call the WhiteShadow API
        const apiUrl = `${API_BASE}?url=${encodeURIComponent(url)}&apitoken=${API_TOKEN}`;
        const response = await axios.get(apiUrl, { timeout: 20000 });
        const data = response.data;

        // Check if API returned an error
        if (!data || data.success !== true) {
            const errorMsg = data?.error || "Unknown error occurred";
            throw new Error(errorMsg);
        }

        // Extract download URL from response
        const downloadUrl = data.download_url || data.result?.download_url;
        const fileName = data.file_name || data.result?.file_name || `gdrive_${fileId}`;
        const fileSize = data.file_size || data.result?.file_size || null;

        if (!downloadUrl) {
            throw new Error("No download URL received from API");
        }

        await m.reply(`📥 *Downloading file...*\n📄 File: ${fileName}${fileSize ? `\n📦 Size: ${fileSize}` : ''}\n⏳ Please wait...`);

        // Download the actual file
        const fileRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: { 'User-Agent': 'Mozilla/5.0' },
            maxRedirects: 5
        });

        const buffer = Buffer.from(fileRes.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length < 5000) {
            throw new Error("Downloaded file is too small. The link might be invalid.");
        }

        // Determine MIME type and extension
        let ext = '';
        let mimetype = 'application/octet-stream';
        const contentType = fileRes.headers['content-type'] || '';
        
        if (contentType.includes('image')) {
            mimetype = contentType;
            ext = contentType.split('/')[1] || 'jpg';
        } else if (contentType.includes('video')) {
            mimetype = contentType;
            ext = contentType.split('/')[1] || 'mp4';
        } else if (contentType.includes('pdf')) {
            mimetype = 'application/pdf';
            ext = 'pdf';
        } else if (contentType.includes('zip')) {
            mimetype = 'application/zip';
            ext = 'zip';
        } else if (contentType.includes('apk')) {
            mimetype = 'application/vnd.android.package-archive';
            ext = 'apk';
        } else {
            // Try to get extension from filename
            const nameParts = fileName.split('.');
            ext = nameParts.length > 1 ? nameParts.pop() : 'file';
            mimetype = `application/${ext}`;
        }

        const finalFileName = `${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const caption = `📁 *Google Drive Download Complete*\n\n📄 *File:* ${fileName}\n📦 *Size:* ${fileSizeMB} MB\n🔗 *File ID:* ${fileId}\n\n> *Powered by WhiteShadow API*`;

        // Send as document (works for all file types)
        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: mimetype,
            fileName: finalFileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        await m.reply(`✅ *Download complete!* (${fileSizeMB} MB)`);

    } catch (error) {
        console.error("GDrive error:", error);
        await m.react("❌");
        
        let errorMsg = `❌ *Download failed*\n\n`;
        if (error.message.includes("Invalid URL") || error.message.includes("Not a Google Drive link")) {
            errorMsg += `The link is not a valid Google Drive URL.\nPlease make sure the link is correct and the file is shared publicly.`;
        } else if (error.message.includes("not found") || error.message.includes("404")) {
            errorMsg += `File not found. The link might be broken or the file has been removed.`;
        } else if (error.message.includes("timeout")) {
            errorMsg += `The download took too long. Please try again later.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
