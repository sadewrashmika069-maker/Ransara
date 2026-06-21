const { Sparky } = require("../lib");

// මැසේජ් මතක තියාගන්න Cache එක
if (!global.msgCache) global.msgCache = [];

// Event Listener එක දෙපාරක් රන් වෙන එක නවත්තන්න
let isListenerAdded = false;

Sparky({
    name: "antidelete",
    on: "message", // ඕනෑම මැසේජ් එකකදී ප්ලගින් එක ඇක්ටිව් වෙනවා
    fromMe: false,
    dontAddCommandList: true,
    desc: "Advanced Anti-Delete System for Text & Media"
}, async ({ client }) => {
    try {
        // Framework එකට හොරෙන් කෙලින්ම Baileys (WhatsApp Core) එකටම සම්බන්ධ වීම
        if (!isListenerAdded && client && client.ev) {
            isListenerAdded = true;
            console.log("✅ Advanced Anti-Delete Active (Text + Media Ready)!");

            client.ev.on("messages.upsert", async (chatUpdate) => {
                try {
                    for (let rawMsg of chatUpdate.messages) {
                        if (!rawMsg.message) continue;

                        // 1. මේක මැසේජ් එකක් මකන (REVOKE) සිග්නල් එකක්ද කියලා බලනවා
                        let isRevoke = rawMsg.message.protocolMessage && 
                                      (rawMsg.message.protocolMessage.type === 0 || 
                                       rawMsg.message.protocolMessage.type === "REVOKE" || 
                                       rawMsg.message.protocolMessage.type === 14);

                        if (isRevoke) {
                            let deletedId = rawMsg.message.protocolMessage.key.id;

                            // Cache එකේ තියෙනවද හොයනවා
                            let foundMsg = global.msgCache.find(msg => msg.id === deletedId);

                            if (foundMsg) {
                                let ownerNumber = "94783360267@s.whatsapp.net"; 

                                let textMsg = `🚫 *DELETED MESSAGE DETECTED* 🚫\n\n`;
                                textMsg += `👤 *Sender:* @${foundMsg.sender.split("@")[0]}\n`;
                                textMsg += `📌 *Chat:* ${foundMsg.chat.includes("-") || foundMsg.chat.includes("g.us") ? "Group" : "Private Inbox"}\n`;
                                textMsg += `⏳ *Time:* ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Colombo" })}\n\n`;
                                textMsg += `👇 *මැකූ පණිවිඩය පහතින් ඇත* 👇`;

                                // විස්තරේ යවනවා
                                await client.sendMessage(ownerNumber, { 
                                    text: textMsg, 
                                    mentions: [foundMsg.sender] 
                                });

                                // ඇත්තම මැසේජ් එක (ෆොටෝ/වීඩියෝ/Text/Sticker) ඒ විදිහටම එවනවා
                                await client.relayMessage(ownerNumber, foundMsg.message, { messageId: deletedId });
                            }
                        } 
                        // 2. මකන එකක් නෙමෙයි නම්, ඒක අනිවාර්යයෙන්ම අලුත් මැසේජ් එකක් (Media/Text ඔක්කොම Cache එකට දානවා)
                        else if (!rawMsg.key.fromMe) {
                            const exists = global.msgCache.find(msg => msg.id === rawMsg.key.id);
                            if (!exists) {
                                global.msgCache.push({
                                    id: rawMsg.key.id,
                                    message: rawMsg.message,
                                    sender: rawMsg.participant || rawMsg.key.participant || rawMsg.key.remoteJid,
                                    chat: rawMsg.key.remoteJid
                                });
                                
                                // මතකය පිරෙන එක නවත්තන්න 500කට සීමා කරනවා
                                if (global.msgCache.length > 500) {
                                    global.msgCache.shift();
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.log("Anti-Delete Event Error:", err);
                }
            });
        }
    } catch (e) {
        console.log("Anti-Delete Logic Error:", e);
    }
});
