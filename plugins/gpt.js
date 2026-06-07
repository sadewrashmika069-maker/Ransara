const { Sparky, isPublic } = require("../lib");
const { GoogleGenAI } = require("@google/generative-ai");

// GitHub Secrets වල තියෙන GEMINI_API_KEY එක කෙලින්ම ගන්නවා
const aiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

Sparky(
  {
    name: "gpt",
    fromMe: isPublic,
    category: "ai",
    desc: "Super stable AI chat powered by official Gemini.",
  },
  async ({ m, client, args }) => {
    if (!args || args.trim() === "") {
      return await client.sendMessage(
        m.jid, 
        { text: "❌ *Usage:* `.gpt ඔයාට දැනගන්න ඕනේ දේ ටයිප් කරන්න.*" }, 
        { quoted: m }
      );
    }

    // API Key එක නැත්නම් එරර් එකක් දෙනවා
    if (!aiKey) {
      return await client.sendMessage(
        m.jid,
        { text: "❌ *Error:* `GEMINI_API_KEY` එක GitHub Secrets වල සෙට් කරලා නැහැ මචං!" },
        { quoted: m }
      );
    }

    const queryText = args.trim();
    await m.react('🧠');

    try {
      // Official Google AI පද්ධතියට කනෙක්ට් වෙනවා
      const aiConfig = new GoogleGenAI({ apiKey: aiKey });
      const model = aiConfig.getGenerativeModel({ model: "gemini-pro" });

      // AI එකෙන් උත්තරේ ඉල්ලනවා
      const result = await model.generateContent(queryText);
      const response = await result.response;
      const replyAnswer = response.text();

      if (!replyAnswer) throw new Error("AI එකෙන් නිසි ප්‍රතිචාරයක් ලැබුණේ නැත.");

      await m.react('💬');
      
      // ChatGPT වගේම පෙනුම තියාගන්න Caption එක මෙහෙම හැදුවා
      const captionText = `🤖 *AI ANSWER (GEMINI-PRO)*\n\n${replyAnswer}\n\n*POWERED BY SADEW-MD*`;
      
      await client.sendMessage(m.jid, { text: captionText }, { quoted: m });

    } catch (error) {
      await m.react('❌');
      console.error("Gemini Error:", error);
      await client.sendMessage(
        m.jid, 
        { text: `❌ *AI Error:* ${error.message}` }, 
        { quoted: m }
      );
    }
  }
);
