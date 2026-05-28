// commands/autoreply.js
const { Sparky } = require("../lib");
const config = require("../config");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: config.GROQ_API_KEY });

Sparky({
    name: "autoreply",
    pattern: /(.*)/,
    dontPrefix: true,          // prefix (.) අවශ්‍ය නැහැ
    fromMe: false,
    dontAddCommandList: true,
    desc: "Groq AI auto reply"
}, async ({ client, m, args }) => {
    const userMessage = args.join(" ").trim();
    if (!userMessage) return;
    if (m.key.fromMe) return;
    
    const prefix = m.prefix || ".";
    if (userMessage.startsWith(prefix)) return;
    
    // (විකල්ප) Group වල auto-reply disable කරන්න නම්:
    // if (m.isGroup) return;
    
    try {
        await client.sendPresenceUpdate('composing', m.jid);
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "You are a friendly WhatsApp bot assistant. Reply in Sinhala (use simple Sinhala with English letters if needed). Keep responses short and helpful." },
                { role: "user", content: userMessage }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 500
        });
        const reply = chatCompletion.choices[0]?.message?.content || "සමාවන්න, මට පිළිතුරක් හදාගන්න බැරි වුණා.";
        await m.reply(reply);
    } catch (err) {
        console.error("Groq auto reply error:", err);
    }
});
