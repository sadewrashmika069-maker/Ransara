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
    desc: "📁 Google Drive file එකක් ඩවුන්ලෝඩ් කරන්න"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`📁 *Google Drive Downloader*

*Usage:* ${m.prefix}gdrive <google_drive_link>
*Example:* ${m.prefix}gdrive https://drive.google.com/file/d/xxxxx/view

*Note:* Files larger than 100MB may fail due to WhatsApp limits.`);
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

        // Extract download URL - check all possible field names
        let downloadUrl = data.downloadUrl ||      // CamelCase (from actual API)
                          data.download_url ||     // Underscore
                          data.url ||              // Simple url
                          data.result?.downloadUrl ||
                          data.result?.download_url ||
                          data.result?.url;

        const fileName = data.fileName ||          // CamelCase
                        data.file_name ||          // Underscore
                        data.filename ||
                        data.result?.fileName ||
                        data.result?.file_name ||
                        `gdrive_${fileId}`;

        const fileSize = data.fileSize ||          // CamelCase
                        data.file_size ||          // Underscore
                        data.size ||
                        data.result?.fileSize ||
                        data.result?.file_size ||
                        null;

        if (!downloadUrl) {
            throw new Error("No download URL received from API");
        }

        // Validate URL
        if (!downloadUrl.startsWith("http")) {
            console.warn("[GDrive] Invalid download URL format:", downloadUrl);
            throw new Error("Invalid download URL format");
        }

        // Check file size (if available)
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

        // If file is larger than 100MB, warn user
        if (sizeMB > 2000 || (fileSize && fileSize.toString().includes('GB'))) {
            await m.reply(`⚠️ *File is large (${sizeMB.toFixed(2)} MB)*\nWhatsApp may not accept files larger than 100MB.\nAttempting to send as document...`);
        }

        await m.reply(`📥 *Downloading file...*\n📄 File: ${fileName}${fileSize ? `\n📦 Size: ${fileSize}` : ''}\n⏳ Please wait...`);

        // Download the actual file
        const fileRes = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*'
            },
            maxRedirects: 5
        });

        const buffer = Buffer.from(fileRes.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        // Check if we got an HTML page instead of a file
        const contentType = fileRes.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
            const htmlPreview = buffer.slice(0, 2000).toString();
            if (htmlPreview.includes('quota') || htmlPreview.includes('limit')) {
                throw new Error("Download quota exceeded. Try again later.");
            }
            throw new Error("Received HTML instead of file. The link may require authentication.");
        }

        if (buffer.length < 10000) {
            const preview = buffer.toString('utf8').substring(0, 500);
            if (preview.includes('error') || preview.includes('quota') || preview.includes('limit')) {
                throw new Error("Download quota exceeded.");
            }
            throw new Error("Downloaded file is too small. The link might be invalid.");
        }

        // WhatsApp document limit check
        if (buffer.length > 100 * 1024 * 1024) {
            await m.reply(`⚠️ *File is ${fileSizeMB} MB (exceeds 2000MB limit)*\nWhatsApp cannot send files larger than 100MB.\nSending download link instead...`);
            
            // Send the download link as text
            const linkMsg = `📁 *Google Drive File*\n\n📄 *File:* ${fileName}\n📦 *Size:* ${fileSizeMB} MB\n🔗 *Download Link:* ${downloadUrl}\n\n⚠️ *File is larger than 100MB.*\nPlease download using the link above.`;
            await client.sendMessage(m.jid, { text: linkMsg }, { quoted: m });
            await m.react("⚠️");
            return;
        }

        // Determine file extension
        let ext = 'file';
        let mimetype = 'application/octet-stream';
        
        // Try to get extension from filename
        const nameParts = fileName.split('.');
        if (nameParts.length > 1) {
            ext = nameParts.pop().toLowerCase();
        }

        // Set mimetype based on extension
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
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };
        mimetype = extMimeMap[ext] || 'application/octet-stream';

        const finalFileName = `${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

        const caption = `📁 *Google Drive Download Complete*\n\n📄 *File:* ${fileName}\n📦 *Size:* ${fileSizeMB} MB\n🔗 *File ID:* ${fileId}\n\n> *Powered by WhiteShadow API*`;

        // Send as document
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
        if (error.message.includes("quota") || error.message.includes("limit") || error.message.includes("too many")) {
            errorMsg += `Google Drive download limit reached.\n\n💡 *Solutions:*\n1. Try again after a few minutes\n2. Use a different Google Drive link`;
        } else if (error.message.includes("permission") || error.message.includes("publicly accessible")) {
            errorMsg += `File is not publicly accessible.\n\n💡 Make sure the file is shared with "Anyone with the link".`;
        } else if (error.message.includes("100MB") || error.message.includes("large")) {
            errorMsg += `File is larger than 100MB.\n\n💡 WhatsApp cannot send files larger than 100MB.\nTry downloading from the browser instead.`;
        } else if (error.message.includes("HTML")) {
            errorMsg += `The link requires login or verification.\n\n💡 Make sure the file is publicly shared.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
