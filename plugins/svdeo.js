// commands/svideo.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

// ⚙️ Paste your API key here
const API_KEY = "YOUR_API_KEY";

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
    desc: "📹 Record a scrolling video of any website (MP4)"
}, async ({ client, m, args }) => {
    let url = getQuery(args);
    if (!url) {
        return m.reply(`📹 *Web Scrolling Video Generator*

*Usage:* ${m.prefix}svideo <website_url>
*Example:* ${m.prefix}svideo sinhalasub.lk

*Note:* This captures a full‑page scrolling video.`);
    }

    if (!url.startsWith("http")) url = "https://" + url;

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`📹 *Recording scrolling video of ${url}...*\n_This may take 10–30 seconds._`);

    try {
        // Call the WebsiteScreenshot.online API
        const response = await axios({
            method: "POST",
            url: "https://websitescreenshot.online/api/v1/screenshot",
            headers: {
                "Authorization": `Bearer ${API_KEY}`,
                "Content-Type": "application/json"
            },
            data: {
                url: url,
                format: "mp4",
                fullSize: true,            // capture the whole page
                delay: 5,                  // wait a few seconds for page to settle
                blockAds: true,            // remove pop‑ups / banners
                blockCookiesGdpr: true     // remove cookie notices
            },
            timeout: 60000
        });

        if (!response.data?.url) throw new Error("No video URL returned");

        const videoUrl = response.data.url;
        const videoRes = await axios.get(videoUrl, {
            responseType: "arraybuffer",
            timeout: 60000
        });

        const buffer = Buffer.from(videoRes.data);
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        if (buffer.length < 10000) throw new Error("Video too small – capture failed");

        const fileName = `scroll_${Date.now()}.mp4`;
        const caption = `📹 *Scrolling Video Captured*\n\n🔗 *URL:* ${url}\n📦 *Size:* ${fileSizeMB} MB\n\n> *Powered by WebsiteScreenshot.online*`;

        await client.sendMessage(m.jid, {
            document: buffer,
            mimetype: "video/mp4",
            fileName: fileName,
            caption: caption
        }, { quoted: m });

        await m.react("✅");
        await m.reply(`✅ *Scrolling video saved successfully!*`);

    } catch (error) {
        console.error("Scroll video error:", error);
        await m.react("❌");
        let errorMsg = `❌ *Failed to capture scrolling video*\n\n`;
        if (error.message.includes("No video URL")) {
            errorMsg += `The service could not generate a video. The website might be too slow or not reachable.`;
        } else if (error.response?.status === 401) {
            errorMsg += `❌ *Invalid API key!*\n\nPlease replace \`API_KEY\` in the code with a valid key from [websitescreenshot.online](https://websitescreenshot.online).`;
        } else {
            errorMsg += `Error: ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
