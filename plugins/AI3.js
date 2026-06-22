const axios = require("axios");
const FormData = require("form-data");
const { Sparky } = require("../lib");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// 🔴 API URLs - GitHub Actions වලට වැඩ කරන ඒවා!
const TEXT_API_URL = "https://whiteshadow-x-api.onrender.com/api/ai/gemini"; // ඔයාගේ පරණ වැඩ කරපු API එක
const VISION_API_URL = "https://api.joshweb.click/api/gemini-vision"; // Cloudflare නැති අලුත් Vision API එක

const API_TOKEN = process.env.WHITESHADOW_API_TOKEN || "VK4fry";
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 40000);

const EMOJI_THINKING = "\uD83E\uDD16";
const EMOJI_DONE = "\u2705";
const EMOJI_ERROR = "\u274C";

const STYLE_INSTRUCTION = "Reply in a natural Sinhala and English mixed style.nutural sinhala kind friendly sinhala latters.don'tUse singlish.use friendly clear Sinhala-English mix like a Sri Lankan WhatsApp chat.";

// --- Helper Functions ---

function getJid(m) {
    return m.jid || m.chat || m.from || m.key?.remoteJid;
}

function getPrompt(args, m) {
    if (Array.isArray(args) && args.length) return args.join(" ").trim();
    if (typeof args === "string" && args.trim()) return args.trim();
    if (m?.quoted?.text) return m.quoted.text.trim();
    if (m?.text) return m.text.replace(/^[./!#]ai3\s*/i, "").trim();
    return "";
}

function extractTextFromObject(value, depth = 0) {
    if (!value || depth > 4) return "";
    if (typeof value === "string") return value.trim();
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = extractTextFromObject(item, depth + 1);
            if (found) return found;
        }
        return "";
    }
    if (typeof value !== "object") return "";

    const priorityKeys = ["result", "response", "answer", "message", "text", "content", "reply", "output", "data"];
    for (const key of priorityKeys) {
        if (value[key]) {
            const found = extractTextFromObject(value[key], depth + 1);
            if (found) return found;
        }
    }
    return "";
}

async function safeReact(m, emoji) {
    try { await m.react?.(emoji); } catch (error) {}
}

async function sendText(m, client, text) {
    const jid = getJid(m);
    if (typeof m.reply === "function") return m.reply(text);
    if (typeof client?.sendMessage === "function") {
        return client.sendMessage(jid, { text }, { quoted: m });
    }
}

async function downloadMedia(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// 2. අලුත් Image Uploader එක (Headers එක්ක)
async function uploadImage(buffer) {
    try {
        let form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, { filename: "image.jpg", contentType: "image/jpeg" });
        
        // Catbox එකට යවනවා Browser එකකින් වගේ
        let { data } = await axios.post("https://catbox.moe/user/api.php", form, {
            headers: {
                ...form.getHeaders(),
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
            }
        });
        return data; 
    } catch (e) {
        try {
            // Catbox වැඩ නැත්නම් Uguu එකට යවනවා (Backup Plan)
            let form2 = new FormData();
            form2.append("files[]", buffer, { filename: "image.jpg", contentType: "image/jpeg" });
            
            let { data } = await axios.post("https://uguu.se/upload.php", form2, {
                headers: {
                    ...form2.getHeaders(),
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            });
            return data.files[0].url;
        } catch (err) {
            throw new Error("සියලුම Image Upload සර්වර් අක්‍රියයි.");
        }
    }
}

// 3. සාමාන්‍ය Text ප්‍රශ්න (ඔයාගේ පරණ API එකමයි)
async function askGeminiText(prompt) {
    const q = `${prompt}\n\n${STYLE_INSTRUCTION}`;
    const { data } = await axios.get(TEXT_API_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        params: { q: q, apitoken: API_TOKEN },
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        }
    });
    const answer = extractTextFromObject(data);
    if (!answer) throw new Error("API response is empty.");
    return answer;
}

// 4. ෆොටෝ එක්ක ප්‍රශ්න (JoshWeb API එක)
async function askGeminiVision(prompt, imageUrl) {
    const q = `${prompt}\n\n${STYLE_INSTRUCTION}`;
    const { data } = await axios.get(VISION_API_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        params: { q: q, url: imageUrl },
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        }
    });
    const answer = extractTextFromObject(data);
    if (!answer) throw new Error("Vision API response is empty.");
    return answer;
}

// --- Main Command ---

Sparky({
    name: "ai3", 
    fromMe: false,
    category: "ai",
    desc: "Chat with AI3 (Gemini Vision) in Sinhala-English mixed style.",
}, async ({ m, client, args }) => {
    
    let prompt = getPrompt(args, m);
    
    let isImage = false;
    let targetMessage = m.message;

    if (m.quoted && m.quoted.message) {
        let quotedType = Object.keys(m.quoted.message)[0];
        if (quotedType === 'messageContextInfo') quotedType = Object.keys(m.quoted.message)[1];
        if (quotedType === 'imageMessage') {
            isImage = true;
            targetMessage = m.quoted.message.imageMessage;
            if (!prompt) prompt = "කරුණාකර මෙම ඡායාරූපය ගැන විස්තර කරන්න.";
        }
    } else if (m.message && m.message.imageMessage) {
        isImage = true;
        targetMessage = m.message.imageMessage;
        if (!prompt) prompt = "කරුණාකර මෙම ඡායාරූපය ගැන විස්තර කරන්න.";
    }

    if (!prompt && !isImage) {
        return sendText(m, client, `${EMOJI_ERROR} *Usage:* \`.ai3 oyage question eka\`\n\nExample: .ai3 Write a poem about nature`);
    }

    try {
        await safeReact(m, EMOJI_THINKING);
        await client.sendPresenceUpdate('composing', getJid(m));

        let answer = "";

        if (isImage) {
            let imageBuffer = await downloadMedia(targetMessage, 'image');
            let imageUrl = await uploadImage(imageBuffer);
            answer = await askGeminiVision(prompt, imageUrl);
        } else {
            answer = await askGeminiText(prompt);
        }

        await sendText(m, client, answer);
        await safeReact(m, EMOJI_DONE);

    } catch (error) {
        console.error("ai3 command error:", error);
        await safeReact(m, EMOJI_ERROR);
        return sendText(m, client, `${EMOJI_ERROR} AI3 Error.\nReason: ${error?.response?.data?.message || error.message || "Unknown Error"}`);
    }
});
