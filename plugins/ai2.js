const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

Sparky(
  {
    name: "ai2",
    fromMe: isPublic,
    category: "ai",
    desc: "Chat with FeelBetter AI naturally in Sinhala.",
  },
  async ({ m, client, args }) => {
    if (!args || args.trim() === "") {
      return await client.sendMessage(
        m.jid, 
        { text: "❌ *Usage:* `.ai2 ඔයාට දැනගන්න ඕනේ දේ ටයිප් කරන්න.*" }, 
        { quoted: m }
      );
    }

    const queryText = args.trim();
    await m.react('🧠');

    try {
      // සිංහලෙන් විතරක් උත්තර ගන්න දාපු සරල Instruction එක
      const systemPrompt = "Instruction: Answer the following user question strictly and naturally in Sinhala language. User Question: ";
      const finalQuery = systemPrompt + queryText;

      const response = await axios.get("https://whiteshadow-x-api.onrender.com/api/ai/feelbetter", {
        params: {
          text: finalQuery,
          apitoken: "VK4fry"
        },
        timeout: 15000
      });

      if (!response || !response.data) {
        await m.react('❌');
        return await client.sendMessage(
          m.jid,
          { text: "⚠️ *AI Error:* API සර්වර් එකෙන් කිසිම ප්‍රතිචාරයක් ලැබුණේ නැහැ මචං." },
          { quoted: m }
        );
      }

      let replyAnswer = "";
      let resData = response.data;

      // JSON String එකක් ආවොත් Object එකක් බවට පත් කිරීම
      if (typeof resData === "string") {
        try {
          resData = JSON.parse(resData);
        } catch (e) {
          replyAnswer = resData;
        }
      }

      // 🌟 [object Object] ලෙඩේ 100%ක් නැති කරන සුපිරි Logic එක
      if (resData && typeof resData === "object") {
        // API එකෙන් එන්න පුළුවන් හැම Key එකක්ම චෙක් කරනවා
        let mainData = resData.response || resData.result || resData.reply || resData.data || resData.message;
        
        if (mainData && typeof mainData === "object") {
          // ප්‍රධාන කෑල්ලත් Object එකක් නම් ඒක ඇතුළේ තියෙන Text එක ගන්නවා
          replyAnswer = mainData.text || mainData.response || mainData.result || mainData.message || JSON.stringify(mainData);
        } else if (mainData) {
          replyAnswer = String(mainData);
        }
      }

      // හැමදේම කරලත් replyAnswer එක හිස් නම් හෝ [object Object] ම ආවොත් JSON එක String එකක් කරලා ගන්නවා
      if (!replyAnswer || replyAnswer === "[object Object]" || replyAnswer === "{}") {
        replyAnswer = typeof resData === "object" ? JSON.stringify(resData) : String(resData);
      }

      await m.react('💬');
      
      const captionText = `🤖 *AI ANSWER (FEELBETTER AI)*\n\n${replyAnswer}\n\n*POWERED BY SADEW-MD*`;
      
      await client.sendMessage(m.jid, { text: captionText }, { quoted: m });

    } catch (error) {
      await m.react('❌');
      console.error("FeelBetter API Error:", error.message);
      
      let errorMsg = `❌ *AI Error:* ${error.message}`;
      if (error.message.includes("timeout")) {
        errorMsg = "❌ *Timeout:* සර්වර් එකෙන් Response එක එන්න ගොඩක් වෙලා යනවා මචං.";
      }
      
      await client.sendMessage(m.jid, { text: errorMsg }, { quoted: m });
    }
  }
);
