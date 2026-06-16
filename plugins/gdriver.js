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

function extractFileId(url) {
    let match = url.match(/\/file\/d\/([^\/]+)/);
    if (match) return match[1];
    match = url.match(/[?&]id=([^&]+)/);
    if (match) return match[1];
    match = url.match(/\/d\/([^\/]+)/);
    if (match) return match[1];
    return null;
}

Sparky({
    name: "gdrive",
    alias: ["gd", "googledrive"],
    category: "download",
    fromMe: isPublic,
    desc: "📁 Google Drive file එකක් ඩවුන්ලෝඩ් කරන්න (up to 2GB)"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`📁 *Google Drive Downloader*

*Usage:* ${m.prefix}gdrive <google_drive_link>
*Example:* ${m.prefix}gdrive https://drive.google.com/file/d/xxxxx/view

*Supports files up to 2GB*`);
    }

    if (!url.includes("drive.google.com")) {
        return m.reply(`❌ *Invalid URL*\n\nPlease provide a valid Google Drive link.`);
    }

    const fileId = extractFileId(url);
    if (!fileId) {
        return m.reply(`❌ *Invalid Google Drive URL*\n\nCould not extract file ID.`);
    }

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔍 *Processing Google Drive file...*\n📎 File ID: ${fileId}`);

    try {
        // Call the WhiteShadow API
        const apiUrl = `${API_BASE}?url=${encodeURIComponent(url)}&apitoken=${API_TOKEN}`;
        const response = await axios.get(apiUrl, { timeout: 20000 });
        const data = response.data;

        console.log("[GDrive] API Response:", JSON.stringify(data, null, 2));

        // Check if API returned an error
        if (!data || data.success !== true) {
            const errorMsg = data?.error || data?.message || "Unknown API error";
            throw new Error(errorMsg);
        }

        // 🔥 FIX: Check for downloadUrl (camelCase) as the API returns
        let downloadUrl = data.downloadUrl ||   // API returns this!
                          data.download_url ||
                          data.url ||
                          data.result?.downloadUrl ||
                          data.result?.download_url ||
                          data.result?.url;

        const fileName = data.fileName ||        // API returns this!
                        data.file_name ||
                        data.filename ||
                        data.result?.fileName ||
                        data.result?.file_name ||
                        `gdrive_${fileId}`;

        const fileSize = data.fileSize ||        // API returns this!
                        data.file_size ||
                        data.size ||
                        data.result?.fileSize ||
                        data.result?.file_size ||
                        null;

        if (!downloadUrl) {
            throw new Error("No download URL received from API");
        }

        if (!downloadUrl.startsWith("http")) {
            console.warn("[GDrive] Invalid download URL format:", downloadUrl);
            throw new Error("Invalid download URL format");
        }

        // Parse file size
        let sizeMB = 0;
        if (fileSize) {
            if (typeof fileSize === 'string' && fileSize.includes('MB')) {
                sizeMB = parseFloat(fileSize);
            } else if (typeof fileSize === 'number') {
                sizeMB = fileSize / (1024 * 1024);
            } else if (typeof fileSize === 'string') {
                sizeMB = parseFloat(fileSize) || 0;
            }
        }

        // Check if file exceeds 2GB (WhatsApp document limit)
        if (sizeMB > 2000) {
            await m.reply(`❌ *File is too large!*\n📦 Size: ${sizeMB.toFixed(2)} MB\n⚠️ WhatsApp document limit is 2GB.`);
            await m.react("❌");
            return;
        }

        await m.reply(`📥 *Downloading file...*\n📄 File: ${fileName}${fileSize ? `\n📦 Size: ${fileSize}` : ''}\n⏳ Please wait...`);

        // Download the actual file
        const fileRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 180000, // 3 minutes for large files
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            },
            maxRedirects: 5
        });

        const buffer = Buffer.from(fileRes.data);
        const actualSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        // Check if we got an HTML page instead of a file
        const contentType = fileRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            const htmlPreview = buffer.slice(0, 2000).toString();
            if (htmlPreview.includes('quota') || htmlPreview.includes('limit')) {
                throw new Error("Download quota exceeded. Try again later.");
            }
            throw new Error("Received HTML instead of file.");
        }

        if (buffer.length < 10000) {
            throw new Error("Downloaded file is too small. The link might be invalid.");
        }

        // 🔥 WhatsApp document limit is 2GB (2000 MB)
        if (buffer.length > 2000 * 1024 * 1024) {
            await m.reply(`❌ *File is too large!*\n📦 Size: ${actualSizeMB} MB\n⚠️ WhatsApp document limit is 2GB.`);
            await m.react("❌");
            return;
        }

        // Determine file extension
        let ext = 'file';
        let mimetype = 'application/octet-stream';
        
        const nameParts = fileName.split('.');
        if (nameParts.length > 1) {
            ext = nameParts.pop().toLowerCase();
        }

        const extMimeMap = {
            'apk': 'application/vnd.android.package-archive',
            'mp4': 'video/mp4',
            'mkv': 'video/x-matroska',
            'avi': 'video/x-msvideo',
            'mov': 'video/quicktime',
            'mp3': 'audio/mpeg',
            'm4a': 'audio/mp4',
            'wav': 'audio/wav',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'pdf': 'application/pdf',
            'zip': 'application/zip',
            'rar': 'application/x-rar-compressed',
            '7z': 'application/x-7z-compressed',
            'txt': 'text/plain',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt': 'application/vnd.ms-powerpoint',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'srt': 'text/plain'
        };
        mimetype = extMimeMap[ext] || 'application/octet-stream';

        const finalFileName = `${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const caption = `📁 *Google Drive Download Complete*\n\n📄 *File:* ${fileName}\n📦 *Size:* ${actualSizeMB} MB\n🔗 *File ID:* ${fileId}\n\n> *Powered by WhiteShadow API*`;

        // Send as document
        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: mimetype,
            fileName: finalFileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        await m.reply(`✅ *Download complete!* (${actualSizeMB} MB)`);

    } catch (error) {
        console.error("GDrive error:", error);
        await m.react("❌");
        
        let errorMsg = `❌ *Download failed*\n\n`;
        if (error.message.includes("quota") || error.message.includes("limit")) {
            errorMsg += `Google Drive download limit reached.\n\n💡 Try again after a few minutes.`;
        } else if (error.message.includes("HTML")) {
            errorMsg += `File requires authentication.\n\n💡 Make sure the file is publicly shared.`;
        } else if (error.message.includes("2GB") || error.message.includes("too large")) {
            errorMsg += `File is larger than 2GB.\n\n💡 WhatsApp cannot send files larger than 2GB.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
