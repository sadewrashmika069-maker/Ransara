const { Sparky, isPublic } = require("../lib");
const axios = require("axios");
const FormData = require("form-data");

// 🔄 අලුත් DeepAI Bypass Endpoint එක සහ API Token එක
const AI_EDIT_API_URL = "https://whiteshadow-x-api.onrender.com/api/ai/deepai-edit";
const API_TOKEN = "VK4fry"; 

/**
 * ⚡ AI-Friendly Image Uploader
 * AI සර්වර්ස් වලට කියවිය හැකි සැබෑ Raw .jpg ලින්ක් සාදයි.
 */
async function uploadImageToPublicServer(buffer) {
  const filename = `sparky_edit_${Date.now()}.jpg`;

  // --- ක්‍රමය 1: Envs.sh ---
  try {
    const formData = new FormData();
    formData.append("file", buffer, { filename, contentType: "image/jpeg" });

    const response = await axios.post("https://envs.sh", formData, {
      headers: formData.getHeaders(),
      timeout: 25000,
    });

    if (response.data && String(response.data).includes("https://envs.sh/")) {
      let directUrl = String(response.data).trim();
      if (!directUrl.endsWith(".jpg") && !directUrl.endsWith(".jpeg")) {
         directUrl = directUrl + "?ext=.jpg";
      }
      console.log("Uploaded successfully to Envs.sh:", directUrl);
      return directUrl;
    }
  } catch (error) {
    console.error("Envs.sh Upload Failed, trying backup...");
  }

  // --- ක්‍රමය 2: Uguu.se ---
  try {
    const formData = new FormData();
    formData.append("files[]", buffer, { filename, contentType: "image/jpeg" });

    const response = await axios.post("https://uguu.se/upload.php", formData, {
      headers: formData.getHeaders(),
      timeout: 25000,
    });

    if (response.data?.success && response.data?.files?.[0]?.url) {
      const directUrl = response.data.files[0].url;
      console.log("Uploaded successfully to Uguu.se:", directUrl);
      return directUrl;
    }
  } catch (error) {
    console.error("Uguu.se Backup Uploader also failed:", error.message);
  }

  return null;
}

// Bot Command එක define කිරීම (ප්‍රධාන නම .edit ලෙස වෙනස් කලා)
Sparky(
  {
    name: "edit",
    alias: ["editimg", "imgedit", "deepai"],
    fromMe: isPublic,
    category: "ai",
    desc: "Reply to an image with a prompt to edit it using DeepAI Bypass API.",
  },
  async ({ m, client, args }) => {
    const prompt = Array.isArray(args) ? args.join(" ").trim() : String(args || "").trim();

    if (!prompt) {
      return await m.reply(
        `❌ *Usage:* Reply to an image and type:\n.edit <your prompt>\n\nExample:\n.edit make it zombie`
      );
    }

    const isQuotedImage = m.quoted && (
        m.quoted.mtype === "imageMessage" || 
        m.quoted.type === "image" ||
        (m.quoted.mime && m.quoted.mime.startsWith("image/")) ||
        !!m.quoted.message?.imageMessage ||
        !!m.quoted.message?.viewOnceMessage?.message?.imageMessage
    );

    if (!isQuotedImage) {
      return await m.reply("❌ *Error:* Please reply to an *Image* to edit it.");
    }

    try { if (typeof m.react === "function") await m.react("⏳"); } catch {}

    // 1. WhatsApp image buffer එක download කරගැනීම
    await m.reply("⏳ _Downloading original image..._");
    let imageBuffer;
    try {
      if (typeof m.quoted.download === "function") {
          imageBuffer = await m.quoted.download();
      } else if (client.downloadMediaMessage) {
          imageBuffer = await client.downloadMediaMessage(m.quoted);
      } else {
          const msg = m.quoted.message?.imageMessage || m.quoted.message?.viewOnceMessage?.message?.imageMessage;
          if (msg) imageBuffer = await client.downloadMediaMessage(msg);
      }
      
      if (!imageBuffer) throw new Error("Buffer empty.");
    } catch (err) {
      console.error("Image Download Error:", err);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      return await m.reply("❌ *Error:* Failed to download the replied image.");
    }

    // 2. ෆොටෝ එක URL එකක් බවට පත් කිරීම
    await m.reply("📤 _Generating public URL..._");
    const publicImageUrl = await uploadImageToPublicServer(imageBuffer);

    if (!publicImageUrl) {
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      return await m.reply("❌ *Error:* Failed to generate a clean public image link.");
    }

    // 3. WhiteShadow DeepAI Edit API එක call කිරීම
    await m.reply(`🤖 _DeepAI (Bypass) Editing image: "${prompt}"..._`);
    
    const apiUrl = `${AI_EDIT_API_URL}?url=${encodeURIComponent(publicImageUrl)}&prompt=${encodeURIComponent(prompt)}&apitoken=${API_TOKEN}`;

    try {
      const response = await axios.get(apiUrl, { timeout: 120000 });
      const apiData = response.data;

      // සර්වර් එකේ response එක සාර්ථක නැත්නම් හෝ ලින්ක් එක නැත්නම්
      if (apiData.status !== "success" || !apiData.result?.edited_image_url) {
        throw new Error(apiData.msg || apiData.result?.message || "DeepAI API returned an invalid response.");
      }

      const editedImageUrl = apiData.result.edited_image_url;

      // 4. Edit වුණු ෆොටෝ එක WhatsApp එකට එවන්න
      await m.reply("⬆️ _Downloading edited image and sending..._");

      const finalCaption = `✨ *ѕά𝓭є𝔀 ᵐ𝐃 DeepAI Edit*\n\n📝 *Prompt:* ${prompt}\n🛡️ *Bypass System:* Active\n\n*Downloaded by SADEW-MD*`;

      await client.sendMessage(
        m.jid,
        {
          image: { url: editedImageUrl },
          caption: finalCaption,
        },
        { quoted: m }
      );

      try { if (typeof m.react === "function") await m.react("✅"); } catch {}

    } catch (apiError) {
      console.error("DeepAI API Error Details:", apiError.response?.data || apiError.message);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      
      let serverRawError = apiError.message;
      if (apiError.response?.data) {
          serverRawError = typeof apiError.response.data === "object" 
            ? JSON.stringify(apiError.response.data, null, 2) 
            : String(apiError.response.data).slice(0, 200);
      }
      
      const errMsg = apiError.message.includes("timeout") 
          ? "❌ *Timeout:* DeepAI took too long to generate the image."
          : `❌ *Error:* ${apiError.message}\n\n📊 *WhiteShadow Server Response:* \`\`\`${serverRawError}\`\`\``;
          
      await m.reply(errMsg);
    }
  }
);
