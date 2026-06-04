// commands/getdp.js
const { Sparky, isPublic } = require("../lib");

// Helper: extract number from command like .getdp94712345678
function extractNumberFromText(text, prefix) {
    // Remove the prefix (e.g., ".getdp") from the text
    let withoutPrefix = text.replace(prefix, '').trim();
    // Keep only digits (phone number)
    let digits = withoutPrefix.replace(/\D/g, '');
    return digits;
}

Sparky({
    name: "getdp",
    category: "tools",
    fromMe: isPublic,
    desc: "📸 Get WhatsApp profile picture, name, about, last seen, and number"
}, async ({ client, m, args, prefix }) => {
    // If user typed .getdp94712345678 (no space), then args[0] may contain the whole number
    let fullText = m.text || '';
    let number = '';

    // First try to get number from args (if space used)
    if (args && args.length > 0 && args[0]) {
        number = args.join('').replace(/\D/g, '');
    } else {
        // Extract from full message text (e.g., ".getdp94712345678")
        number = extractNumberFromText(fullText, `${prefix}getdp`);
    }

    if (!number || number.length < 10) {
        return m.reply(`📸 *Profile Picture Fetcher*

*Usage:* ${prefix}getdp94712345678
*Example:* ${prefix}getdp94753518443

*Note:* Include country code (e.g., 94 for Sri Lanka)
No spaces – type it directly after the command.`);
    }

    // Build WhatsApp JID
    let jid = number + '@s.whatsapp.net';

    await m.react("⏳");
    await client.sendPresenceUpdate('composing', m.jid);
    await m.reply(`🔍 Fetching profile for ${number}...`);

    try {
        // 1. Check if number exists on WhatsApp
        const [exists] = await client.onWhatsApp(jid);
        if (!exists || !exists.exists) {
            await m.react("❌");
            return m.reply(`❌ The number ${number} is not registered on WhatsApp.`);
        }

        // 2. Get profile picture URL (HD)
        let profilePicUrl = null;
        try {
            profilePicUrl = await client.profilePictureUrl(jid, 'image');
        } catch (err) {
            try {
                profilePicUrl = await client.profilePictureUrl(jid, 'preview');
            } catch (err2) {
                profilePicUrl = null;
            }
        }

        // 3. Get contact name (push name)
        let contactName = number;
        try {
            const contact = await client.contact[jid];
            if (contact && contact.name) contactName = contact.name;
            else if (contact && contact.notify) contactName = contact.notify;
        } catch (err) {
            contactName = number;
        }

        // 4. Get 'About' status
        let aboutStatus = 'Not available';
        try {
            const status = await client.fetchStatus(jid);
            if (status && status.status) aboutStatus = status.status;
        } catch (err) {
            aboutStatus = 'Not available (Privacy setting)';
        }

        // 5. Last seen – not directly available, we'll skip (or provide generic)
        let lastSeen = 'Not available (Privacy setting)';

        // Prepare response
        let caption = `📸 *WhatsApp Profile Info*\n\n`;
        caption += `📞 *Number:* ${number}\n`;
        caption += `👤 *Name:* ${contactName}\n`;
        caption += `📝 *About:* ${aboutStatus}\n`;
        caption += `⏱️ *Last Seen:* ${lastSeen}\n`;
        caption += `\n> *Powered by SADEW-MINI*`;

        // Send picture with caption
        if (profilePicUrl) {
            await client.sendMessage(m.jid, {
                image: { url: profilePicUrl },
                caption: caption
            }, { quoted: m });
        } else {
            caption = `🖼️ *No Profile Picture Set*\n\n` + caption.replace('📸 *WhatsApp Profile Info*', '');
            await client.sendMessage(m.jid, { text: caption }, { quoted: m });
        }

        await m.react("✅");

    } catch (error) {
        console.error("GetDP error:", error);
        await m.react("❌");
        let errorMsg = `❌ *Failed to fetch profile*\n\n`;
        if (error.message.includes('not-authorized')) {
            errorMsg += `The bot may not have permission. Ensure you are logged into WhatsApp Web.`;
        } else if (error.message.includes('404')) {
            errorMsg += `Profile picture not found or number not available.`;
        } else {
            errorMsg += `*Error:* ${error.message.substring(0, 150)}`;
        }
        await m.reply(errorMsg);
    }
});
