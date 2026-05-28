const { Sparky } = require("../lib");
const axios = require("axios");

Sparky({
    name: "ai",
    alias: ["ask", "groq"],
    category: "ai",
    desc: "Chat with Ultra-Fast Dedicated GROQ AI Engine"
}, async ({ client, m, args }) => {
    if (!args) return m.reply("_මචං අහන්න ඕන ප්‍රශ්නයක් දාපන්! Example: .ai Who is Tony Stark?_");

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);

    // 🔒 මෙතන දැන් ඩිරෙක්ට් කී එක නැහැ. උඹ GitHub Secrets දාපු එක පරිස්සමට ඔටෝ ගන්නවා
    const groqKey = process.env.GROQ_API_KEY;

    if (!groqKey) {
        console.log(`[AI LOG] ❌ GROQ_API_KEY is missing in GitHub Secrets!`);
        return await tryBackup(args, m);
    }

    try {
        console.log(`\n[AI LOG] ⚡ Triggering GROQ using GitHub Secrets Key...`);
        
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "deepseek-r1-distill-llama-70b",
            messages: [{ role: "user", content: args }]
        }, {
            headers: {
                "Authorization": `Bearer ${groqKey}`,
                "Content-Type": "application/json"
            },
            timeout: 10000 // තත්පර 10ක් දෙනවා
        });

        const groqReply = response.data?.choices?.[0]?.message?.content;

        if (groqReply) {
            await m.react("✅");
            const cleanedReply = groqReply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
            return m.reply(cleanedReply);
        }

    } catch (error) {
        // 🔍 සර්වර් එකෙන් රීඩ් කරද්දී එන ඇත්තම එරර් එක GitHub ලොග් එකට ගන්නවා
        console.log(`\n[🚨 GROQ ERROR DETAILS] Status: ${error.response?.status}`);
        console.log(`[🚨 GROQ ERROR BODY]:`, error.response?.data || error.message);
        
        return await tryBackup(args, m);
    }
});

async function tryBackup(args, m) {
    try {
        const token = process.env.DEEPSEEK_TOKEN || "VK4fry";
        const urlBackup = `https://whiteshadow-x-api.vercel.app/api/ai/deepseekv4?q=${encodeURIComponent(args)}&apitoken=${token}`;
        const resBackup = await axios.get(urlBackup, { timeout: 7000 });
        
        if (resBackup.data && resBackup.data.success && resBackup.data.response) {
            await m.react("✅");
            return m.reply(resBackup.data.response);
        } else {
            throw new Error("Backup Invalid Response");
        }
    } catch (backupError) {
        await m.react("❌");
        return m.reply(`❌ *මචං GROQ සර්වර් එක වගේම බැකප් සර්වර්ස් සියල්ලම මේ වෙලාවේ ඩවුන්!*`);
    }
}
