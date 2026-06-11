// commands/svideo.js (using puppeteer-screen-recorder)
const { Sparky, isPublic } = require("../lib");
const puppeteer = require("puppeteer");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");

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
    desc: "📹 Captures a scrolling video of any website (MP4)"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`📹 *Web Scrolling Video Generator*

*Usage:* ${m.prefix}svideo <website_url>
*Example:* ${m.prefix}svideo google.com`);
    }

    if (!url.startsWith("http")) url = "https://" + url;

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📹 *Capturing scrolling video of ${url}...*\n_This may take 20–40 seconds._`);

    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const outputFile = path.join(tempDir, `scroll_${Date.now()}.mp4`);

    let browser = null;
    let page = null;
    let recorder = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Use the correct recorder constructor
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

        await recorder.start(outputFile);

        // Smooth scrolling
        const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
        const viewportHeight = 800;
        const totalSteps = Math.ceil(scrollHeight / viewportHeight);
        for (let i = 0; i <= totalSteps; i++) {
            await page.evaluate((y) => window.scrollTo(0, y), i * viewportHeight);
            await page.waitForTimeout(100);
        }
        await page.waitForTimeout(500);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(500);

        await recorder.stop();

        const buffer = fs.readFileSync(outputFile);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        if (buffer.length < 10000) throw new Error("Video too small");

        const caption = `📹 *Scrolling Video Captured*\n\n🔗 *URL:* ${url}\n📦 *Size:* ${fileSizeMB} MB\n\n> *Powered by Puppeteer*`;

        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: "video/mp4",
            fileName: `scroll_${Date.now()}.mp4`,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        await m.reply(`✅ *Video captured successfully!*`);

    } catch (error) {
        console.error("Scroll video error:", error);
        await m.react("❌");
        let errorMsg = `❌ *Failed to capture scrolling video*\n\n`;
        if (error.message.includes("timeout")) {
            errorMsg += `The website took too long to load.`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    } finally {
        if (recorder) await recorder.stop().catch(() => {});
        if (browser) await browser.close();
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    }
});
