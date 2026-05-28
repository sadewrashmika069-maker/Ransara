// ========== ප්‍රධාන මෙනුව (IMAGE + CAPTION + BUTTONS) ==========
let uptime = await m.uptime();
let now = new Date();
let date = now.toLocaleDateString("en-IN", { timeZone: "Asia/Colombo" });
let time = now.toLocaleTimeString("en-IN", { timeZone: "Asia/Colombo" });

let botName = config.BOT_INFO ? config.BOT_INFO.split(";")[0] : "SADEW MINI";

let mainMenu = `
╔══════════════════════════════════╗
║        🤖 ${botName}                ║
║      ✨ MAIN MENU ✨               ║
╚══════════════════════════════════╝

┌──────────────────────────────────┐
│         👤 USER INFO              │
├──────────────────────────────────┤
│ 🏷 නම     : ${m.pushName || "Guest"}
│ 🔖 මාදිලිය  : ${config.WORK_TYPE || "Public"}
│ 📅 දිනය    : ${date}
│ ⏰ වේලාව    : ${time}
│ ⚡ වැඩ කල කාලය : ${uptime}
│ 📦 ප්ලගින් : ${commands ? (Array.isArray(commands) ? commands.length : 0) : 0}
│ 🔰 පෙරවරු : ${m.prefix || "."}
└──────────────────────────────────┘

👇 *පහත බොත්තම් භාවිතා කරන්න*
`;

// බොත්තම් හදන්න (උපරිම 3ක් එකවර)
const buttons = [
    { buttonId: `${m.prefix}menu 1`, buttonText: { displayText: "📥 DOWNLOAD" }, type: 1 },
    { buttonId: `${m.prefix}menu 2`, buttonText: { displayText: "🧠 AI" }, type: 1 },
    { buttonId: `${m.prefix}menu 3`, buttonText: { displayText: "👥 GROUP" }, type: 1 },
    { buttonId: `${m.prefix}menu 4`, buttonText: { displayText: "⚙️ ADMIN" }, type: 1 },
    { buttonId: `${m.prefix}menu 5`, buttonText: { displayText: "🔧 TOOLS" }, type: 1 },
    { buttonId: `${m.prefix}menu 6`, buttonText: { displayText: "👑 OWNER" }, type: 1 },
    { buttonId: `${m.prefix}menu 7`, buttonText: { displayText: "📁 OTHER" }, type: 1 }
];

// පින්තූරයේ URL එක (config එකෙන් හෝ default)
const menuImageUrl = config.MENU_IMAGE_URL || "https://res.cloudinary.com/dqlh378fb/image/upload/v1779928206/zanta_media_uploads/n6pgdmmiivooq8ylvrao.jpg";

// බොත්තම් සහිත පණිවිඩය යවන්න (image + caption + buttons)
await client.sendMessage(m.jid, {
    image: { url: menuImageUrl },
    caption: mainMenu,
    buttons: buttons,
    headerType: 1   // 1 = text header, 2 = image header, 3 = video, 4 = document
}, { quoted: m });
