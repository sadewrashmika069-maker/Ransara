const {
    Sparky,
    commands,
    isPublic
} = require("../lib");
const config = require("../config.js");

// Global set to track main menu message IDs
if (!global.menuMsgIds) global.menuMsgIds = new Set();

// Helper function to show category submenu (reused in both .menu number and reply handler)
async function showCategoryMenu(client, m, categoryNumber, prefix) {
    const defaultImg = config.MENU_IMAGE_URL || "https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg";

    const categoriesList = [
        { num: 1, name: "DOWNLOAD", image: "https://res.cloudinary.com/dqlh378fb/image/upload/v1782010878/zanta_media_uploads/k6btsgegjtnjuykb7g7f.jpg", icon: "📥", keywords: ["download", "yt", "youtube", "facebook", "fb", "instagram", "ig", "media", "video"] },
        { num: 2, name: "AI", image: "https://res.cloudinary.com/dqlh378fb/image/upload/v1782010845/zanta_media_uploads/j4lvxxlc48np5muhyn1a.jpg", icon: "🧠", keywords: ["ai", "chatgpt", "gpt", "gemini", "bard", "chatbot", "ai chat"] },
        { num: 3, name: "GROUP", image: defaultImg, icon: "👥", keywords: ["group", "gc", "gcast", "groupcast", "tag", "mention", "invite", "link", "group info"] },
        { num: 4, name: "ADMIN", image: defaultImg, icon: "⚙️", keywords: ["admin", "promote", "demote", "kick", "remove", "add", "mute", "unmute", "warning", "warn"] },
        { num: 5, name: "TOOLS", image: "https://res.cloudinary.com/dqlh378fb/image/upload/v1782010867/zanta_media_uploads/snnqp75qm9iuzouz6piu.jpg", icon: "🔧", keywords: ["tool", "qr", "scanner", "shortener", "url", "converter", "sticker", "photo", "image", "edit"] },
        { num: 6, name: "OWNER", image: defaultImg, icon: "👑", keywords: ["owner", "bot", "restart", "shutdown", "update", "block", "unblock", "broadcast"] },
        { num: 7, name: "OTHER", image: defaultImg, icon: "📁", keywords: ["fun", "game", "meme", "quote", "weather", "news", "search", "info"] },
        { num: 8, name: "SONG", image: "https://res.cloudinary.com/dqlh378fb/image/upload/v1782010855/zanta_media_uploads/hy5xd30khptmco5hcksw.jpg", icon: "🎵", keywords: ["song", "music", "mp3", "play", "audio", "spotify", "ytmp3", "lyrics"] }
    ];
    
    let selectedCat = categoriesList.find(cat => cat.num === categoryNumber);
    if (!selectedCat) return false;

    let allValidCategories = categoriesList.map(c => c.name.toLowerCase());
    let catCommands = [];

    if (commands && Array.isArray(commands)) {
        commands.forEach(cmd => {
            if (cmd.dontAddCommandList) return;
            
            let cmdName = cmd.name;
            let cmdNameStr = "";
            if (typeof cmdName === 'object' && cmdName && cmdName.source) {
                let match = cmdName.source.split('\\s*')[1]?.toString().match(/([a-z0-9]+)/i);
                cmdNameStr = match ? match[1] : "";
            } else if (typeof cmdName === 'string') {
                cmdNameStr = cmdName;
            } else if (cmdName && typeof cmdName === 'object') {
                cmdNameStr = Object.values(cmdName)[0] || "";
            }

            let cmdCategory = (cmd.category || "other").toLowerCase();
            let cmdDesc = (cmd.desc || "").toLowerCase();
            let isInCategory = false;
            
            if (cmdCategory === selectedCat.name.toLowerCase()) {
                isInCategory = true;
            } else if (!allValidCategories.includes(cmdCategory) || cmdCategory === "other") {
                for (let kw of selectedCat.keywords) {
                    let exactWordRegex = new RegExp(`\\b${kw}\\b`, 'i');
                    if (exactWordRegex.test(cmdDesc) || exactWordRegex.test(cmdNameStr)) {
                        isInCategory = true;
                        break;
                    }
                }
            }

            if (isInCategory && cmdNameStr && cmdNameStr !== "unknown" && cmdNameStr !== "") {
                if (!catCommands.includes(cmdNameStr)) catCommands.push(cmdNameStr);
            }
        });
    }

    let categoryMenu = `
╔════════════════════════════╗
║     ${selectedCat.icon} ${selectedCat.name} MENU     
║        commands : ${catCommands.length}        
╚════════════════════════════╝

┌────────────────────────────┐
`;
    if (catCommands.length > 0) {
        catCommands.sort().forEach((cmd, idx) => {
            let num = (idx + 1).toString().padStart(2, '0');
            categoryMenu += `│ ${num}. ${cmd}\n`;
        });
    } else {
        categoryMenu += `│    📭 කිසිදු command එකක් නැත\n`;
    }
    categoryMenu += `
└────────────────────────────┘

💡 *භාවිතය*
┣ ➤ ${prefix}menu [number] - category එක බලන්න
┣ ➤ ${prefix}menu - ප්‍රධාන මෙනුවට
┗ ➤ ${prefix}help - උදව් සඳහා

━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⚡ ${selectedCat.name} SECTION ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    await client.sendMessage(m.jid, { 
        image: { url: selectedCat.image }, 
        caption: categoryMenu 
    }, { quoted: m });
    
    return true;
}

// Main menu command
Sparky({
    name: "menu",
    category: "misc",
    fromMe: isPublic,
    desc: "📋 සියලුම විධාන බලන්න - අංකයක් එවන්න"
}, async ({ client, m, args }) => {
    try {
        let userInput = "";
        if (args && Array.isArray(args)) {
            userInput = args.join(" ").trim();
        } else if (args && typeof args === 'string') {
            userInput = args.trim();
        } else if (args && typeof args === 'object') {
            userInput = Object.values(args).join(" ").trim();
        } else {
            userInput = "";
        }
        
        if (userInput && /^[0-9]+$/.test(userInput)) {
            let selectedNum = parseInt(userInput);
            await showCategoryMenu(client, m, selectedNum, m.prefix || ".");
            return;
        }
        
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

┏━━━━『 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈𝐄𝐒 』━━━━━
┣⪼ ❖ 1. 📥 Download Menu
┣⪼ ❖ 2. 🧠 AI Commands
┣⪼ ❖ 3. 👥 Group Manage
┣⪼ ❖ 4. ⚙️ Admin Menu
┣⪼ ❖ 5. 🔧 Tools & Edits
┣⪼ ❖ 6. 👑 Owner Area
┣⪼ ❖ 7. 📁 Other Cmds
┣⪼ ❖ 8. 🎵 Song & Music
┗━━━━━━━━━━━━━━━━━━━━━━━━━

┌──────────────────────────────────┐
│         💡 HOW TO USE             │
├──────────────────────────────────┤
│                                  
│  📌 *අංකයක් එවන්න* :                
│                                  
│     • ${m.prefix || "."}menu 1  → DOWNLOAD
│     • ${m.prefix || "."}menu 2  → AI
│     • ${m.prefix || "."}menu 3  → GROUP
│     • ${m.prefix || "."}menu 4  → ADMIN
│     • ${m.prefix || "."}menu 5  → TOOLS
│     • ${m.prefix || "."}menu 6  → OWNER
│     • ${m.prefix || "."}menu 7  → OTHER
│     • ${m.prefix || "."}menu 8  → SONG
│
│  🆕 *නැත්නම්:* මෙම පණිවිඩයට *Reply* කර අංකය පමණක් එවන්න.
│     (උදා: Reply with "1" → DOWNLOAD menu)
│
└──────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     💫 POWERED BY ${botName} 💫
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

        const menuImageUrl = config.MENU_IMAGE_URL || "https://res.cloudinary.com/dqlh378fb/image/upload/v1780590033/zanta_media_uploads/dttqjshprca9zvqcpbwg.jpg";
        
        const sentMsg = await client.sendMessage(m.jid, {
            image: { url: menuImageUrl },
            caption: mainMenu
        }, { quoted: m });
        
        global.menuMsgIds.add(sentMsg.key.id);
        setTimeout(() => global.menuMsgIds.delete(sentMsg.key.id), 5 * 60 * 1000);
        
    } catch (e) {
        console.log("Menu error:", e);
        console.log("Error stack:", e.stack);
        m.reply(`❌ සමාවන්න, මෙනුව පෙන්වන්න බැරි වුණා.\n\n📝 *Error:* ${e.message}\n\n💡 උපදෙස්: ${m.prefix || "."}help`);
    }
});

// Command to capture replies with just a number
Sparky({
    name: "menureply",
    pattern: /^\d+$/,
    dontPrefix: true, 
    fromMe: false,
    dontAddCommandList: true,
    desc: "Internal handler for menu number replies"
}, async ({ client, m, args }) => {
    if (!m.quoted) return;
    const quotedId = m.quoted.key.id;
    if (!global.menuMsgIds || !global.menuMsgIds.has(quotedId)) return;
    
    const number = parseInt(m.text || args[0]);
    if (isNaN(number) || number < 1 || number > 8) return;
    
    const prefix = m.prefix || ".";
    await showCategoryMenu(client, m, number, prefix);
});
