const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

// 🔑 ඔයාගේ WolfApis API Key එක
const WOLF_API_KEY = "wxa_f_4e840b5e42";

Sparky(
  {
    name: "wormgpt",
    alias: ["ai", "ask", "chat"],
    fromMe: isPublic,
    category: "ai",
    desc: "Chat with WormGPT AI using WolfApis endpoint.",
  },
  async ({ m, client, args }) => {
    try {
      // 🛠️ args කියන්නේ String එකක් නිසා කෙලින්ම ගන්නවා (නැත්නම් quoted text එක ගන්නවා)
      let textInput = "";
      if (typeof args === "string") {
          textInput = args.trim();
      } else if (Array.isArray(args)) {
          textInput = args.join(" ").trim();
      }
      
      textInput = textInput || m.quoted?.text || "";

      if (!textInput) {
        return await m.reply("❌ කරුණාකර ප්‍රශ්නයක් හෝ විධානයක් ඇතුළත් කරන්න.\n\n💡 උදා: `.wormgpt write a html runner game code`");
      }

      // Reaction එකක් දැමීම
      try { if (typeof m.react === "function") await m.react("🧠"); } catch {}

      // 🌐 API URL එක සැකසීම
      const targetUrl = `https://apis.xwolf.space/api/ai/wormgpt?q=${encodeURIComponent(textInput)}&key=${WOLF_API_KEY}`;

      console.log("[SADEW-MD WORM-GPT] Sending request to WolfApis...");
      const response = await axios.get(targetUrl, { timeout: 40000 });

      // ⚙️ API Response එක චෙක් කිරීම
      if (response.data) {
          const aiReply = response.data.result || response.data.response || response.data.reply;

          if (aiReply) {
              try { if (typeof m.react === "function") await m.react("✅"); } catch {}
              return await m.reply(`🤖 *WormGPT AI Response:* \n\n${aiReply}`);
          } else {
              try { if (typeof m.react === "function") await m.react("✅"); } catch {}
              return await m.reply(`🤖 *WormGPT Raw Response:* \n\n${JSON.stringify(response.data, null, 2)}`);
          }
      } else {
          try { if (typeof m.react === "function") await m.react("❌"); } catch {}
          return await m.reply("❌ *Error:* API සේවාදායකයෙන් හිස් ප්‍රතිචාරයක් ලැබුණි.");
      }

    } catch (error) {
      console.error("[SADEW-MD WORM-GPT] Error:", error.message);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      return await m.reply(`❌ *WormGPT API Error:* ${error.message}`);
    }
  }
);
