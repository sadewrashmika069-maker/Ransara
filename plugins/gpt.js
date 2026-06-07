const { Sparky, isPublic } = require("../lib");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// GitHub Secrets වල තියෙන GEMINI_API_KEY එක ගන්නවා
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
      // ✅ මෙතන Class name එක සහ Key එක දෙන විදිහ නිවැරදි කරලා තියෙන්නේ මචං
      const genAI = new GoogleGenerativeAI(aiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // AI එකෙන් පිළිතුර ලබා ගැනීම
      const result = await model.generateContent(queryText);
      const response = await result.response;
      const replyAnswer = response.text();

      if (!replyAnswer) throw new Error("AI එකෙන් නිසි ප්‍රතිචාරයක් ලැබුණේ නැත.");

      await m.react('💬');
      
      const captionText = `🤖 *AI ANSWER (GEMINI)*\n\n${replyAnswer}\n\n*POWERED BY SADEW-MD*`;
      
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
