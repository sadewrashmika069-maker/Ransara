// commands/sinhalasub.js
const { Sparky } = require("../lib");
const axios = require("axios");
const config = require("../config");

const API_KEY = config.SINHALASUB_API_KEY || "zanta_fCZXpI08BXyizOiRJlDBShW6";
const API_BASE = "https://api.zanta-mini.store/api/sinhalasub";

Sparky({
    name: "sinhalasub",
    category: "download",
    fromMe: false,
    desc: "🎬 සිංහල චිත්‍රපට ඩවුන්ලෝඩ් ලින්ක් ලබාගන්න"
}, async ({ client, m, args }) => {
    const movieName = args.join(" ");
    if (!movieName) {
        return m.reply("❌ කරුණාකර චිත්‍රපටයේ නම ඇතුළත් කරන්න.\nඋදා: `.sinhalasub harry potter`");
    }

    await m.react("🔍");
    try {
        // 1. සෙවීම
        const searchUrl = `${API_BASE}/search?apiKey=${API_KEY}&text=${encodeURIComponent(movieName)}`;
        const searchRes = await axios.get(searchUrl, { timeout: 10000 });

        if (!searchRes.data?.success || !searchRes.data.results?.length) {
            await m.react("❌");
            return m.reply(`😞 *${movieName}* සඳහා ප්‍රතිඵල නැත.`);
        }

        // පළමු ප්‍රතිඵලය ගන්න
        const firstMovie = searchRes.data.results[0];
        const movieTitle = firstMovie.title;
        const moviePageUrl = encodeURIComponent(firstMovie.url);

        // 2. ඩවුන්ලෝඩ් ලින්ක් ලබාගන්න
        const dlUrl = `${API_BASE}/dl?apiKey=${API_KEY}&text=${moviePageUrl}`;
        const dlRes = await axios.get(dlUrl, { timeout: 10000 });

        if (!dlRes.data?.success || !dlRes.data.results?.links?.length) {
            await m.react("❌");
            return m.reply(`❌ *${movieTitle}* සඳහා ලින්ක් හමු නොවුණා.`);
        }

        // 3. ලින්ක් list එක හදන්න
        const allLinks = dlRes.data.results.links;
        let responseText = `🎬 *${movieTitle}*\n\n📥 *ඩවුන්ලෝඩ් ලින්ක්:*\n`;

        allLinks.forEach((link, index) => {
            responseText += `\n*${index + 1}. ${link.quality} (${link.size})*\n`;
            responseText += `🔗 ${link.direct_link}\n`;
        });

        responseText += `\n> 💫 සාදන ලද්දේ සදෙව් විසිනි`;

        await client.sendMessage(m.jid, { text: responseText }, { quoted: m });
        await m.react("✅");

    } catch (error) {
        console.error("Sinhalasub error:", error);
        await m.react("❌");
        m.reply(`⚠️ දෝෂයක්: ${error.message}`);
    }
});
