const { Sparky, isPublic } = require("../lib");
const axios = require("axios");
const FormData = require("form-data");

// 🎵 Music Recognition API ක්‍රම සහ Tokens (Failover List)
// එකක් ෆේල් වුණොත් අනෙකට මාරු වේ. ඔයාට තව කීස් (Keys) තියෙනවා නම් මෙතනට එකතු කරන්න පුළුවන්.
const API_KEYS = [
    "8d48a5d0f1c1f94d56cde6edf1b2bf00", // 1. ඔයා ලබාදුන් ප්‍රධාන API Key එක
    "test",                             // 2. AudD Public Test Token
    "6cd0e6edf1b2bf008d48a5d0f1c1f94d", // 3. Backup Key Slot 1 (උදාහරණයක් ලෙස)
    "b2bf008d48a5d0f1c1f94d56cde6edf", // 4. Backup Key Slot 2
    "f1c1f94d56cde6edf1b2bf008d48a5d0"  // 5. Backup Key Slot 3
];

Sparky(
  {
    name: "find",
    alias: ["shazam", "whatsong", "findsong"],
    fromMe: isPublic,
    category: "tools",
    desc: "Reply to an audio or video to find the song name using multi-API recognition.",
  },
  async ({ m, client, args }) => {
    
    // 🛡️ Fail-Safe Message Sender (ඔයාගේ Edit ෆයිල් එකේ තිබ්බ සුපිරිම ක්‍රමය)
    const sendMsg = async (text) => {
      try {
        if (typeof m.reply === "function") {
          await m.reply(text);
        } else {
          await client.sendMessage(m.jid, { text }, { quoted: m });
        }
      } catch (e) {
        console.error("[SADEW-MD BOT] Find reply failed, trying backup send:", e.message);
        try {
          await client.sendMessage(m.jid, { text });
        } catch (err) {
          console.error("[SADEW-MD BOT] Totally unable to send message:", err.message);
        }
      }
    };

    // 🌟 GLOBAL TRY-CATCH SYSTEM
    try {
      console.log("[SADEW-MD BOT] .find command execution started.");

      // චැට් එකේ වීඩියෝ හෝ ඕඩියෝ එකකට රිප්ලයි කරලාද බලනවා
      const isQuotedMedia = m.quoted && (
          m.quoted.mtype === "audioMessage" || 
          m.quoted.mtype === "videoMessage" ||
          m.quoted.type === "audio" ||
          m.quoted.type === "video" ||
          (m.quoted.mime && (m.quoted.mime.startsWith("audio/") || m.quoted.mime.startsWith("video/"))) ||
          !!m.quoted.message?.audioMessage ||
          !!m.quoted.message?.videoMessage ||
          !!m.quoted.message?.viewOnceMessage?.message?.videoMessage
      );

      if (!isQuotedMedia) {
        return await sendMsg("❌ *Error:* කරුණාකර සින්දුව සෙවීමට අවශ්‍ය වීඩියෝවකට (Video) හෝ ඕඩියෝවකට (Audio) රිප්ලයි කර `.find` ලෙස ටයිප් කරන්න.");
      }

      // ටයිප් කරන බව පෙන්වීමට Reaction එකක් දානවා
      try { if (typeof m.react === "function") await m.react("⏳"); } catch {}

      // 1. Media Download කිරිම
      console.log("[SADEW-MD BOT] Downloading media from WhatsApp...");
      await sendMsg("⏳ _Downloading media file into RAM Buffer..._");
      
      let mediaBuffer;
      try {
        if (typeof m.quoted.download === "function") {
            mediaBuffer = await m.quoted.download();
        } else if (client.downloadMediaMessage) {
            mediaBuffer = await client.downloadMediaMessage(m.quoted);
        } else {
            const msg = m.quoted.message?.audioMessage || m.quoted.message?.videoMessage || m.quoted.message?.viewOnceMessage?.message?.videoMessage;
            if (msg) mediaBuffer = await client.downloadMediaMessage(msg);
        }
        
        if (!mediaBuffer) throw new Error("Downloaded buffer is empty.");
        console.log("[SADEW-MD BOT] Media Download Success. Size:", mediaBuffer.length, "bytes");
      } catch (err) {
        console.error("[SADEW-MD BOT] Media Download Failed:", err.message);
        try { if (typeof m.react === "function") await m.react("❌"); } catch {}
        return await sendMsg("❌ *Error:* වීඩියෝව/ඕඩියෝව ඩවුන්ලෝඩ් කරගැනීමට නොහැකි විය.");
      }

      const mimetype = m.quoted.mime || (m.quoted.mtype === "audioMessage" ? "audio/mp3" : "video/mp4");

      // 2. Multi-API Loop එක (එකක් ෆේල් වුනොත් ඊළඟ එකට යන සිස්ටම් එක)
      await sendMsg("🔍 _Analyzing audio track with Multi-API Recognition System..._");
      
      let songData = null;
      let usedMethodIndex = -1;

      for (let i = 0; i < API_KEYS.length; i++) {
         const currentKey = API_KEYS[i];
         console.log(`[SADEW-MD BOT] Trying Music API Method ${i + 1} with Token: ${currentKey}`);

         try {
            const form = new FormData();
            form.append("api_token", currentKey);
            form.append("file", mediaBuffer, { filename: "media.mp4", contentType: mimetype });
            form.append("return", "apple_music,spotify");

            // API එකට රික්වෙස්ට් එක යැවීම (Timeout තත්පර 15කට සෙට් කලා හිරවීම් නැති කරන්න)
            const response = await axios.post("https://api.audd.io/", form, {
                headers: form.getHeaders(),
                timeout: 15000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            if (response.data && response.data.status === "success" && response.data.result) {
                songData = response.data.result;
                usedMethodIndex = i + 1;
                break; // සින්දුව හම්බුනා නම් ලූප් එක නවත්තනවා
            } else {
                console.warn(`[SADEW-MD BOT] Method ${i + 1} did not find any match.`);
            }
         } catch (apiErr) {
            console.error(`[SADEW-MD BOT] Method ${i + 1} Failed with error:`, apiErr.message);
            // ඊළඟ API කී එකට ඔටෝම මාරු වේ...
         }
      }

      // 3. ප්‍රතිඵල පරිශීලකයා වෙත යැවීම
      if (songData) {
         console.log("[SADEW-MD BOT] Song found successfully via Method:", usedMethodIndex);
         
         let resultMsg = `*🎵 සින්දුව හඳුනාගත්තා (Sadew MD) 🎵*\n\n`;
         resultMsg += `*📌 නම:* ${songData.title || "නොදනී"}\n`;
         resultMsg += `*👤 ගායකයා:* ${songData.artist || "නොදනී"}\n`;
         
         if (songData.album) {
             resultMsg += `*💿 ඇල්බමය:* ${songData.album}\n`;
         }
         if (songData.release_date) {
             resultMsg += `*📅 නිකුත් වූ දිනය:* ${songData.release_date}\n`;
         }

         const link = songData.spotify ? songData.spotify.external_urls.spotify : (songData.song_link || "");
         if (link) {
             resultMsg += `\n*🎧 Listen Now:* ${link}`;
         }
         
         resultMsg += `\n\n⚙️ _Bypass System: Method ${usedMethodIndex} Active_`;

         try { if (typeof m.react === "function") await m.react("✅"); } catch {}
         return await sendMsg(resultMsg);

      } else {
         // හැම API එකක්ම ෆේල් වුනොත්
         try { if (typeof m.react === "function") await m.react("❌"); } catch {}
         return await sendMsg("❌ *Error:* කණගාටුයි, ලබාදුන් සියලුම API ක්‍රම මඟින් මෙම වීඩියෝවේ ඇති සින්දුව හඳුනා ගැනීමට අපොහොසත් වුණා. (පසුබිම් ශබ්ද වැඩි නිසා හෝ සින්දුව පැහැදිලි නැති නිසා විය හැක)");
      }

    } catch (globalError) {
      console.error("[SADEW-MD BOT] CRITICAL GLOBAL ERROR IN FIND COMMAND:", globalError);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      await sendMsg(`❌ *Sadew-MD Internal Error:* ${globalError.message}\n\nPlease check \`pm2 logs\` in GitHub Actions.`);
    }
  }
);