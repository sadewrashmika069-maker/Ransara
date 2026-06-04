// commands/sinhalasub.js
const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

// API Configuration
const API_KEY = "zan_FIAO7Ayh_eo1vllkep6";
const API_BASE_URL = "https://api.zanta-mini.store/api/sinhalasub";

// Helper function to format the search results
function formatSearchResults(movies) {
    let message = "🎬 *සිංහල උපසිරැසි ප්‍රතිඵල*\n\n";
    movies.forEach((movie, index) => {
        message += `*${index + 1}. ${movie.title}*\n`;
        message += `   🔗 URL: ${movie.url}\n\n`;
    });
    message += "📌 *බාගැනීමට*: `.sdl <URL>`";
    return message;
}

// Helper function to format the download results
function formatDownloadResults(linksData) {
    let message = "📥 *ඩවුන්ලෝඩ් සබැඳි*\n\n";
    // Filter for SRT subtitles and video links
    const subtitles = linksData.find(link => link.quality === "Subtitles");
    const videoLinks = linksData.filter(link => link.quality !== "Subtitles");

    if (videoLinks.length) {
        message += "*වීඩියෝ ගොනු:*\n";
        videoLinks.forEach(link => {
            message += `   ▶️ ${link.quality} (${link.size})\n`;
            message += `   🔗 ${link.direct_link}\n\n`;
        });
    }
    if (subtitles) {
        message += "*උපසිරැසි ගොනු:*\n";
        message += `   📝 SRT ගොනුව: ${subtitles.direct_link}\n`;
    }
    return message;
}

// Main command
Sparky({
    name: "sinhalasub",
    alias: ["ss"],
    category: "download",
    fromMe: isPublic,
    desc: "Search for Sinhala subtitles (e.g., .ss The Croods)"
}, async ({ client, m, args }) => {
    const query = args.join(" ");
    if (!query) return m.reply("❌ Please provide a movie name. Example: `.ss The Croods`");

    await m.react("🔍");
    const searchUrl = `${API_BASE_URL}/search?apiKey=${API_KEY}&text=${encodeURIComponent(query)}`;

    try {
        const response = await axios.get(searchUrl);
        if (response.data && response.data.success && response.data.results && response.data.results.length) {
            const results = response.data.results;
            const searchResultsMessage = formatSearchResults(results);
            await client.sendMessage(m.jid, { text: searchResultsMessage }, { quoted: m });
            // Store results in a session for later download
            global.sinhalaSubResults = results;
        } else {
            await m.reply("❌ No results found for your query.");
        }
    } catch (error) {
        console.error(error);
        await m.reply("❌ An error occurred while searching. Please try again later.");
    }
    await m.react("✅");
});

// Download command
Sparky({
    name: "sinhalasubdl",
    alias: ["sdl"],
    category: "download",
    fromMe: isPublic,
    desc: "Download a movie or subtitle using its URL"
}, async ({ client, m, args }) => {
    const movieUrl = args.join(" ");
    if (!movieUrl) return m.reply("❌ Please provide a valid movie URL. Example: `.sdl https://sinhalasub.lk/movies/...`");

    await m.react("⏳");
    const downloadUrl = `${API_BASE_URL}/dl?apiKey=${API_KEY}&text=${encodeURIComponent(movieUrl)}`;

    try {
        const response = await axios.get(downloadUrl);
        if (response.data && response.data.success && response.data.results && response.data.results.links) {
            const downloadLinksMessage = formatDownloadResults(response.data.results.links);
            await client.sendMessage(m.jid, { text: downloadLinksMessage }, { quoted: m });
        } else {
            await m.reply("❌ Could not retrieve download links for the provided URL.");
        }
    } catch (error) {
        console.error(error);
        await m.reply("❌ An error occurred while fetching download links.");
    }
    await m.react("✅");
});
