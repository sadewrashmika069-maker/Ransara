const {
  Sparky,
  isPublic
} = require("../lib");
const { getString, isUrl } = require('./pluginsCore');
const axios = require('axios'); // ⚡ වේගවත් බාගැනීම් සඳහා Axios භාවිතය
const lang = getString('download');

// 🌐 YouTube සර්වර් බ්ලොක් සහ Speed Limits මඟහැරීමට Headers
const SAFE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "*/*"
};

// ==========================================
// 🔎 1. YTS COMMAND (ULTRA FAST SEARCH)
// ==========================================
Sparky({
  name: "yts",
  fromMe: isPublic,
  category: "youtube",
  desc: "search in youtube"
}, async ({ m, client, args }) => {
  if (!args) return await m.reply(lang.NEED_Q);
  const query = Array.isArray(args) ? args.join(" ") : args;
  
  await m.react('🔎');
  try {
    // Whiteshadow Search Engine එක භාවිතය
    const searchApi = "https://whiteshadow-x-api." + "vercel.app" + "/api/search/yt?q=" + encodeURIComponent(query) + "&apitoken=VK4fry";
    const res = await axios.get(searchApi, { timeout: 8000 });
    const videos = res.data?.result || res.data?.response || [];
    
    if (videos.length === 0) return m.reply("_❌ මචං සර්ච් රිසල්ට් කිසිවක් හමුවුණේ නැහැ._");

    const result = videos.slice(0, 10).map(video => `*🏷️ Title :* _*${video.title}*_\n*📁 Duration :* _${video.duration || video.timestamp || 'N/A'}_\n*🔗 Link :* _${video.url || video.link}_`);
    return await m.reply(`\n\n_*Result Of ${query} 🔍*_\n\n` + result.join('\n\n'));
  } catch (error) {
    await m.react('❌');
    return m.reply(`_❌ Search Error: ${error.message}_`);
  }
});

// ==========================================
// 🎬 2. YTV COMMAND (HIGH SPEED VIDEO)
// ==========================================
Sparky({
  name: "ytv",
  fromMe: isPublic,
  category: "youtube",
  desc: "Find details of a song"
}, async ({ m, client, args }) => {
    try {
      args = args || m.quoted?.text;
      if (!args) return await m.reply(lang.NEED_URL);
      if (!await isUrl(args)) return await m.reply(lang.INVALID_LINK);
      
      await m.react('⬇️');
      
      // High-Speed Link Extraction
      const dlApi = "https://whiteshadow-x-api." + "vercel.app" + "/api/download/yt?url=" + encodeURIComponent(args) + "&apitoken=VK4fry";
      const res = await axios.get(dlApi, { timeout: 10000 });
      const d = res.data?.result || res.data?.response;
      let videoUrl = d?.mp4 || d?.download || d?.url || d?.link;

      if (!videoUrl) return m.reply("_❌ වීඩියෝ ඩවුන්ලෝඩ් ලින්ක් එක ලබාගත නොහැක._");

      // Streaming directly to RAM Buffer to bypass limits
      const stream = await axios.get(videoUrl, { responseType: 'arraybuffer', headers: SAFE_HEADERS, timeout: 35000 });
      const buffer = Buffer.from(stream.data);

      await m.react('✅');
      return await client.sendMessage(m.jid, { video: buffer, mimetype: 'video/mp4' }, { quoted: m });
    } catch (error) {
      await m.react('❌');
      m.reply(`_❌ Error: ${error.message}_`);
    }
});

// ==========================================
// 🎵 3. YTA COMMAND (HIGH QUALITY AUDIO)
// ==========================================
Sparky({
  name: "yta",
  fromMe: isPublic,
  category: "youtube",
  desc: "Find details of a song"
}, async ({ m, client, args }) => {
    try {
      args = args || m.quoted?.text;
      if (!args) return await m.reply(lang.NEED_URL);
      if (!await isUrl(args)) return await m.reply(lang.INVALID_LINK);
      
      await m.react('⬇️');
      
      let mp3Url = null;
      // Server 1 Try
      try {
          const dlApi1 = "https://whiteshadow-x-api." + "vercel.app" + "/api/download/yt?url=" + encodeURIComponent(args) + "&apitoken=VK4fry";
          const res1 = await axios.get(dlApi1, { timeout: 8000 });
          const d1 = res1.data?.result || res1.data?.response;
          mp3Url = d1?.mp3 || d1?.download || d1?.url || d1?.link;
      } catch (e) {}

      // Server 2 Failover Backup
      if (!mp3Url) {
          try {
              const dlApi2 = "https://api-dark-shan-yt." + "koyeb.app" + "/download/ytmp3?url=" + encodeURIComponent(args);
              const res2 = await axios.get(dlApi2, { timeout: 8000 });
              const d2 = res2.data?.result || res2.data?.response;
              mp3Url = d2?.mp3 || d2?.download || d2?.url || d2?.link;
          } catch (e) {}
      }

      if (!mp3Url) return m.reply("_❌ සියලුම ඕඩියෝ සර්වර්ස් කාර්යබහුලයි._");

      const stream = await axios.get(mp3Url, { responseType: 'arraybuffer', headers: SAFE_HEADERS, timeout: 30000 });
      const buffer = Buffer.from(stream.data);

      await m.react('✅');
      return await client.sendMessage(m.jid, { audio: buffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
    } catch (error) {
      await m.react('❌');
      m.reply(`_❌ Error: ${error.message}_`);
    }
});

// ==========================================
// 🚀 4 & 5. PLAY & SONG HYBRID ENGINE (SEARCH + DOWNLOAD COMBO)
// ==========================================
const playSongHandler = async ({ m, client, args }) => {
    try {
      args = args || m.quoted?.text;
      if (!args) return await m.reply(lang.NEED_Q);
      
      await m.react('🔎');
      let videoUrl = null;
      let finalMp3Url = null;
      let songTitle = args;

      // Stage 1: Fast Search via Whiteshadow Engine
      try {
          const searchApi = "https://whiteshadow-x-api." + "vercel.app" + "/api/search/yt?q=" + encodeURIComponent(args) + "&apitoken=VK4fry";
          const searchRes = await axios.get(searchApi, { timeout: 6000 });
          const ytResult = searchRes.data?.result?.[0] || searchRes.data?.response?.[0];
          videoUrl = ytResult?.url || ytResult?.link;
          songTitle = ytResult?.title || args;
          
          if (videoUrl) await m.reply(`_📥 Downloading: ${songTitle}_`);
      } catch (err) { console.log("Search 1 failed, bypassing to direct query..."); }

      // Stage 2: Audio Extraction Loop (3 Servers Base)
      if (videoUrl) {
          try {
              const dlApi1 = "https://whiteshadow-x-api." + "vercel.app" + "/api/download/yt?url=" + encodeURIComponent(videoUrl) + "&apitoken=VK4fry";
              const res1 = await axios.get(dlApi1, { timeout: 8000 });
              const d1 = res1.data?.result || res1.data?.response;
              finalMp3Url = d1?.mp3 || d1?.download || d1?.url || d1?.link;
          } catch (e) {}

          if (!finalMp3Url) {
              try {
                  const dlApi2 = "https://api-dark-shan-yt." + "koyeb.app" + "/download/ytmp3?url=" + encodeURIComponent(videoUrl);
                  const res2 = await axios.get(dlApi2, { timeout: 8000 });
                  const d2 = res2.data?.result || res2.data?.response;
                  finalMp3Url = d2?.mp3 || d2?.download || d2?.url || d2?.link;
              } catch (e) {}
          }
      }

      // Backup Engine 3 (Direct Query Scraper)
      if (!finalMp3Url) {
          try {
              const dlApi3 = "https://api." + "dreaded" + ".site/api/ytdl?url=" + encodeURIComponent(args);
              const res3 = await axios.get(dlApi3, { timeout: 10000 });
              const d3 = res3.data?.result || res3.data?.response;
              finalMp3Url = d3?.audio || d3?.mp3 || d3?.download || d3?.url;
          } catch (e) {}
      }

      if (!finalMp3Url) {
          await m.react('❌');
          return m.reply("_❌ සින්දුව බාගන්න ලැබුනේ නැහැ. සියලුම සර්වර්ස් කාර්යබහුලයි!_");
      }

      // Stage 3: Streaming buffer directly to RAM
      const audioStream = await axios.get(finalMp3Url, { responseType: 'arraybuffer', headers: SAFE_HEADERS, timeout: 35000 });
      const audioBuffer = Buffer.from(audioStream.data);

      await m.react('✅');
      return await client.sendMessage(m.jid, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: m });
    } catch (error) {
      await m.react('❌');
      m.reply(`_❌ Error: ${error.message}_`);
    }
};

// Play සහ Song කමාන්ඩ්ස් දෙකම වේගවත් Hybrid Engine එකට සම්බන්ධ කිරීම
Sparky({ name: "play", fromMe: isPublic, category: "youtube", desc: "play a song" }, playSongHandler);
Sparky({ name: "song", fromMe: isPublic, category: "youtube", desc: "play a song" }, playSongHandler);
