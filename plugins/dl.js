// commands/dl.js
const { Sparky, isPublic } = require("../lib");
const { downloadFile } = require("../lib/downloader");
const config = require("../config");

// List of supported media types for content detection
const mediaExtensions = {
    'video': ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', '3gp'],
    'image': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'],
    'audio': ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']
};

// Extract the direct video URL from a social media link using a free API
async function extractDirectUrl(url) {
    try {
        // Using a free API that works without a key (takes any social media link)
        const response = await axios.get(`https://p.oceansaver.in/ajax/download.php?url=${encodeURIComponent(url)}&apiKey=KiY9mrR7`);
        return response.data;
    } catch (error) {
        console.error('API error:', error);
        throw new Error('Could not extract download link. The service might be temporarily unavailable.');
    }
}

Sparky({
    name: "dl",
    alias: ["download", "get"],
    category: "download",
    fromMe: isPublic,
    desc: "📥 Direct media downloader from YouTube, Instagram, Facebook, TikTok, and more."
}, async ({ client, m, args }) => {
    try {
        // Get the link from the command
        const input = args.join(" ").trim();
        if (!input) {
            return m.reply(
                "📌 *Download Media*\n\n" +
                "Send a media link to download.\n" +
                "Example: `.dl https://youtu.be/example`\n\n" +
                "Supported sites: YouTube, Instagram, Facebook, TikTok, Twitter, Pinterest"
            );
        }

        // Check if it's a valid URL
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        if (!urlPattern.test(input)) {
            return m.reply("❌ Invalid URL. Please send a valid media link.");
        }

        await m.react("⏳");
        await client.sendPresenceUpdate('composing', m.jid);

        // Get the direct download link using the API
        const result = await extractDirectUrl(input);
        
        if (!result || !result.success || !result.download_url) {
            await m.react("❌");
            return m.reply("Failed to get download link. Platform might not be supported.");
        }

        const downloadUrl = result.download_url;
        const mediaType = result.type || 'video';

        // Show the user we're downloading the file
        let statusMsg = `📥 *Downloading ${mediaType}...*\n`;
        statusMsg += `🔗 ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}\n`;
        statusMsg += `⏳ Please wait, downloading the file.`;
        
        const status = await client.sendMessage(m.jid, { text: statusMsg }, { quoted: m });

        // Download the file buffer using our helper function
        const fileBuffer = await downloadFile(downloadUrl);
        
        // Prepare the file name and caption
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const title = result.title || `download_${timestamp}`;
        
        let caption = `✅ *Download Complete!*\n`;
        caption += `📁 *File:* ${title}\n`;
        caption += `📦 *Size:* ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB`;

        // Send the file based on its type
        if (mediaType === 'video' || fileBuffer.length > 30 * 1024 * 1024) { // Send large files as documents
            await client.sendMessage(m.jid, {
                document: fileBuffer,
                mimetype: 'video/mp4',
                fileName: `${title}.mp4`,
                caption: caption
            }, { quoted: m });
        } else if (mediaType === 'image') {
            await client.sendMessage(m.jid, {
                image: fileBuffer,
                caption: caption
            }, { quoted: m });
        } else if (mediaType === 'audio') {
            await client.sendMessage(m.jid, {
                audio: fileBuffer,
                mimetype: 'audio/mpeg',
                ptt: false
            }, { quoted: m });
        } else {
            // Default: send as a document
            await client.sendMessage(m.jid, {
                document: fileBuffer,
                fileName: `${title}.mp4`,
                caption: caption
            }, { quoted: m });
        }

        // Clean up: delete the status message
        await client.sendMessage(m.jid, { delete: status.key });
        await m.react("✅");

    } catch (error) {
        console.error("Download command error:", error);
        await m.react("❌");
        
        let errorMsg = "⚠️ *Download Failed*\n\n";
        if (error.message.includes("large")) {
            errorMsg += "File is too large to download. WhatsApp has a 100MB limit.";
        } else if (error.message.includes("extract")) {
            errorMsg += "Could not extract the download link. The service might be busy. Please try again later.";
        } else {
            errorMsg += `Error: ${error.message.substring(0, 100)}`;
        }
        await m.reply(errorMsg);
    }
});
