"use strict";

const fs = require("fs");
const path = require("path");
const http = require("http");
const axios = require("axios");
const P = require("pino");
const NodeCache = require("node-cache");
const cron = require("node-cron");
const { Boom } = require("@hapi/boom");

let baileys;
try {
  baileys = require("baileys");
} catch {
  baileys = require("@whiskeysockets/baileys");
}

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers,
} = baileys;

const config = require("./config");
const {
  serialize,
  commands,
  whatsappAutomation,
  callAutomation,
  externalPlugins,
} = require("./lib");

const SESSION_DIR = path.join(__dirname, "lib", "session");
const PLUGIN_DIRS = [
  path.join(__dirname, "plugins"),
  path.join(__dirname, "commands"),
];

const logger = P({ level: "silent" });
const groupCache = new NodeCache({
  stdTTL: 60 * 60,
  checkperiod: 10 * 60,
  useClones: false,
});

const nonPrefixReplySessions =
  global.nonPrefixReplySessions || (global.nonPrefixReplySessions = new Map());
const NON_PREFIX_REPLY_TTL = 5 * 60 * 1000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getEnv(name, fallback = "") {
  return process.env[name] || config[name] || fallback;
}

function getPrefixList() {
  const handlers = getEnv("HANDLERS", getEnv("PREFIX", "."));

  if (Array.isArray(handlers)) return handlers;

  return String(handlers)
    .split(",")
    .map((prefix) => prefix.trim())
    .filter(Boolean);
}

function findPrefix(text) {
  const prefixes = getPrefixList();
  return prefixes.find((prefix) => text.startsWith(prefix));
}

function getBody(m) {
  if (!m) return "";

  if (typeof m.body === "string") return m.body;
  if (typeof m.text === "string") return m.text;

  const message = m.message;
  if (!message || typeof message === "string") return message || "";

  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  if (message.documentMessage?.caption) return message.documentMessage.caption;
  if (message.buttonsResponseMessage?.selectedButtonId) {
    return message.buttonsResponseMessage.selectedButtonId;
  }
  if (message.listResponseMessage?.singleSelectReply?.selectedRowId) {
    return message.listResponseMessage.singleSelectReply.selectedRowId;
  }
  if (message.templateButtonReplyMessage?.selectedId) {
    return message.templateButtonReplyMessage.selectedId;
  }

  return "";
}

function getChatId(m) {
  return m.jid || m.chat || m.from || m.key?.remoteJid;
}

function getSenderId(m) {
  return (
    m.sender ||
    m.participant ||
    m.key?.participant ||
    m.key?.remoteJid ||
    getChatId(m)
  );
}

function getDefaultPrefix() {
  return getPrefixList()[0] || ".";
}

function getNonPrefixReplyKey(m) {
  return `${getChatId(m)}:${getSenderId(m)}`;
}

function saveNonPrefixReplySession(m) {
  const key = getNonPrefixReplyKey(m);

  nonPrefixReplySessions.set(key, {
    createdAt: Date.now(),
  });

  setTimeout(() => {
    const session = nonPrefixReplySessions.get(key);
    if (session && Date.now() - session.createdAt >= NON_PREFIX_REPLY_TTL) {
      nonPrefixReplySessions.delete(key);
    }
  }, NON_PREFIX_REPLY_TTL + 1000);
}

function rememberMenuCommandForNonPrefixReplies(m, body) {
  const text = body.trim();
  const prefix = findPrefix(text);
  if (!prefix) return;

  const withoutPrefix = text.slice(prefix.length).trim();
  const commandName = withoutPrefix.split(/\s+/)[0]?.toLowerCase();

  if (["menu", "help", "list"].includes(commandName)) {
    saveNonPrefixReplySession(m);
  }
}

function shouldUseNonPrefixReply(m, body) {
  const text = body.trim();
  if (!/^\d{1,3}$/.test(text)) return false;
  if (findPrefix(text)) return false;

  const key = getNonPrefixReplyKey(m);
  const session = nonPrefixReplySessions.get(key);
  if (!session) return false;

  if (Date.now() - session.createdAt > NON_PREFIX_REPLY_TTL) {
    nonPrefixReplySessions.delete(key);
    return false;
  }

  saveNonPrefixReplySession(m);
  return true;
}

function applyNonPrefixReplyBody(m, body) {
  if (!shouldUseNonPrefixReply(m, body)) return body;

  const normalizedBody = `${getDefaultPrefix()}${body.trim()}`;
  m.originalBody = body;
  m.body = normalizedBody;

  if (typeof m.text === "string") {
    m.text = normalizedBody;
  }

  return normalizedBody;
}

async function sendText(client, jid, text, quoted) {
  return client.sendMessage(jid, { text }, quoted ? { quoted } : {});
}

function getCommandNames(command) {
  const names = [];

  for (const key of ["name", "cmd", "command", "pattern"]) {
    const value = command[key];
    if (!value) continue;

    if (Array.isArray(value)) names.push(...value);
    else names.push(value);
  }

  if (Array.isArray(command.alias)) names.push(...command.alias);
  if (Array.isArray(command.aliases)) names.push(...command.aliases);

  return names.filter(Boolean);
}

function commandMatches(command, commandName, bodyWithoutPrefix, originalBody) {
  const names = getCommandNames(command);

  for (const name of names) {
    if (name instanceof RegExp) {
      name.lastIndex = 0;
      if (name.test(bodyWithoutPrefix) || name.test(originalBody)) return true;
      continue;
    }

    const cleanName = String(name)
      .replace(/^\^/, "")
      .replace(/\$$/, "")
      .replace(/[.*+?^${}()|[\]\\]/g, "")
      .trim()
      .toLowerCase();

    if (cleanName === commandName) return true;
  }

  return false;
}

function getRunner(command) {
  return (
    command.function ||
    command.run ||
    command.callback ||
    command.handler ||
    command.execute
  );
}

async function runCommand(command, context) {
  const runner = getRunner(command);
  if (typeof runner !== "function") return;

  await runner(context);
}

async function dispatchCommands(client, m) {
  let body = getBody(m);
  rememberMenuCommandForNonPrefixReplies(m, body);
  body = applyNonPrefixReplyBody(m, body);

  for (const command of commands) {
    try {
      if (command.fromMe && !m.fromMe) continue;

      if (command.on) {
        await runCommand(command, {
          m,
          client,
          conn: client,
          args: body,
          text: body,
        });
        continue;
      }

      const prefix = findPrefix(body);
      if (!prefix) continue;

      const bodyWithoutPrefix = body.slice(prefix.length).trim();
      const commandName = bodyWithoutPrefix.split(/\s+/)[0]?.toLowerCase();
      if (!commandName) continue;

      if (!commandMatches(command, commandName, bodyWithoutPrefix, body)) {
        continue;
      }

      const args = bodyWithoutPrefix.slice(commandName.length).trim();

      await runCommand(command, {
        m,
        client,
        conn: client,
        args,
        text: args,
        prefix,
        command: commandName,
      });
   function loadLocalPlugins() {
  for (const pluginDir of PLUGIN_DIRS) {
    if (!fs.existsSync(pluginDir)) continue;

    for (const file of fs.readdirSync(pluginDir)) {
      if (!file.endsWith(".js")) continue;

      const fullPath = path.join(pluginDir, file);

      try {
        delete require.cache[require.resolve(fullPath)];
        require(fullPath);
        console.log(`Loaded plugin: ${path.relative(__dirname, fullPath)}`);
      } catch (error) {
        console.error(`Plugin load failed: ${file}`, error.message);
      }
    }
  }
}

async function loadExternalPlugins() {
  if (!externalPlugins || typeof externalPlugins.findAll !== "function") return;

  try {
    ensureDir(path.join(__dirname, "plugins"));
    const pluginRows = await externalPlugins.findAll();

    for (const row of pluginRows) {
      const data = row.dataValues || row;
      if (!data.name || !data.url) continue;

      const pluginPath = path.join(__dirname, "plugins", `${data.name}.js`);
      if (fs.existsSync(pluginPath)) continue;

      const response = await axios.get(data.url);
      fs.writeFileSync(pluginPath, response.data);
      require(pluginPath);
      console.log(`Loaded external plugin: ${data.name}`);
    }
  } catch (error) {
    console.error("External plugin load failed:", error.message);
  }
}

async function syncDatabase() {
  try {
    if (config.DATABASE && typeof config.DATABASE.sync === "function") {
      await config.DATABASE.sync();
      console.log("Database synced.");
    }
  } catch (error) {
    console.error("Database sync failed:", error.message);
  }
}

async function writeSessionFilesFromObject(sessionObject) {
  ensureDir(SESSION_DIR);

  for (const [fileName, value] of Object.entries(sessionObject)) {
    fs.writeFileSync(
      path.join(SESSION_DIR, fileName),
      typeof value === "string" ? value : JSON.stringify(value, null, 2)
    );
  }
}

async function restoreSession() {
  ensureDir(SESSION_DIR);

  const credsPath = path.join(SESSION_DIR, "creds.json");
  if (fs.existsSync(credsPath)) return;

  const sessionId = getEnv("SESSION_ID");
  if (!sessionId) {
    console.log("SESSION_ID missing. Waiting for existing session files.");
    return;
  }

  try {
    let sessionData = null;

    if (/^https?:\/\//i.test(sessionId)) {
      const response = await axios.get(sessionId);
      sessionData = response.data;
    } else if (sessionId.includes(":")) {
      const gistId = sessionId.split(":").pop();
      const response = await axios.get(
        `https://gist.github.com/ESWIN-SPERKY/${gistId}/raw`
      );
      sessionData = response.data;
    } else {
      try {
        sessionData = JSON.parse(Buffer.from(sessionId, "base64").toString());
      } catch {
        sessionData = JSON.parse(sessionId);
      }
    }

    if (typeof sessionData === "string") {
      sessionData = JSON.parse(sessionData);
    }

    if (sessionData.creds || sessionData["creds.json"]) {
      await writeSessionFilesFromObject(sessionData);
      console.log("Session restored successfully.");
    } else {
      fs.writeFileSync(credsPath, JSON.stringify(sessionData, null, 2));
      console.log("Session creds saved successfully.");
    }
  } catch (error) {
    console.error("Session restore failed:", error.message);
  }
}

function startKeepAliveServer() {
  const port = Number(process.env.PORT || 8000);
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        status: "active",
        bot: "Sadew MD",
        platform: process.env.GITHUB_ACTIONS ? "GitHub Actions" : "Node.js",
      })
    );
  });

  server.listen(port, () => {
    console.log(`Keep-alive server running on port ${port}`);
  });

  const deployedUrl = process.env.RENDER_EXTERNAL_URL || process.env.DEPLOYED_URL;
  if (deployedUrl) {
    cron.schedule("*/10 * * * *", async () => {
      try {
        await axios.get(deployedUrl);
      } catch (error) {
        console.error("Keep-alive ping failed:", error.message);
      }
    });
  }
}

function getOwnerJid(sock) {
  const sudo = getEnv("SUDO");
  if (sudo) return `${sudo.split(",")[0].replace(/[^0-9]/g, "")}@s.whatsapp.net`;

  const botId = sock.user?.id || "";
  const number = botId.split(":")[0].replace(/[^0-9]/g, "");
  return number ? `${number}@s.whatsapp.net` : null;
}

async function sendStartMessage(sock) {
  if (!config.START_MSG) return;

  const jid = getOwnerJid(sock);
  if (!jid) return;

  const text = `SADEW MD STARTED

Mode: ${getEnv("WORK_TYPE", "private")}
Prefix: ${getEnv("HANDLERS", ".")}
Version: ${getEnv("VERSION", "1.0.0")}
Runtime: Node.js ${process.version}`;

  try {
    await sock.sendMessage(jid, { text });
  } catch (error) {
    console.error("Start message failed:", error.message);
  }
}

async function startBot() {
  ensureDir(SESSION_DIR);
  startKeepAliveServer();
  await restoreSession();
  await syncDatabase();

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: false,
    downloadHistory: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    getMessage: async () => undefined,
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("Connecting...");
      return;
    }

    if (connection === "open") {
      console.log("Connected.");
      await loadExternalPlugins();
      loadLocalPlugins();
      await sendStartMessage(sock);
      return;
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (statusCode === DisconnectReason.connectionReplaced) {
        console.log("Connection replaced. Logout current session first.");
        await sock.logout();
        return;
      }

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Session logged out. Add a new SESSION_ID.");
        return;
      }

      console.log("Connection closed. Reconnecting...");
      setTimeout(startBot, 3000);
    }
  });

  sock.ev.on("messages.upsert", async (chatUpdate) => {
    const rawMessage = chatUpdate.messages?.[0];
    if (!rawMessage || !rawMessage.message) return;

    let m;
    try {
      m = await serialize(JSON.parse(JSON.stringify(rawMessage)), sock);
    } catch (error) {
      console.error("Message serialize failed:", error.message);
      return;
    }

    try {
      if (typeof whatsappAutomation === "function") {
        await whatsappAutomation(sock, m, chatUpdate);
      }

      if (config.DISABLE_PM && !m.isGroup && !m.fromMe) return;

      await dispatchCommands(sock, m);
    } catch (error) {
      console.error("Message handler failed:", error);
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("call", async (calls) => {
    if (typeof callAutomation !== "function") return;

    for (const call of calls) {
      try {
        await callAutomation(sock, call);
      } catch (error) {
        console.error("Call automation failed:", error.message);
      }
    }
  });
}

startBot().catch((error) => {
  console.error("Fatal error:", error);
  setTimeout(startBot, 3000);
});
