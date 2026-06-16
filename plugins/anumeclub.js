// commands/anime.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

if (!global.animeSessions) global.animeSessions = new Map();

const BOT_NAME = "★👑𝙎𝘼𝘿𝙀𝙒-𝙓-𝙈𝘿🔥 ★";

// ==========================================
// 1. MAIN SEARCH COMMAND (.anime)
// ==========================================
Sparky({
    name: "anime",
    alias: ["ac", "animeclub"],
    category: "download",
    fromMe: isPublic,
    desc: "🎌 SL Anime Club"
}, async ({ client, m, args }) => {
    try {
        const query = args.join(" ");
        if (!query) return await m.reply(`🎌 *Anime Search*\n\nUsage: .anime <name>`);

        await m.react("🔍");
        const res = await axios.get(`https://animeclub-api.udmodz-2ab.workers.dev/search?q=${encodeURIComponent(query)}`);
        
        // පට්ටම සරල විදිහට Result එක ගන්නවා (API එකෙන් එන ඕනෑම Format එකක් අල්ලගන්නවා)
        const data = res.data;
        const results = Array.isArray(data) ? data : (data.data || data.results || data.result || []);
        
        if (results.length === 0) return await m.reply("❌ කිසිවක් හමු නොවීය.");

        let listMsg = `🎌 *Anime Search Results:*\n\n`;
        results.slice(0, 10).forEach((a, i) => listMsg += `*${i + 1}.* ${a.title || a.name}\n`);
        listMsg += `\n📌 .<අංකය> තෝරන්න (Ex: .1)`;

        await client.sendMessage(m.jid, { image: { url: results[0].image || results[0].thumbnail }, caption: listMsg }, { quoted: m });
        global.animeSessions.set(m.sender, { step: "awaiting_anime", results: results.slice(0, 10) });
        await m.react("✅");
    } catch (e) { 
        await m.react("❌"); 
        await m.reply("❌ Error: " + e.message); 
    }
});

// ==========================================
// 2. NUMBER & QUALITY SELECTORS
// ==========================================
// ඉතුරු කොටස් ටික අර කලින් තිබ්බ පරණ කෝඩ් එකේම විදිහට තියාගන්න (ප්‍රශ්නයක් නෑ)
