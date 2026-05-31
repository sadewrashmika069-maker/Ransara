const { Sparky, isPublic } = require("../lib");
const { spawn } = require("child_process");

let ffmpegBin = "ffmpeg";

try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic) ffmpegBin = ffmpegStatic;
} catch {
    ffmpegBin = "ffmpeg";
}

function getArgsText(args, m) {
    if (Array.isArray(args)) return args.join(" ").trim();
    if (typeof args === "string") return args.trim();

    return (
        m.quoted?.text ||
        m.text?.replace(/^[./!#]attp\s*/i, "") ||
        m.body?.replace(/^[./!#]attp\s*/i, "") ||
        ""
    ).trim();
}

function escapeDrawText(text) {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/,/g, "\\,");
}

function createAttpSticker(text) {
    return new Promise((resolve, reject) => {
        const safeText = escapeDrawText(text);

        const font =
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

        const filter =
            "color=c=black@0.0:s=512x512:d=3:r=15,format=rgba," +
            "drawtext=" +
            `fontfile=${font}:` +
            `text='${safeText}':` +
            "fontsize=54:" +
            "fontcolor_expr=ffffff:" +
            "borderw=4:" +
            "bordercolor_expr=if(lt(mod(t\\,1.2)\\,0.2)\\,red\\,if(lt(mod(t\\,1.2)\\,0.4)\\,yellow\\,if(lt(mod(t\\,1.2)\\,0.6)\\,lime\\,if(lt(mod(t\\,1.2)\\,0.8)\\,cyan\\,magenta)))):" +
            "x=(w-text_w)/2:" +
            "y=(h-text_h)/2 + 35*sin(2*PI*t):" +
            "box=0";

        const args = [
            "-hide_banner",
            "-loglevel", "error",
            "-f", "lavfi",
            "-i", filter,
            "-loop", "0",
            "-lossless", "0",
            "-compression_level", "6",
            "-q:v", "65",
            "-preset", "picture",
            "-an",
            "-vsync", "0",
            "-f", "webp",
            "pipe:1"
        ];

        const ffmpeg = spawn(ffmpegBin, args, {
            stdio: ["ignore", "pipe", "pipe"]
        });

        const outputChunks = [];
        const errorChunks = [];

        const timeout = setTimeout(() => {
            ffmpeg.kill("SIGKILL");
            reject(new Error("ATTP render timeout වුණා."));
        }, 60 * 1000);

        ffmpeg.stdout.on("data", (chunk) => outputChunks.push(chunk));
        ffmpeg.stderr.on("data", (chunk) => errorChunks.push(chunk));

        ffmpeg.on("error", (err) => {
            clearTimeout(timeout);

            if (err.code === "ENOENT") {
                reject(new Error("FFmpeg install කරලා නෑ."));
            } else {
                reject(err);
            }
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(timeout);

            if (code === 0) {
                const buffer = Buffer.concat(outputChunks);

                if (!buffer || buffer.length < 1000) {
                    reject(new Error("Sticker output එක empty වුණා."));
                    return;
                }

                resolve(buffer);
                return;
            }

            const errorText = Buffer.concat(errorChunks).toString("utf8");
            reject(new Error(errorText || `FFmpeg failed with code ${code}`));
        });
    });
}

Sparky({
    name: "attp",
    alias: ["ttp", "animatedtext"],
    category: "tools",
    fromMe: isPublic,
    desc: "Text එක animated color sticker එකක් බවට convert කරන්න"
}, async ({ client, m, args }) => {
    try {
        const text = getArgsText(args, m);

        if (!text) {
            return await m.reply(
                "✍️ Sticker කරන්න text එකක් දෙන්න මචං.\n\n" +
                "උදා:\n.attp Sadew Mini"
            );
        }

        if (text.length > 40) {
            return await m.reply("❌ Text එක දිග වැඩියි මචං. characters 40 ට අඩුවෙන් දෙන්න.");
        }

        await m.react("🎨");

        const stickerBuffer = await createAttpSticker(text);

        await client.sendMessage(m.jid, {
            sticker: stickerBuffer
        }, { quoted: m });

        await m.react("✅");
    } catch (err) {
        console.log("ATTP command error:", err);
        await m.react("❌");

        await m.reply(
            "❌ ATTP sticker එක හදාගන්න බැරි වුණා මචං.\n\n" +
            "හේතුව: " + err.message
        );
    }
});
