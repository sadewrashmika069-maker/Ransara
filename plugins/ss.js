// commands/ss.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

function getQuery(args) {
    if (!args) return "";
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();
    if (typeof args === "object") return Object.values(args).join(" ").trim();
    return "";
}

Sparky({
    name: "ss",
    alias: ["screenshot", "webss"],
    category: "tools",
    fromMe: isPublic,
    desc: "📸 වෙබ් අඩවියක තිර රුවක් ගන්න"
}, async ({ client, m, args }) => {
    try {
        let url = getQuery(args);
        if (!url) {
            return m.reply(`📸 *Website Screenshot*\n\n*Usage:* ${m.prefix}ss <website_url>\n*Example:* ${m.prefix}ss https://google.com`);
        }
        if (!url.startsWith("http")) url = "https://" + url;
        
        await m.react("⏳");
        await client.sendPresenceUpdate('composing', m.jid);
        
        // Using microlink.io – free, no API key required
        const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url`;
        const { data } = await axios.get(apiUrl, { timeout: 20000 });
        
        if (!data?.data?.screenshot?.url) {
            throw new Error("No screenshot URL received");
        }
        
        const screenshotUrl = data.data.screenshot.url;
        const caption = `📸 *Screenshot of:* ${url}\n🤖 SADEW-MINI\n⏱️ ${new Date().toLocaleString()}`;
        
        await client.sendMessage(m.jid, {
            image: { url: screenshotUrl },
            caption: caption
        }, { quoted: m });
        
        await m.react("✅");
    } catch (error) {
        console.error("Screenshot error:", error);
        await m.react("❌");
        m.reply(`❌ *Screenshot failed*\n\n📝 ${error.message.substring(0, 100)}`);
    }
});
