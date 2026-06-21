const fs = require("fs");
const dotenv = require("dotenv");
const { Sequelize } = require("sequelize");

// ✅ THIS FUNCTION WAS MISSING – ADD IT BACK
function toBool(value) {
    return value === "true";
}

if (fs.existsSync("config.env")) {
    dotenv.config({ path: "./config.env" });
}

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://aswin:D6dq0vk1xoQx_OO-Iv4ESQ@rough-doxle-2360.7s5.aws-ap-south-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full";

if (!DATABASE_URL.startsWith("sqlite://") && !DATABASE_URL.startsWith("postgres://") && !DATABASE_URL.startsWith("postgresql://")) {
    throw new Error("Invalid DATABASE_URL format. Use 'sqlite://' or 'postgres://'");
}

const DATABASE = DATABASE_URL.startsWith("sqlite://")
    ? new Sequelize(DATABASE_URL, {
          dialect: "sqlite",
          storage: DATABASE_URL.replace("sqlite://", ""),
          logging: false,
      })
    : new Sequelize(DATABASE_URL, {
          dialect: "postgres",
          protocol: "postgres",
          ssl: true,
          dialectOptions: {
              ssl: { require: true, rejectUnauthorized: false },
          },
          logging: false,
      });

DATABASE.authenticate()
    .then(() => console.log("Database connection established successfully."))
    .catch((err) => console.error("Database connection failed:", err.message));

module.exports = {
    VERSION: require("./package.json").version,
    ALIVE: process.env.ALIVE || "Hello I'm *SADEW-MD*, I'm alive now! ⚡\n\n*Owner:* Sadew\n*TikTok:* https://www.tiktok.com/@sadewrashmika36",
    ALWAYS_ONLINE: toBool(process.env.ALWAYS_ONLINE || "false"),
    BGMBOT: toBool(process.env.BGMBOT || "false"),
    API: "https://api-aswin-sparky.koyeb.app",
    AUDIO_DATA: process.env.AUDIO_DATA || "SADEW-MD;SADEW;https://i.imgur.com/vrzBEoB.jpeg",
    AUTO_STATUS_VIEW: toBool(process.env.AUTO_STATUS_VIEW || "true"),
    BOT_INFO: process.env.BOT_INFO || "SADEW-MD;SADEW;https://i.imgur.com/vrzBEoB.jpeg;https://www.tiktok.com/@sadewrashmika36",
    CALL_BLOCK: toBool(process.env.CALL_BLOCK || "false"),
    CALL_BLOCK_MSG: process.env.CALL_BLOCK_MSG || "_Calls are not allowed. Please don’t call again!._",
    DATABASE_URL,
    DATABASE,
    DISABLE_PM: toBool(process.env.DISABLE_PM || "false"),
    GROQ_API_KEY: process.env.GROQ_API_KEY || "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",
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyAVsxiD327yX3nqKLOz4HpIcH0smJJWFHg",
    SINHALASUB_API_KEY: process.env.SINHALASUB_API_KEY || "zanta_fCZXpI08BXyizOiRJlDBShW6",
    HANDLERS: (process.env.HANDLERS || process.env.HANDLER || process.env.PREFIX || ".").trim(),
    HEROKU_API_KEY: process.env.HEROKU_API_KEY || "",
    HEROKU_APP_NAME: process.env.HEROKU_APP_NAME || "",
    KOYEB_API_KEY: process.env.KOYEB_API_KEY || process.env.KOYEB_KEY || "",
    KOYEB_SERVICE_NAME: process.env.KOYEB_SERVICE_NAME || process.env.KOYEB_APP_NAME || process.env.KOYEB_NAME || "",
    RENDER_API_KEY: process.env.RENDER_API_KEY || process.env.RENDER_KEY || "",
    RENDER_APP_NAME: process.env.RENDER_APP_NAME || process.env.RENDER_NAME || "",
    LANGUAGE: process.env.LANGUAGE || "english",
    LOGS: toBool(process.env.LOGS || "false"),
    MENU_TYPE: process.env.MENU_TYPE || "text",
    MENU_FONT: process.env.MENU_FONT || "tiny",
    PORT: process.env.PORT || 8080,
    PING: process.env.PING || "Latency",
    PM_BLOCK: toBool(process.env.PM_BLOCK || "false"),
    READ_MESSAGES: toBool(process.env.READ_MESSAGES || "false"),
    REJECT_CALL: toBool(process.env.REJECT_CALL || "false"),
    REJECT_CALL_MSG: process.env.REJECT_CALL_MSG || "_Calls are not allowed. Please don’t call again!._",
    SESSION_ID: process.env.SESSION_ID || "",
    START_MSG: toBool(process.env.START_MSG || "true"),
    STICKER_DATA: process.env.STICKER_DATA || "SADEW-MD;SADEW",
    SUDO: process.env.SUDO || "94783360267",
    WORK_TYPE: process.env.WORK_TYPE || "public",
    SAVE_STATUS: toBool(process.env.SAVE_STATUS || "true"),
    STATUS_REPLY: toBool(process.env.STATUS_REPLY || "false"),
    STATUS_REPLY_MSG: process.env.STATUS_REPLY_MSG || "Nice Status Brother! ✨ - SADEW-MD",
    STATUS_REACTION: toBool(process.env.STATUS_REACTION || "true"),
    STATUS_REACTION_EMOJI: process.env.STATUS_REACTION_EMOJI || "🍉,🍓,🎀,💀,💗,📍,🔪,🛒,☠️,🐍,👍🏻",
    WARN_COUNT: process.env.WARN_COUNT || "3",
};
