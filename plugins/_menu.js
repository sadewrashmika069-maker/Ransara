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
    const categoriesList = [
        { num: 1, name: "DOWNLOAD", icon: "📥", keywords: ["download", "yt", "youtube", "facebook", "fb", "instagram", "ig", "media", "video", "audio", "tp", "ttp"] },
        { num: 2, name: "AI", icon: "🧠", keywords: ["ai", "chatgpt", "gpt", "gemini", "bard", "chatbot", "ai chat"] },
        { num: 3, name: "GROUP", icon: "👥", keywords: ["group", "gc", "gcast", "groupcast", "tag", "mention", "invite", "link", "group info"] },
        { num: 4, name: "ADMIN", icon: "⚙️", keywords: ["admin", "promote", "demote", "kick", "remove", "add", "mute", "unmute", "warning", "warn"] },
        { num: 5, name: "TOOLS", icon: "🔧", keywords: ["tool", "qr", "scanner", "shortener", "url", "converter", "sticker", "photo", "image", "take", "edit", "emo"] },
        { num: 6, name: "OWNER", icon: "👑", keywords: ["owner", "bot", "restart", "shutdown", "update", "block", "unblock", "broadcast"] },
        { num: 7, name: "OTHER", icon: "📁", keywords: ["fun", "game", "meme", "quote", "weather", "news", "search", "info"] },
        { num: 8, name: "SONG", image: "https://res.cloudinary.com/dqlh378fb/image/upload/v1782010855/zanta_media_uploads/hy5xd30khptmco5hcksw.jpg
", icon: "🎵", keywords:["song", "music", "mp3", "bass", "slow", "nightcore", "find", "audio", "spotify", "ytmp3", "lyrics"] }
    ];
    let selectedCat = categoriesList.find(cat => cat.num === categoryNumber);
    if (!selectedCat) return false;

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
            } else {
                for (let kw of selectedCat.keywords) {
                    if (cmdDesc.includes(kw) || cmdNameStr.includes(kw)) {
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
            let num = (idx + 1).toString().padStart(2);
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
    await client.sendMessage(m.jid, { text: categoryMenu }, { quoted: m });
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
        // Handle number input (with prefix) like .menu 1
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
        
        // Show main menu with image
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

┌──────────────────────────────────┐
│        📚 CATEGORIES             │
├──────────────────────────────────┤
│                                  
│  1. 📥 DOWNLOAD MENU              
│     YT, FB, IG වීඩියෝ           
│
│  2. 🧠 AI MENU                    
│     ChatGPT, Gemini, Bot          
│
│  3. 👥 GROUP MENU                 
│     Group එක manage කරන්න         
│
│  4. ⚙️ ADMIN MENU                 
│     Admin වැඩ කටයුතු             
│
│  5. 🔧 TOOLS MENU                 
│     Sticker, QR, Converter        
│
│  6. 👑 OWNER MENU                 
│     Bot පාලනය සඳහා              
│
│  7. 📁 OTHER MENU                 
│     වෙනත් විධාන                  
│
└──────────────────────────────────┘

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
        
        // Store the message ID so that replies can be recognized
        global.menuMsgIds.add(sentMsg.key.id);
        // Auto-remove after 5 minutes to avoid memory leak
        setTimeout(() => global.menuMsgIds.delete(sentMsg.key.id), 5 * 60 * 1000);
        
    } catch (e) {
        console.log("Menu error:", e);
        console.log("Error stack:", e.stack);
        m.reply(`❌ සමාවන්න, මෙනුව පෙන්වන්න බැරි වුණා.\n\n📝 *Error:* ${e.message}\n\n💡 උපදෙස්: ${m.prefix || "."}help`);
    }
});

// Command to capture replies with just a number (no prefix) to the main menu
Sparky({
    name: "menureply",
    pattern: /^\d+$/,
    dontPrefix: true,   // allows raw number without dot
    fromMe: false,
    dontAddCommandList: true,
    desc: "Internal handler for menu number replies"
}, async ({ client, m, args }) => {
    // Must be a reply to a message
    if (!m.quoted) return;
    const quotedId = m.quoted.key.id;
    // Check if the quoted message is a main menu message we stored
    if (!global.menuMsgIds || !global.menuMsgIds.has(quotedId)) return;
    
    const number = parseInt(args[0]);
    if (isNaN(number) || number < 1 || number > 7) return;
    
    // Show the category submenu
    const prefix = m.prefix || ".";
    await showCategoryMenu(client, m, number, prefix);
});
