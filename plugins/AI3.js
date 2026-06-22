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

// 2. ෆොටෝ එක Catbox.moe එකට අප්ලෝඩ් කරලා Link එකක් ගන්නවා
async function uploadImage(buffer) {
    try {
        let form = new FormData();
        form.append("reqtype", "fileupload");
        form.append("fileToUpload", buffer, { filename: "image.jpg", contentType: "image/jpeg" });
        
        let { data } = await axios
