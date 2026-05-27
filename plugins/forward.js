// commands/forward.js - Owner check removed (anyone can use)
const { Sparky } = require("../lib");

// ආරක්ෂක සැකසුම් (same as before)
const SAFETY = {
  MAX_JIDS: 20,
  BASE_DELAY: 2000,
  EXTRA_DELAY: 4000,
};

Sparky({
  name: "forward",
  category: "tools",           // category owner වෙනුවට tools
  fromMe: false,                // public command
  desc: "📨 උපුටා දක්වන ලද පණිවිඩය ගෘප් කිහිපයකට තොග වශයෙන් forward කරයි (සැමට අවසර)",
  alias: ["fwd"]
}, async ({ client, m, args }) => {
  try {
    // ===== [Owner check එක සම්පූර්ණයෙන්ම ඉවත් කර ඇත] =====

    // ===== [Reply check] =====
    if (!m.quoted) {
      return m.reply("*🍁 කරුණාකර forward කිරීමට අවශ්‍ය පණිවිඩයට reply කරන්න*");
    }

    // ===== [JID input එක parse කිරීම] =====
    let jidInput = "";
    if (args && Array.isArray(args)) {
      jidInput = args.join(" ").trim();
    } else if (typeof args === "string") {
      jidInput = args.trim();
    } else if (args && typeof args === "object") {
      jidInput = Object.values(args).join(" ").trim();
    }

    if (!jidInput) {
      return m.reply(
        "❌ කරුණාකර ගෘප් JIDs එක් කරන්න.\n\n" +
        "උදාහරණ:\n" +
        ".forward 120363411055156472@g.us,120363333939099948@g.us\n" +
        ".fwd 120363411055156472 120363333939099948"
      );
    }

    // JIDs parse කිරීම
    const rawJids = jidInput.split(/[\s,]+/).filter(j => j.trim().length > 0);
    const validJids = rawJids
      .map(jid => {
        let clean = jid.replace(/@g\.us$/i, "");
        if (/^\d+$/.test(clean)) return `${clean}@g.us`;
        return null;
      })
      .filter(j => j !== null)
      .slice(0, SAFETY.MAX_JIDS);

    if (validJids.length === 0) {
      return m.reply("❌ වලංගු ගෘප් JID කිසිවක් හමු නොවිණි.");
    }

    // ===== [උපුටා දක්වන ලද පණිවිඩයෙන් content එක ලබා ගැනීම] =====
    const quotedMsg = m.quoted;
    const mtype = Object.keys(quotedMsg.message)[0];
    let messageContent = {};

    // Media types
    if (["imageMessage", "videoMessage", "audioMessage", "stickerMessage", "documentMessage"].includes(mtype)) {
      const buffer = await quotedMsg.download();
      const caption = quotedMsg.message[mtype].caption || "";

      switch (mtype) {
        case "imageMessage":
          messageContent = { image: buffer, caption: caption };
          break;
        case "videoMessage":
          messageContent = { video: buffer, caption: caption };
          break;
        case "audioMessage":
          messageContent = { audio: buffer, ptt: quotedMsg.message[mtype].ptt || false };
          break;
        case "stickerMessage":
          messageContent = { sticker: buffer };
          break;
        case "documentMessage":
          messageContent = {
            document: buffer,
            fileName: quotedMsg.message[mtype].fileName || "document",
            mimetype: quotedMsg.message[mtype].mimetype,
            caption: caption
          };
          break;
      }
    }
    // Text messages
    else if (mtype === "conversation" || mtype === "extendedTextMessage") {
      let text = quotedMsg.message.conversation || quotedMsg.message.extendedTextMessage?.text;
      messageContent = { text: text };
    }
    // Unsupported
    else {
      return m.reply("❌ මෙම පණිවිඩ වර්ගය forward කළ නොහැක. (සහාය නොදක්වයි)");
    }

    // ===== [තොග වශයෙන් යැවීම] =====
    let successCount = 0;
    const failedJids = [];

    for (let i = 0; i < validJids.length; i++) {
      const jid = validJids[i];
      try {
        await client.sendMessage(jid, messageContent);
        successCount++;

        if ((i + 1) % 10 === 0) {
          await m.reply(`🔄 ගෘප් ${i + 1}/${validJids.length} වෙත යවන ලදී...`);
        }

        const delay = (i + 1) % 10 === 0 ? SAFETY.EXTRA_DELAY : SAFETY.BASE_DELAY;
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (err) {
        failedJids.push(jid.replace("@g.us", ""));
        console.error(`Send to ${jid} failed:`, err.message);
      }
    }

    // ===== [වාර්තාව] =====
    let report = `✅ *Forward සම්පූර්ණයි*\n` +
                 `📤 සාර්ථක: ${successCount}/${validJids.length}\n` +
                 `📦 අන්තර්ගතය: ${mtype.replace("Message", "")}\n`;

    if (failedJids.length > 0) {
      report += `\n❌ අසාර්ථක (${failedJids.length}): ${failedJids.slice(0, 5).join(", ")}`;
      if (failedJids.length > 5) report += ` +${failedJids.length - 5} වැඩිපුර`;
    }

    if (rawJids.length > SAFETY.MAX_JIDS) {
      report += `\n⚠️ සටහන: පළමු ${SAFETY.MAX_JIDS} JIDs පමණක් සලකා ඇත.`;
    }

    await m.reply(report);

  } catch (error) {
    console.error("Forward command error:", error);
    m.reply(`💢 දෝෂයක් හමු විය:\n${error.message.substring(0, 150)}`);
  }
});
