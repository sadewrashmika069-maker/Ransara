const axios = require("axios");
const FormData = require("form-data");
const { Sparky } = require("../lib");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

// 🔴 API URLs 
const TEXT_API_URL = process.env.WHITESHADOW_API_TOKEN ? "https://whiteshadow-x-api.onrender.com/api/ai/gemini" : "https://api.bk9.site/ai/gemini"; 
const VISION_API_URL = "https://api.bk9.site/ai/geminiimg";

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
    // 🔴 මෙතන gemini වෙනුවට ai3 දැම්මා
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

// 1. ෆොටෝ එක Download කරලා Buffer එකක් ගන්නවා
async function downloadMedia(message, type) {
    const stream = await downloadContentFromMessage(message, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// 2. ෆොටෝ එක Telegra.ph එකට අප්ලෝඩ් කරලා Link එකක් ගන්නවා
async function uploadToTelegraph(buffer) {
    try {
        let form = new FormData();
        form.append("file", buffer, { filename: "image.jpg", contentType: "image/jpeg" });
        let { data } = await axios.post("https://telegra.ph/upload", form, {
            headers: form.getHeaders()
        });
        return "https://telegra.ph" + data[0].src;
    } catch (e) {
        throw new Error("Image Upload Failed");
    }
}

// 3. සාමාන්‍ය Text ප්‍රශ්න අහන Function එක
async function askGeminiText(prompt) {
    const q = `${prompt}\n\n${STYLE_INSTRUCTION}`;
    const { data } = await axios.get(TEXT_API_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        params: { q: q, apitoken: API_TOKEN }
    });
    const answer = extractTextFromObject(data);
    if (!answer) throw new Error("API response is empty.");
    return answer;
}

// 4. ෆොටෝ එක්ක ප්‍රශ්න අහන Function එක
async function askGeminiVision(prompt, imageUrl) {
    const q = `${prompt}\n\n${STYLE_INSTRUCTION}`;
    const { data } = await axios.get(VISION_API_URL, {
        timeout: REQUEST_TIMEOUT_MS,
        params: { q: q, url: imageUrl }
    });
    const answer = extractTextFromObject(data);
    if (!answer) throw new Error("Vision API response is empty.");
    return answer;
}

// --- Main Command ---

Sparky({
    name: "ai3", // 🔴 කමාන්ඩ් එක .ai3 කළා
    fromMe: false,
    category: "ai",
    desc: "Chat with AI3 (Gemini Vision) in Sinhala-English mixed style (Supports Images).",
}, async ({ m, client, args }) => {
    
    let prompt = getPrompt(args, m);
    
    let isImage = false;
    let targetMessage = m.message;

    // ෆොටෝ එකක් තියෙනවද කියලා චෙක් කරනවා
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
            // ෆොටෝ එකක් නම්: Download -> Upload to Telegraph -> Get API Response
            let imageBuffer = await downloadMedia(targetMessage, 'image');
            let imageUrl = await uploadToTelegraph(imageBuffer);
            answer = await askGeminiVision(prompt, imageUrl);
        } else {
            // සාමාන්‍ය Text එකක් නම්
            answer = await askGeminiText(prompt);
        }

        await sendText(m, client, answer);
        await safeReact(m, EMOJI_DONE);

    } catch (error) {
        console.error("ai3 command error:", error);
        await safeReact(m, EMOJI_ERROR);
        return sendText(m, client, `${EMOJI_ERROR} AI3 reply eka ganna bari una.\nReason: ${error?.response?.data?.message || error.message || "Unknown Error"}`);
    }
});
