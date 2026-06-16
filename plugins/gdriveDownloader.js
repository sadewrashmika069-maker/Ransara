// lib/gdriveDownloader.js
const axios = require("axios");

const GDRIVE_API_TOKEN = "VK4fry";
const GDRIVE_API_BASE = "https://whiteshadow-x-api.onrender.com/api/download/gdrive";

/**
 * Google Drive link එකක් සාර්ථකව download කර buffer එකක් ලෙස ලබා දෙයි.
 */
async function downloadGoogleDriveFile(driveUrl) {
    // 1. File ID එක extract කරන්න
    let fileId = null;
    let match = driveUrl.match(/\/file\/d\/([^\/]+)/);
    if (match) fileId = match[1];
    else {
        match = driveUrl.match(/[?&]id=([^&]+)/);
        if (match) fileId = match[1];
    }
    if (!fileId) throw new Error("Could not extract file ID from URL");

    // 2. WhiteShadow API call
    const apiUrl = `${GDRIVE_API_BASE}?url=${encodeURIComponent(driveUrl)}&apitoken=${GDRIVE_API_TOKEN}`;
    let data;
    try {
        const response = await axios.get(apiUrl, { timeout: 20000 });
        data = response.data;
    } catch (err) {
        console.error("WhiteShadow API error:", err.message);
        // API fail උනොත් direct download උත්සාහ කරමු
        data = null;
    }

    let downloadUrl = data?.downloadUrl || data?.download_url || data?.url || null;
    let fileName = data?.fileName || data?.file_name || data?.filename || `gdrive_${fileId}.mp4`;

    // 3. API එකෙන් downloadUrl ලැබුනේ නැත්නම්, direct Google Drive URL එකක් හදමු
    if (!downloadUrl) {
        // confirm=t එක එකතු කරන්න (large files සඳහා අවශ්‍ය)
        downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
        console.log(`[GDrive] Using direct URL: ${downloadUrl}`);
    }

    // 4. ගොනුව download කරමු (proper headers සහ redirect handling)
    let buffer, contentType;
    let attempt = 0;
    const maxAttempts = 3;
    let currentUrl = downloadUrl;

    while (attempt < maxAttempts) {
        try {
            const response = await axios.get(currentUrl, {
                responseType: 'arraybuffer',
                timeout: 180000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                maxRedirects: 5,
                validateStatus: (status) => status < 400
            });

            buffer = Buffer.from(response.data);
            contentType = response.headers['content-type'] || '';

            // HTML response එකක්ද?
            if (contentType.includes('text/html')) {
                const htmlPreview = buffer.slice(0, 2000).toString();
                console.log(`[GDrive] HTML preview: ${htmlPreview.substring(0, 200)}...`);

                // Google Drive confirm page එකක්ද?
                const confirmMatch = htmlPreview.match(/confirm=([^&"'\s]+)/);
                if (confirmMatch) {
                    const confirmCode = confirmMatch[1];
                    currentUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=${confirmCode}`;
                    console.log(`[GDrive] Found confirm code, retrying: ${currentUrl}`);
                    attempt++;
                    continue;
                }

                // quota exceeded?
                if (htmlPreview.includes('quota') || htmlPreview.includes('limit')) {
                    throw new Error("Download quota exceeded. Try again later.");
                }

                throw new Error("Received HTML instead of file. Manual download required.");
            }

            // File size check
            if (buffer.length < 5000) {
                console.warn(`[GDrive] File too small (${buffer.length} bytes), retrying...`);
                attempt++;
                continue;
            }

            // සාර්ථකයි!
            console.log(`[GDrive] Downloaded ${buffer.length} bytes`);
            return {
                buffer: buffer,
                fileName: fileName,
                fileSize: (buffer.length / (1024 * 1024)).toFixed(2)
            };

        } catch (err) {
            console.error(`[GDrive] Attempt ${attempt + 1} failed:`, err.message);
            attempt++;
            if (attempt >= maxAttempts) {
                throw new Error(`GDrive download failed after ${maxAttempts} attempts: ${err.message}`);
            }
            // Wait before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    throw new Error("GDrive download failed: Max retries exceeded");
}

module.exports = { downloadGoogleDriveFile };
