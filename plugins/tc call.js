const { Sparky } = require("../lib");
const axios = require("axios");

Sparky({
    name: "truecaller",
    alias: ["tc", "caller", "searchnum"],
    category: "tools",
    desc: "Truecaller හරහා දුරකථන අංකයේ විස්තර සෙවීම"
}, async ({ client, m, args }) => {
    try {
        // අංකයක් දීලා නැත්නම්
        if (!args || args.length === 0) {
            return m.reply("❌ කරුණාකර දුරකථන අංකයක් ලබා දෙන්න.\n\n💡 *උදාහරණ:* .tc 94712345678");
        }

        // අංකයේ තියෙන හිස්තැන්, + ලකුණු අයින් කරලා පිරිසිදු කිරීම
        let phone = args.join("").replace(/[^0-9]/g, ""); 

        await m.reply("🔍 *අංකය සොයමින් පවතී... පොඩ්ඩක් ඉන්න...*");

        // අර ඔයා එවපු කෝඩ් එකේ තිබ්බ Truecaller API එකට Request එක යැවීම
        let response = await axios.get(`https://truecaller.privates-bots.workers.dev/?q=${encodeURIComponent(phone)}`);
        let data = response.data;

        // විස්තර ආවේ නැත්නම්
        if (!data || !data.Truecaller || data.Truecaller === "") {
            return m.reply("❌ සමාවන්න, මෙම අංකය පිළිබඳ කිසිදු තොරතුරක් සොයාගත නොහැකි විය.");
        }

        // ප්‍රතිඵලය ලස්සනට හදාගැනීම
        let msg = `╔════════════════════════╗\n`;
        msg += `║  🔎 *TRUECALLER LOOKUP* 🔎 \n`;
        msg += `╚════════════════════════╝\n\n`;
        
        msg += `📱 *Phone   :* ${data.international_format || phone}\n`;
        msg += `👤 *Name    :* ${data.Truecaller || "නොදනී"}\n`;
        msg += `🏢 *Carrier :* ${data.carrier || "නොදනී"}\n`;
        msg += `🌍 *Country :* ${data.country || "නොදනී"}\n`;
        msg += `📍 *Location:* ${data.location || "නොදනී"}\n\n`;
        
        msg += `> 💫 Powered by SADEW-MD`;

        await client.sendMessage(m.jid, { text: msg }, { quoted: m });

    } catch (e) {
        console.log("Truecaller Error:", e);
        m.reply("❌ සර්වර් එකේ දෝෂයක්. කරුණාකර පසුව නැවත උත්සාහ කරන්න.");
    }
});