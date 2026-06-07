const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

Sparky(
  {
    name: "gpt",
    fromMe: isPublic,
    category: "ai",
    desc: "Chat with ChatGPT (No API Key Required).",
  },
  async ({ m, client, args }) => {
    // 1. යූසර් මැසේජ් එකක් ටයිප් කරලා නැත්නම් එරර් එකක් දෙනවා
    if (!args || args.trim() === "") {
      return await client.sendMessage(
        m.jid, 
        { text: "❌ *Usage:* `.gpt ඔයාට දැනගන්න ඕනේ දේ ටයිප් කරන්න.*" }, 
        { quoted: m }
      );
    }

    const queryText = args.trim();
    
    // ⏳ පොඩ්ඩක් ඉන්න කියලා රියැක්ෂන් එකක් දානවා
    await m.react('🧠');

    try {
      // 2. API Key එකක් නැතුව කෙලින්ම වැඩ කරන Public ChatGPT API එක
      const apiUrl = `https://api.sandipbaruwal.codes/gpt4?query=${encodeURIComponent(queryText)}`;
      
      // Axios හරහා රික්වෙස්ට් එක යවනවා
      const response = await axios.get(apiUrl, { timeout: 15000 });
      const data = response.data;

      // 3. API එකෙන් උත්තරේ ආවේ නැත්නම් එරර් එකක් ත්‍රෝ කරනවා
      if (!data || !data.answer) {
        throw new Error("ChatGPT සාර්ථකව ප්‍රතිචාර දැක්වූයේ නැත.");
      }

      const replyAnswer = data.answer;

      // ✅ සාර්ථකයි කියලා රියැක්ෂන් එක දාලා මැසේජ් එක වට්ස්ඇප් යවනවා
      await m.react('💬');
      
      const captionText = `🤖 *CHAT-GPT ANSWER*\n\n${replyAnswer}\n\n*POWERED BY SADEW-MD*`;
      
      await client.sendMessage(m.jid, { text: captionText }, { quoted: m });

    } catch (error) {
      // ❌ මොකක් හරි අවුලක් වුණොත් රියැක්ෂන් එක දාලා ලොග් කරනවා
      await m.react('❌');
      console.error("ChatGPT Error:", error);
      
      let errorMsg = error.message.includes("timeout")
        ? "❌ *Timeout:* සර්වර් එකෙන් උත්තරයක් දෙන්න ප්‍රමාද වැඩියි."
        : `❌ *Error:* ${error.message}`;
        
      await client.sendMessage(m.jid, { text: errorMsg }, { quoted: m });
    }
  }
);
