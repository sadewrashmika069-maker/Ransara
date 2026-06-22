const axios = require("axios");
const FormData = require("form-data");
const { Sparky } = require("../lib");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

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
    let text = "";
    if (Array.isArray(args) && args.length) text = args.join(" ").trim();
    else if (typeof args === "string" && args.trim()) text = args.trim();
    else if (m?.text) text = m.text.replace(/^[./!#]ai3\s*/i, "").trim();

    if (!text && m?.quoted?.text) {
        text = m.quoted.text.trim();
    }
    return text; 
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

    const priorityKeys = ["BK9", "result", "response", "answer", "message", "text", "content", "reply", "output", "data"];
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

// Image Uploader (Uguu + Tmpfiles)
async function uploadImageToUrl(buffer, mimeType) {
    const ext = mimeType.split("/")[1] || "jpeg";
    const filename = `file_${Date.now()}.${ext}`;
    let finalUrl = null;

    try {
        const bodyForm1 = new FormData();
        bodyForm1.append("files[]", buffer, { filename, contentType: mimeType });
        const res1 = await axios.post("https://uguu.se/api.php?d=upload-tool", bodyForm1, {
            headers: bodyForm1.getHeaders()
        });
        if (res1.data && res1.data.includes("http")) finalUrl = res1.data.trim();
    } catch (e) {
        console.log("Uguu failed, trying Tmpfiles...");
    }

    if (!finalUrl) {
        try {
            const bodyForm2 = new FormData();
            bodyForm2.append("file", buffer, { filename, contentType: mimeType });
            const res2 = await axios.post("https://tmpfiles.org/api/v1/upload", bodyForm2, {
                headers: bodyForm2.getHeaders()
            });
            if (res2.data && res2.data.status === "success") {
                finalUrl = res2.data.data.url.replace("https://tmpfiles.org/", "https://tmpfiles.org/dl/");
            }
        } catch (e) {
            throw new Error("සියලුම Image Uploader සර්වර් අක්‍රියයි.");
        }
    }
    return finalUrl;
}

// 🔴 MULTI-API SYSTEM FOR TEXT
async function askGeminiText(prompt) {
    const q = `${prompt}\n\n${STYLE_INSTRUCTION}`;
    const apiList = [
        { url: "https://api.siputzx.my.id/api/ai/gemini", params: { content: q } },
        { url: "https://api.giftedtech.my.id/api/ai/geminiai", params: { apikey: "gifted", q: q } },
        { url: "https://whiteshadow-x-api.onrender.com/api/ai/gemini", params: { q: q, apitoken: API_TOKEN } }
    ];

    for (let api of apiList) {
        try {
            const { data } = await axios.get(api.url, {
                timeout: REQUEST_TIMEOUT_MS,
                params: api.params,
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }
            });
            
            // HTML ආවොත් මේ API එක අතෑරලා ඊළඟ එකට යනවා
            if (typeof data === "string" && data.trim().startsWith("<")) continue;
            
            const answer = extractTextFromObject(data);
            if (answer) return answer;
        } catch (e) {
            continue; // Error ආවොත් ඊළඟ API එක ට්‍රයි කරනවා
        }
    }
    throw new Error("සියලුම AI සර්වර් මේ මොහොතේ කාර්යබහුලයි හෝ අවහිර කර ඇත.");
}

// 🔴 MULTI-API SYSTEM FOR VISION (IMAGES)
async function askGeminiVision(prompt, imageUrl) {
    const q = `${prompt}\n\n${STYLE_INSTRUCTION}`;
    const apiList = [
        { url: "https://api.siputzx.my.id/api/ai/gemini-image", params: { url: imageUrl, text: q } },
        { url: "https://api.yanzbotz.my.id/api/ai/geminiImage", params: { url: imageUrl, query: q } },
        { url: "https://api.bk9.site/ai/geminiimg", params: { q: q, url: imageUrl } }
    ];

    for (let api of apiList) {
        try {
            const { data } = await axios.get(api.url, {
                timeout: REQUEST_TIMEOUT_MS,
                params: api.params,
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36" }
            });

            // HTML ආවොත් මේ API එක අතෑරලා ඊළඟ එකට යනවා
            if (typeof data === "string" && data.trim().startsWith("<")) continue;

            const answer = extractTextFromObject(data);
            if (answer) return answer;
        } catch (e) {
            continue; // Error ආවොත් ඊළඟ API එක ට්‍රයි කරනවා
        }
    }
    throw new Error("සියලුම Image Vision සර්වර් මේ මොහොතේ කාර්යබහුලයි හෝ අවහිර කර ඇත.");
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
    let mimeType = "image/jpeg";

    if (m.quoted && m.quoted.message) {
        let quotedType = Object.keys(m.quoted.message)[0];
        if (quotedType === 'messageContextInfo') quotedType = Object.keys(m.quoted.message)[1];
        if (quotedType === 'imageMessage') {
            isImage = true;
            targetMessage = m.quoted.message.imageMessage;
            mimeType = m.quoted.message.imageMessage.mimetype || "image/jpeg";
            if (!prompt) prompt = "කරුණාකර මෙම ඡායාරූපය ගැන විස්තර කරන්න.";
        }
    } else if (m.message && m.message.imageMessage) {
        isImage = true;
        targetMessage = m.message.imageMessage;
        mimeType = m.message.imageMessage.mimetype || "image/jpeg";
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
            let imageUrl = await uploadImageToUrl(imageBuffer, mimeType);
            answer = await askGeminiVision(prompt, imageUrl);
        } else {
            answer = await askGeminiText(prompt);
        }

        await sendText(m, client, answer);
        await safeReact(m, EMOJI_DONE);

    } catch (error) {
        console.error("ai3 command error:", error);
        await safeReact(m, EMOJI_ERROR);
        const errMsg = error?.response?.data?.message || error?.response?.statusText || error.message || "Unknown Error";
        return sendText(m, client, `${EMOJI_ERROR} AI3 Error.\nReason: ${errMsg}`);
    }
});
