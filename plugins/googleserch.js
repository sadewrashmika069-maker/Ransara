const { Sparky, isPublic } = require("../lib");
const axios = require("axios");

// 🔑 ඔයා ලබාදුන් නිවැරදි WhiteShadow API Token එක
const API_TOKEN = "VK4fry";

Sparky(
  {
    name: "google",
    alias: ["gsearch", "search", "සර්ච්"],
    fromMe: isPublic,
    category: "search",
    desc: "Search Google for links and get a live webpage screenshot.",
  },
  async ({ m, client, args }) => {
    try {
      // 🛠️ args එක String එකක්ද Array එකක්ද කියා පරික්ෂා කර සර්ච් කරන වචනය ගැනීම
      let textInput = "";
      if (typeof args === "string") {
          textInput = args.trim();
      } else if (Array.isArray(args)) {
          textInput = args.join(" ").trim();
      }
      
      textInput = textInput || m.quoted?.text || "";

      if (!textInput) {
        return await m.reply("❌ කරුණාකර සෙවිය යුතු දේ ඇතුළත් කරන්න.\n\n💡 උදා: `.google Sri Lanka`");
      }

      // බොටා වැඩ කරන බව පෙන්වීමට සර්ච් ඉමෝජි එකක් දාමු
      try { if (typeof m.react === "function") await m.react("🔍"); } catch {}

      // 🌐 1. Text Results ලබාගැනීම (WhiteShadow API)
      const targetUrl = `https://whiteshadow-x-api.onrender.com/api/search/google?q=${encodeURIComponent(textInput)}&apitoken=${API_TOKEN}`;
      
      console.log("[SADEW-MD GOOGLE] Fetching search results...");
      const response = await axios.get(targetUrl, { timeout: 30000 });

      if (response.data && response.data.success && response.data.result) {
          const results = response.data.result;
          
          if (results.length === 0) {
              try { if (typeof m.react === "function") await m.react("❌"); } catch {}
              return await m.reply("❌ ප්‍රතිඵල කිසිවක් හමු නොවීය.");
          }

          // 📝 සයිට් වල නම සහ ලින්ක් ලස්සනට Format කරගැනීම
          let searchMessage = `🔍 *Google Search Results for:* _${textInput}_\n\n`;
          
          results.forEach((item, index) => {
              searchMessage += `*${index + 1}. ${item.title}*\n`;
              searchMessage += `🔗 *Link:* ${item.link}\n`;
              searchMessage += `📝 _${item.snippet}_\n\n───────────────────\n\n`;
          });

          // ලින්ක්ස් ටික මුලින්ම මැසේජ් එකක් විදිහට යවනවා
          await m.reply(searchMessage);

          // 📸 2. Screenshot ලබාගැනීම (Free Web Screenshot API එකක් හරහා)
          // Google සර්ච් පේජ් එකේ ලයිව් පෙනුම ඉමේජ් එකක් විදිහට ගන්න thum.io පාවිච්චි කරනවා
          const screenshotUrl = `https://image.thum.io/get/width/1280/crop/800/https://www.google.com/search?q=${encodeURIComponent(textInput)}`;

          try {
              // ස්ක්‍රීන්ෂොට් එක යවන බව පෙන්වන්න කැමරා ඉමෝජි එකක් දානවා
              if (typeof m.react === "function") await m.react("📸");
              
              await client.sendMessage(
                  m.chat,
                  { 
                      image: { url: screenshotUrl }, 
                      caption: `📸 *Google Search View for:* _${textInput}_` 
                  },
                  { quoted: m }
              );
              
              if (typeof m.react === "function") await m.react("✅");
          } catch (imgError) {
              console.error("[SADEW-MD GOOGLE] Screenshot Error:", imgError.message);
              // ස්ක්‍රීන්ෂොට් එකේ මොකක් හරි අවුලක් වුණත් ලින්ක්ස් ටික ගිහින් තියෙන නිසා රිඇක්ෂන් එක විතරක් හරියක් දානවා
              if (typeof m.react === "function") await m.react("✅");
          }

      } else {
          if (typeof m.react === "function") await m.react("❌");
          return await m.reply("❌ *Error:* Google API එකෙන් දත්ත ලබාගැනීමට නොහැකි විය.");
      }

    } catch (error) {
      console.error("[SADEW-MD GOOGLE] Error:", error.message);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      return await m.reply(`❌ *Google Search Error:* ${error.message}`);
    }
  }
);
