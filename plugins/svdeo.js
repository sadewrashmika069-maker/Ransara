// commands/svideo.js
const { Sparky, isPublic } = require("../lib");
const puppeteer = require("puppeteer");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder-improved");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");

// Helper function to safely extract the URL from command arguments
function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

Sparky({
    name: "svideo",
    alias: ["webvideo", "scrollvideo"],
    category: "tools",
    fromMe: isPublic,
    desc: "📹 ඕනෑම වෙබ් අඩවියක් ස්ක්‍රෝල් කරලා Video එකක් හදාගන්න (MP4)"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`📹 *Web Scrolling Video Generator*

*Usage:* ${m.prefix}svideo <website_url>
*Example:* ${m.prefix}svideo google.com

*Note:* මෙය වෙබ් අඩවියේ සම්පූර්ණ පිටුවම ස්ක්‍රෝල් කරලා Video එකක් හදනවා.`);
    }

    // Add https:// if missing
    if (!url.startsWith("http")) url = "https://" + url;

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📹 *Capturing scrolling video of ${url}...*\n_This may take 10–30 seconds._`);

    // Create a temporary directory for the video file
    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const outputFile = path.join(tempDir, `scroll_${Date.now()}.mp4`);

    let browser = null;
    let page = null;
    let recorder = null;

    try {
        // Launch Puppeteer in headless mode (no visible browser window)
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        
        // Set viewport size (you can adjust this as needed)
        await page.setViewport({ width: 1280, height: 800 });
        
        // Navigate to the URL
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Initialize the screen recorder
        recorder = new PuppeteerScreenRecorder(page, {
            ffmpegPath: ffmpegPath,
            fps: 25,
            videoFrame: { width: 1280, height: 800 },
            aspectRatio: '16:9',
            videoCrf: 18,
            videoCodec: 'libx264',
            videoPreset: 'ultrafast',
            videoBitrate: 1000,
            followNewTab: true,
        });

        // Start recording
        await recorder.start(outputFile);

        // Scroll the page slowly from top to bottom
        // Get the total height of the page
        const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
        const viewportHeight = 800; // Same as the viewport height set above
        const totalSteps = Math.ceil(scrollHeight / viewportHeight);
        
        for (let i = 0; i <= totalSteps; i++) {
            const scrollTo = i * viewportHeight;
            await page.evaluate((scrollY) => {
                window.scrollTo(0, scrollY);
            }, scrollTo);
            // Wait a bit between each scroll step to create a smooth scrolling effect
            await page.waitForTimeout(100); // 100ms per step
        }

        // Wait a little at the bottom, then scroll back to the top (optional)
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        // Stop recording
        await recorder.stop();

        // Read the recorded video file
        const buffer = fs.readFileSync(outputFile);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        
        if (buffer.length < 10000) throw new Error("Video file is too small (invalid).");

        const caption = `📹 *Scrolling Video Captured*\n\n🔗 *URL:* ${url}\n📦 *Size:* ${fileSizeMB} MB\n\n> *Powered by Puppeteer*`;

        // Send the video as a document
        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: "video/mp4",
            fileName: `scroll_${Date.now()}.mp4`,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        await m.reply(`✅ *Scrolling video saved successfully!*`);

    } catch (error) {
        console.error("Scroll video error:", error);
        await m.react("❌");
        let errorMsg = `❌ *Failed to capture scrolling video*\n\n`;
        if (error.message.includes("timeout")) {
            errorMsg += `The website took too long to load.`;
        } else if (error.message.includes("No such file")) {
            errorMsg += `ffmpeg not found. Make sure ffmpeg is installed.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    } finally {
        // Clean up: close browser and delete the temporary file
        if (recorder) await recorder.stop().catch(() => {});
        if (browser) await browser.close();
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    }
});
