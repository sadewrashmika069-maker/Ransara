const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

Sparky(
  {
    name: "gpt",
    fromMe: isPublic,
    category: "ai",
    desc: "Chat with ChatGPT 4o Mini in a natural Sinhala/English mixed style.",
  },
  async ({ m, client, args }) => {
    if (!args || args.trim() === "") {
      return await client.sendMessage(
        m.jid, 
        { text: "❌ *Usage:* `.gpt ඔයාට දැනගන්න ඕනේ දේ ටයිප් කරන්න.*" }, 
        { quoted: m }
      );
    }

    const queryText = args.trim();
    await m.react('🧠');

    try {
      // 🔥 AI එකට උඹ ඉල්ලපු විදිහටම Sinhala & English mix කරලා කතා කරන්න බල කරන හොර රහස් Instruction එක
      const systemPrompt = "Instruction: Act as a friendly WhatsApp bot. Respond in a casual, natural mix of Sinhala and English (using Sinhala script, but blending in standard English technical/common words naturally where necessary), exactly how friends text each other. Keep it engaging and smart. User Question: ";
      
      const finalQuery = systemPrompt + queryText;

      // API Request එක සිද්ධ වෙනවා
      const response = await axios.get("https://whiteshadow-x-api.onrender.com/api/ai/chatgpt", {
        params: {
          q: finalQuery,
          apitoken: "VK4fry"
        },
        timeout: 15000 // Timeout එක තත්පර 15ක් දුන්නා
      });

      const replyAnswer = response.data.result || response.data.response || response.data.reply || response.data;

      if (!replyAnswer) throw new Error("API එකෙන් නිසි ප්‍රතිචාරයක් ලැබුණේ නැත.");

      await m.react('💬');
      
      // ✅ උඹ ඉල්ලපු විදිහටම වෙනස් කරපු ලස්සන Caption format එක
      const captionText = `🤖 *AI ANSWER (GPT-4o MINI)*\n\n${replyAnswer}\n\n*POWERED BY SADEW-MD*`;
      
      await client.sendMessage(m.jid, { text: captionText }, { quoted: m });

    } catch (error) {
      await m.react('❌');
      console.error("ChatGPT API Error:", error.message);
      
      let errorMsg = `❌ *AI Error:* ${error.message}`;
      if (error.message.includes("timeout")) {
        errorMsg = "❌ *Timeout:* සර්වර් එකෙන් Response එක එන්න ගොඩක් වෙලා යනවා මචං.";
      }
      
      await client.sendMessage(m.jid, { text: errorMsg }, { quoted: m });
    }
  }
);
