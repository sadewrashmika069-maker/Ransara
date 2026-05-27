// commands/fancy.js
const { Sparky } = require("../lib");
const axios = require("axios");

Sparky({
  name: "fancy",
  alias: ["font", "style"],
  category: "tools",
  fromMe: false,           // public command
  desc: "✍️ ඔබගේ text එක විවිධ fancy fonts වලට හරවන්න"
}, async ({ client, m, args }) => {
  try {
    // User input එක ගන්න (args array එක string එකකට හරවන්න)
    let q = args.join(" ").trim();
    
    if (!q) {
      return m.reply(
        "❎ කරුණාකර fancy font එකට හරවන්න text එකක් ලබා දෙන්න.\n\n" +
        "*උදාහරණය:*\n.fancy whiteshadow"
      );
    }

    // API call එක
    const apiUrl = `https://movanest.xyz/v2/fancytext?word=${encodeURIComponent(q)}`;
    const { data } = await axios.get(apiUrl);

    if (!data || !data.status || !Array.isArray(data.results)) {
      return m.reply("❌ Fancy text එක ගේන්න බැරි වුණා. පසුව නැවත උත්සාහ කරන්න.");
    }

    // ප්‍රතිඵලය format කිරීම
    let text = `✨ *Fancy Fonts Converter* ✨\n`;
    text += `📝 *Word:* ${q}\n`;
    text += `🔢 *Total Fonts:* ${data.results.length}\n\n`;

    data.results.forEach((font, index) => {
      text += `*${index + 1}.* ${font}\n`;
    });

    text += `\n> © Powered by *SADEW-MINI*`;  // ඔයාගේ බොට් නම දාන්න

    await client.sendMessage(m.jid, { text: text }, { quoted: m });

  } catch (err) {
    console.error("Fancy command error:", err);
    m.reply("⚠️ Fancy fonts හදනකොට දෝෂයක් ඇති වුණා.");
  }
});
