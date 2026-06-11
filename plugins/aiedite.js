const { Sparky, isPublic } = require("../lib");
const axios = require("axios");
const FormData = require("form-data");

// API Config
const AI_EDIT_API_URL = "https://whiteshadow-x-api.onrender.com/api/ai/flatai-edit";
const API_TOKEN = "VK4fry"; // ඔයා දුන්න API Key එක

/**
 * Catbox.moe එකට Image Buffer එකක් Upload කරලා URL එක ගන්න Helper Function එක.
 * AI Edit API එකට URL එකක් අනිවාර්යයෙන්ම ඕනේ.
 */
async function uploadToCatbox(buffer) {
  try {
    const formData = new FormData();
    formData.append("reqtype", "fileupload");
    formData.append("fileToUpload", buffer, {
      filename: `sparky_edit_${Date.now()}.jpg`,
      contentType: "image/jpeg",
    });

    const response = await axios.post("https://catbox.moe/user/api.php", formData, {
      headers: formData.getHeaders(),
      timeout: 30000,
    });

    return response.data; // අප්ලෝඩ් වුණු ෆොටෝ එකේ URL එක
  } catch (error) {
    console.error("Catbox Upload Error:", error.message);
    return null;
  }
}

// Bot Command එක define කිරීම
Sparky(
  {
    name: "editimg",
    alias: ["edit", "aiedit", "imgedit"],
    fromMe: isPublic,
    category: "ai",
    desc: "Reply to an image with a prompt to edit it using AI.",
  },
  async ({ m, client, args }) => {
    // Prompt එක check කිරීම
    const prompt = Array.isArray(args) ? args.join(" ").trim() : String(args || "").trim();

    if (!prompt) {
      return await m.reply(
        `❌ *Usage:* Reply to an image and type:\n.edit <your prompt>\n\nExample:\n.edit add cyberpunk glasses`
      );
    }

    // Command එක reply කලේ Image එකකටද කියලා check කිරීම
    const isQuotedImage = m.quoted && (m.quoted.mtype === "imageMessage" || (m.quoted.mtype === "viewOnceMessage" && m.quoted.message?.imageMessage));

    if (!isQuotedImage) {
      return await m.reply("❌ *Error:* Please reply to an *Image* to edit it.");
    }

    // React with Loading
    try {
      if (typeof m.react === "function") await m.react("⏳");
    } catch {}

    // 1. WhatsApp image buffer එක download කරගැනීම
    await m.reply("⏳ _Downloading original image..._");
    let imageBuffer;
    try {
      if (m.quoted.download) {
          imageBuffer = await m.quoted.download();
      } else {
          // If direct download isn't available, try getting it from quoted message
          const msg = m.quoted.message?.imageMessage || m.quoted.message?.viewOnceMessage?.message?.imageMessage;
          if (msg) {
              imageBuffer = await client.downloadMediaMessage(msg);
          }
      }
      
      if (!imageBuffer) throw new Error("Could not download image.");
    } catch (err) {
      console.error("Image Download Error:", err);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      return await m.reply("❌ *Error:* Failed to download the replied image.");
    }

    // 2. ෆොටෝ එක URL එකක් බවට පත් කිරීම (Catbox හරහා)
    await m.reply("📤 _Generating public URL..._");
    const publicImageUrl = await uploadToCatbox(imageBuffer);

    if (!publicImageUrl || typeof publicImageUrl !== "string" || !publicImageUrl.startsWith("https")) {
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      return await m.reply("❌ *Error:* Failed to upload image to public server for AI processing.");
    }

    // 3. WhiteShadow AI Edit API එක call කිරීම
    await m.reply(`🤖 _AI Editing image: "${prompt}"..._`);
    
    // Final API URL එක සෑදීම
    const apiUrl = `${AI_EDIT_API_URL}?url=${encodeURIComponent(publicImageUrl)}&prompt=${encodeURIComponent(prompt)}&apitoken=${API_TOKEN}`;

    try {
      const response = await axios.get(apiUrl, { timeout: 120000 }); // AI වැඩ වලට වෙලා යන නිසා timeout වැඩි කලා
      const apiData = response.data;

      if (apiData.status !== "success" || !apiData.result?.edited_image_url) {
        console.log("AI Edit API fail response:", apiData);
        throw new Error(apiData.msg || apiData.result?.message || "AI API returned failure status.");
      }

      const editedImageUrl = apiData.result.edited_image_url;

      // 4. Edit වුණු ෆොටෝ එක WhatsApp එකට එවන්න
      await m.reply("⬆️ _Downloading edited image and sending..._");

      const finalCaption = `✨ *ѕά𝓭є𝔀 ᵐ𝐃 AI Image Edit*\n\n📝 *Prompt:* ${prompt}\n🛡️ *Watermark:* removed\n\n*Downloaded by SADEW-MD*`;

      await client.sendMessage(
        m.jid,
        {
          image: { url: editedImageUrl },
          caption: finalCaption,
        },
        { quoted: m }
      );

      // React with Success
      try {
        if (typeof m.react === "function") await m.react("✅");
      } catch {}

    } catch (apiError) {
      console.error("AI API Error:", apiError.response?.data || apiError.message);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      
      const errMsg = apiError.message.includes("timeout") 
          ? "❌ *Timeout:* The AI took too long to generate the image."
          : `❌ *Error:* ${apiError.message}`;
          
      await m.reply(errMsg);
    }
  }
);
