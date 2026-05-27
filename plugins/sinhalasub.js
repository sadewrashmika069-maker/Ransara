const { Sparky } = require("../lib");
const axios = require("axios");
const config = require("../config");

const API_KEY = config.SINHALASUB_API_KEY || "zanta_fCZXpI08BXyizOiRJlDBShW6";
const API_BASE = "https://api.zanta-mini.store/api/sinhalasub";

Sparky({
  name: "sinhalasub",
  category: "download",
  fromMe: false,
  desc: "🎬 Search Sinhala movies"
}, async ({ client, m, args }) => {
  const query = args.join(" ").trim();
  if (!query) {
    return m.reply(`📌 *Usage:* ${m.prefix}sinhalasub movie name\nExample: ${m.prefix}sinhalasub harry potter`);
  }

  await m.react("⏳");
  try {
    // Direct search API call
    const url = `${API_BASE}/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;
    console.log("Searching:", url);  // This will appear in your bot logs

    const response = await axios.get(url, { timeout: 15000 });
    console.log("Response data:", JSON.stringify(response.data).substring(0, 200));

    if (!response.data || !response.data.success || !response.data.results || response.data.results.length === 0) {
      await m.react("❌");
      return m.reply(`😞 No results for "${query}".`);
    }

    let listMsg = `🎬 *Results for "${query}"*\n\n`;
    response.data.results.slice(0, 8).forEach((movie, i) => {
      listMsg += `${i+1}. ${movie.title}\n`;
    });
    listMsg += `\nUse .sinhalasubdl <number> to get download links. (Coming soon)`;

    await client.sendMessage(m.jid, { text: listMsg }, { quoted: m });
    await m.react("✅");

  } catch (error) {
    console.error("Search error:", error);
    await m.react("❌");
    m.reply(`⚠️ Error: ${error.message}`);
  }
});
