const { Sparky, isPublic } = require("../lib");
const axios = require("axios");
const FormData = require("form-data");

// 🔄 DeepAI Bypass Endpoint & Token
const AI_EDIT_API_URL = "https://whiteshadow-x-api.onrender.com/api/ai/deepai-edit";
const API_TOKEN = "VK4fry"; 

/**
 * ⚡ AI-Friendly Image Uploader
 */
async function uploadImageToPublicServer(buffer) {
  console.log("[SADEW-MD UPLOADER] Uploading start...");
  const filename = `sparky_edit_${Date.now()}.jpg`;

  // --- Envs.sh ---
  try {
    const formData = new FormData();
    formData.append("file", buffer, { filename, contentType: "image/jpeg" });

    const response = await axios.post("https://envs.sh", formData, {
      headers: formData.getHeaders(),
      timeout: 20000,
    });

    if (response.data && String(response.data).includes("https://envs.sh/")) {
      let directUrl = String(response.data).trim();
      if (!directUrl.endsWith(".jpg") && !directUrl.endsWith(".jpeg")) {
         directUrl = directUrl + "?ext=.jpg";
      }
      console.log("[SADEW-MD UPLOADER] Envs.sh Success:", directUrl);
      return directUrl;
    }
  } catch (error) {
    console.error("[SADEW-MD UPLOADER] Envs.sh Failed:", error.message);
  }

  // --- Uguu.se ---
  try {
    const formData = new FormData();
    formData.append("files[]", buffer, { filename, contentType: "image/jpeg" });

    const response = await axios.post("https://uguu.se/upload.php", formData, {
      headers: formData.getHeaders(),
      timeout: 20000,
    });

    if (response.data?.success && response.data?.files?.[0]?.url) {
      const directUrl = response.data.files[0].url;
      console.log("[SADEW-MD UPLOADER] Uguu.se Success:", directUrl);
      return directUrl;
    }
  } catch (error) {
    console.error("[SADEW-MD UPLOADER] Uguu.se Failed:", error.message);
  }

  return null;
}

// Bot Command
Sparky(
  {
    name: "edit",
    alias: ["editimg", "imgedit", "deepai"],
    fromMe: isPublic,
    category: "ai",
    desc: "Reply to an image with a prompt to edit it using DeepAI Bypass API.",
  },
  async ({ m, client, args }) => {
    
    // 🛡️ මුළු බොට් කමාන්ඩ් එකම බ්ලොක් නොවී මැසේජ් යවන Fail-Safe Function එක
    const sendMsg = async (text) => {
      try {
        if (typeof m.reply === "function") {
          await m.reply(text);
        } else {
          await client.sendMessage(m.jid, { text }, { quoted: m });
        }
      } catch (e) {
        console.error("[SADEW-MD BOT] Primary reply failed, trying backup send:", e.message);
        try {
          await client.sendMessage(m.jid, { text }); // Quoted නැතිව හරි යැවීම
        } catch (err) {
          console.error("[SADEW-MD BOT] Totally unable to send message:", err.message);
        }
      }
    };

    // 🌟 GLOBAL TRY-CATCH SYSTEM
    try {
      console.log("[SADEW-MD BOT] .edit command execution started.");
      const prompt = Array.isArray(args) ? args.join(" ").trim() : String(args || "").trim();

      if (!prompt) {
        return await sendMsg(`❌ *Usage:* Reply to an image and type:\n.edit <your prompt>\n\nExample:\n.edit make it zombie`);
      }

      const isQuotedImage = m.quoted && (
          m.quoted.mtype === "imageMessage" || 
          m.quoted.type === "image" ||
          (m.quoted.mime && m.quoted.mime.startsWith("image/")) ||
          !!m.quoted.message?.imageMessage ||
          !!m.quoted.message?.viewOnceMessage?.message?.imageMessage
      );

      if (!isQuotedImage) {
        return await sendMsg("❌ *Error:* Please reply to an *Image* to edit it.");
      }

      try { if (typeof m.react === "function") await m.react("⏳"); } catch {}

      // 1. Image Download
      console.log("[SADEW-MD BOT] Downloading media from WhatsApp...");
      await sendMsg("⏳ _Downloading original image..._");
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
        
        if (!imageBuffer) throw new Error("Downloaded buffer is empty.");
      } catch (err) {
        console.error("[SADEW-MD BOT] Image Download Failed:", err.message);
        try { if (typeof m.react === "function") await m.react("❌"); } catch {}
        return await sendMsg("❌ *Error:* Failed to download the replied image.");
      }

      // 2. Image Upload
      console.log("[SADEW-MD BOT] Triggering public uploader...");
      await sendMsg("📤 _Generating public URL..._");
      const publicImageUrl = await uploadImageToPublicServer(imageBuffer);

      if (!publicImageUrl) {
        try { if (typeof m.react === "function") await m.react("❌"); } catch {}
        return await sendMsg("❌ *Error:* Failed to generate a clean public image link.");
      }

      // 3. API Request
      console.log("[SADEW-MD BOT] Sending request to WhiteShadow DeepAI URL:", publicImageUrl);
      await sendMsg(`🤖 _DeepAI (Bypass) Editing image: "${prompt}"..._\n\n⚠️ _Note: If the server is sleeping, this might take up to 60 seconds._`);
      
      const apiUrl = `${AI_EDIT_API_URL}?url=${encodeURIComponent(publicImageUrl)}&prompt=${encodeURIComponent(prompt)}&apitoken=${API_TOKEN}`;

      try {
        // Timeout එක තත්පර 60 කට අඩු කලා හිරවීම් වැලැක්වීමට
        const response = await axios.get(apiUrl, { timeout: 60000 });
        const apiData = response.data;
        console.log("[SADEW-MD BOT] API Data Received:", JSON.stringify(apiData));

        if (apiData.status !== "success" || !apiData.result?.edited_image_url) {
          throw new Error(apiData.msg || apiData.result?.message || "DeepAI API returned an invalid response.");
        }

        const editedImageUrl = apiData.result.edited_image_url;

        // 4. Send Edited Image
        console.log("[SADEW-MD BOT] Sending final image to user...");
        await sendMsg("⬆️ _Downloading edited image and sending..._");

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
        console.error("[SADEW-MD BOT] Inner API Error Caught:", apiError.message);
        try { if (typeof m.react === "function") await m.react("❌"); } catch {}
        
        let serverRawError = apiError.message;
        if (apiError.response?.data) {
            serverRawError = typeof apiError.response.data === "object" 
              ? JSON.stringify(apiError.response.data, null, 2) 
              : String(apiError.response.data).slice(0, 200);
        }
        
        const errMsg = apiError.message.includes("timeout") 
            ? "❌ *Timeout:* WhiteShadow Render server took too long to wake up. Please try again now!"
            : `❌ *Error:* ${apiError.message}\n\n📊 *WhiteShadow Server Response:* \`\`\`${serverRawError}\`\`\``;
            
        await sendMsg(errMsg);
      }

    } catch (globalError) {
      // කෝඩ් එකේ වෙන කොහේ හරි ක්‍රෑෂ් එකක් වුණොත් මේකෙන් අනිවාර්යයෙන්ම මැසේජ් එකක් දෙනවා
      console.error("[SADEW-MD BOT] CRITICAL GLOBAL ERROR OCCURRED:", globalError);
      try { if (typeof m.react === "function") await m.react("❌"); } catch {}
      await sendMsg(`❌ *Sadew-MD Internal Error:* ${globalError.message}\n\nPlease check \`pm2 logs\` in your terminal.`);
    }
  }
);
