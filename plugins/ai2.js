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

      // 🌟 FeelBetter API එකට ගැලපෙන්න text පැරාමීටර් එක දැම්මා මචං
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
          { text: "⚠️ *AI Error:* API සර්වර් එකෙන් කිසිම ප්‍රතිචාරයක් ලැබුණේ නැහැ මචං. පොඩ්ඩක් ඉඳලා ආයෙත් උත්සාහ කරන්න." },
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

      if (resData && typeof resData === "object") {
        replyAnswer = resData.response || resData.result || resData.reply || resData.data;
      }

      // Regex Extraction (Strict Mode) - JSON පිටින් ප්‍රින්ට් වෙන එක වළක්වන්න
      if (!replyAnswer || typeof replyAnswer === "object" || (typeof replyAnswer === "string" && replyAnswer.includes('{"'))) {
        const rawString = typeof response.data === "string" ? response.data : JSON.stringify(response.data);
        const match = rawString.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (match && match[1]) {
          replyAnswer = match[1]
            .replace(/\\"/g, '"')
            .replace(/\\n/g, '\n')
            .replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
        }
      }

      if (!replyAnswer) {
        replyAnswer = typeof resData === "object" ? (resData.response || JSON.stringify(resData)) : resData;
      }

      // හිස් දත්ත ආවොත් වදින Filter එක
      if (!replyAnswer || replyAnswer === "{}" || replyAnswer === "[object Object]") {
        await m.react('❌');
        return await client.sendMessage(
          m.jid,
          { text: "⚠️ *AI Error:* API එකෙන් හිස් දත්ත (Empty Response) ලැබුණේ මචං. සර්වර් එක කාර්යබහුල ඇති." },
          { quoted: m }
        );
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
