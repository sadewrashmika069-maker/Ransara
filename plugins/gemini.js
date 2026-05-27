// commands/gemini.js
const { Sparky, isPublic } = require("../lib");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("../config");

// Gemini AI initialization
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// එක් එක් user ගේ chat history තියාගන්න Map එකක්
const userHistory = new Map();

// ========== args එක හරියට handle කරන function එක ==========
function getArgs(args) {
    // args array එකක් නම්
    if (args && Array.isArray(args)) {
        return args.join(" ").trim();
    }
    // args string එකක් නම්
    if (args && typeof args === 'string') {
        return args.trim();
    }
    // args object එකක් නම් (උදා: {0: "hello"})
    if (args && typeof args === 'object') {
        return Object.values(args).join(" ").trim();
    }
    // එකක් නැත්නම්
    return "";
}

Sparky({
    name: "gemini",
    category: "ai",
    fromMe: isPublic,
    desc: "🤖 Gemini AI සමඟ කතා කරන්න"
}, async ({ client, m, args }) => {
    try {
        // ========== FIX: args එක හරියට ගන්න ==========
        let userMessage = getArgs(args);
        
        // message එකක් නැත්නම්
        if (!userMessage || userMessage === "") {
            return m.reply(`🤖 *Gemini AI Assistant*

💡 *භාවිතය:*
${m.prefix}gemini [ඔයාගේ ප්‍රශ්නය]

📝 *උදාහරණ:*
${m.prefix}gemini කොහොමද ඔයා?
${m.prefix}gemini කවියක් කියන්න
${m.prefix}gemini හේතුව මොකක්ද?

🔄 *History reset:*
${m.prefix}resetgemini`);
        }
        
        // API key එක check කරන්න
        if (!config.GEMINI_API_KEY || config.GEMINI_API_KEY === "") {
            return m.reply("❌ Gemini API key එක සකසා නැත!\n\nකරුණාකර config.js එකට API key එක add කරන්න.");
        }
        
        // Typing indicator එක
        await client.sendPresenceUpdate('composing', m.jid);
        
        // user ගේ පැරණි chat history එක ගන්න
        let history = userHistory.get(m.sender) || [];
        
        // නව message එක history එකට add කරන්න
        history.push({ role: "user", parts: [{ text: userMessage }] });
        
        // history එක වැඩි උනොත් පරණ ඒවා අයින් කරන්න (අන්තිම 10)
        if (history.length > 10) {
            history = history.slice(-10);
        }
        
        // Chat session එක start කරන්න
        const chat = model.startChat({
            history: history.slice(0, -1),
            generationConfig: {
                maxOutputTokens: 1000,
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
            },
        });
        
        // Reply එක generate කරන්න
        const result = await chat.sendMessage(userMessage);
        const reply = result.response.text();
        
        // Reply එකත් history එකට add කරන්න
        history.push({ role: "model", parts: [{ text: reply }] });
        userHistory.set(m.sender, history);
        
        // Reply එක send කරන්න
        let finalReply = `🤖 *Gemini AI*
━━━━━━━━━━━━━━━━━━━━
${reply}
━━━━━━━━━━━━━━━━━━━━
💡 *Tip:* ${m.prefix}resetgemini - history එක reset කරන්න`;
        
        await m.reply(finalReply);
        
    } catch (error) {
        console.error("Gemini command error:", error);
        
        // Error එක handle කරන්න
        if (error.message && error.message.includes("API key")) {
            m.reply("❌ API key එක වලංගු නැහැ! කරුණාකර නිවැරදි API key එකක් config එකට දාන්න.");
        } else if (error.message && error.message.includes("rate limit")) {
            m.reply("⏰ විනාඩියකට requests ගාන ඉක්මවා ගියා. ටික වෙලාවකින් නැවත උත්සාහ කරන්න.");
        } else if (error.message && error.message.includes("safety")) {
            m.reply("⚠️ සමාවන්න, ආරක්ෂක හේතූන් මත මම ඒ ප්‍රශ්නයට පිළිතුරු දෙන්නේ නැහැ.");
        } else {
            m.reply(`❌ සමාවන්න, යම් දෝෂයක් සිදු විය.\n📝 *Error:* ${error.message ? error.message.substring(0, 100) : "Unknown error"}`);
        }
    }
});

// ========== Reset command එක ==========
Sparky({
    name: "resetgemini",
    category: "ai",
    fromMe: isPublic,
    desc: "🔄 ඔයාගේ Gemini chat history එක reset කරන්න"
}, async ({ client, m }) => {
    try {
        userHistory.delete(m.sender);
        await m.reply(`✅ *Success!*

ඔයාගේ Gemini AI chat history එක සාර්ථකව මකා දමන ලදි!

💡 දැන් නව සංවාදයක් ආරම්භ කරන්න: \`${m.prefix}gemini හේතුව මොකක්ද\``);
    } catch (error) {
        console.error("Reset error:", error);
        m.reply("❌ Reset කරන්න බැරි වුණා. නැවත උත්සාහ කරන්න.");
    }
});
