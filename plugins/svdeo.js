// commands/svideo.js
const { Sparky, isPublic } = require("../lib");
const puppeteer = require("puppeteer");
const { PuppeteerScreenRecorder } = require("puppeteer-screen-recorder");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const path = require("path");

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    return "";
}

Sparky({
    name: "svideo",
    alias: ["webvideo", "scrollvideo"],
    category: "tools",
    fromMe: true, // හොඳම ප්‍රතිඵල සඳහා owner only
    desc: "📹 වෙබ් අඩවියක් ස්ක්‍රෝල් කරලා Video එකක් හදන්න"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`📹 *Web Scrolling Video Generator*

*Usage:* ${m.prefix}svideo <website_url>
*Example:* ${m.prefix}svideo google.com`);
    }
    if (!url.startsWith("http")) url = "https://" + url;

    await m.react("⏳");
    await m.reply(`📹 *Capturing scrolling video of ${url}...*\n_This may take 20–40 seconds._`);

    const tempDir = path.join(__dirname, "../temp");
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const outputFile = path.join(tempDir, `scroll_${Date.now()}.mp4`);

    let browser = null;
    let page = null;
    let recorder = null;

    try {
        // Puppeteer launch (old headless mode)
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await wait(3000);

        // Recorder initialize කරන්න
        recorder = new PuppeteerScreenRecorder(page, {
            ffmpegPath: ffmpegPath,
            fps: 30,
            videoFrame: { width: 1280, height: 800 },
            aspectRatio: '16:9',
            videoCrf: 18,
            videoCodec: 'libx264',
            videoPreset: 'ultrafast',
            videoBitrate: 2000,
            followNewTab: false,
        });

        await recorder.start(outputFile);
        await wait(2000); // recording start වෙන්න time එකක්

        // Smooth scrolling
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 400;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= document.body.scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 150);
            });
        });

        await wait(5000); // recording නතර කරන්න කලින් ටිකක් ඉන්න
        await recorder.stop();

        const buffer = fs.readFileSync(outputFile);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
        if (buffer.length < 10000) throw new Error("Video too small");

        const caption = `📹 *Scrolling Video Captured*\n\n🔗 *URL:* ${url}\n📦 *Size:* ${fileSizeMB} MB`;

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
        m.reply(`❌ *Failed to capture scrolling video*\n\nError: ${error.message.substring(0, 150)}`);
    } finally {
        if (recorder) await recorder.stop().catch(() => {});
        if (browser) await browser.close();
        if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
    }
});
