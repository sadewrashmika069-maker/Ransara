const axios = require('axios');
const { prepareWAMessageMedia, generateWAMessageFromContent } = require('@whiskeysockets/baileys');
const { Sparky } = require('../lib');

Sparky(
    {
        name: "img", // ඩොට් එක නැතුව සාමාන්‍ය විදිහට කමාන්ඩ් එක දෙනවා
        alias: ["image"], // .image ගැහුවත් වැඩ කරන්න ඇලියස් එකක් දානවා
        fromMe: false,
        category: 'search',
        desc: 'Search images on Google using WhiteShadow API.',
        use: '.img Sri Lanka'
    },
    async ({ m, client, text }) => {
        // උඹේ බොට් එකේ text හෝ q එකෙන් තමයි සර්ච් කොයරි එක එන්නේ
        const query = text; 
        const jid = m.chat;

        // සර්ච් එකක් දාලා නැත්නම්
        if (!query) {
            return await client.sendMessage(jid, { text: '🔍 කරුණාකර සර්ච් කරන්න ඕනේ දේ ඇතුළත් කරන්න. (Example: .img car)' }, { quoted: m });
        }

        try {
            await m.react('🔍');

            // API එකට රික්වෙස්ට් එක දානවා
            const apiUrl = `https://whiteshadow-x-api.onrender.com/api/search/google-image?q=${encodeURIComponent(query)}&format=png&limit=5&apitoken=VK4fry`;
            const response = await axios.get(apiUrl);

            if (!response.data.success || !response.data.results || response.data.results.length === 0) {
                await m.react('❌');
                return await client.sendMessage(jid, { text: '❌ කිසිදු පින්තූරයක් සොයාගත නොහැකි විය.' }, { quoted: m });
            }

            const results = response.data.results;

            // 🌟 ක්‍රමය 1: Carousel (කාඩ් ලුක් එක) ට්‍රයි කරනවා
            try {
                let cards = [];
                for (let img of results) {
                    let imageHeader = await prepareWAMessageMedia(
                        { image: { url: img.image } },
                        { upload: client.waUploadToServer }
                    );

                    cards.push({
                        header: {
                            imageMessage: imageHeader.imageMessage,
                            hasMediaAttachment: true
                        },
                        body: { 
                            text: `📌 *Title:* ${img.title}\n📏 *Size:* ${img.width}x${img.height}` 
                        },
                        nativeFlowMessage: {
                            buttons: [
                                {
                                    name: "cta_url",
                                    buttonParamsJson: JSON.stringify({
                                        display_text: "🌐 View Source",
                                        url: img.source
                                    })
                                }
                            ]
                        }
                    });
                }

                const responseMessage = {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                body: { text: `🔍 *Google Image Search:* ${query.toUpperCase()}` },
                                carouselMessage: { cards: cards }
                            }
                        }
                    }
                };

                let msg = generateWAMessageFromContent(jid, responseMessage, { quoted: m });
                await client.relayMessage(jid, msg.message, { messageId: msg.key.id });
                await m.react('✅');

            } catch (carouselError) {
                // 🌟 ක්‍රමය 2 (Fallback): කැරොසල් එක සපෝර්ට් නැත්නම්, කෙලින්ම ඉමේජ් 5 යවනවා සයිලන්ට් වෙන්නේ නැතුව!
                console.log("Carousel failed, switching to normal sending...", carouselError);
                
                for (let i = 0; i < results.length; i++) {
                    let img = results[i];
                    await client.sendMessage(jid, {
                        image: { url: img.image },
                        caption: `🔍 *Result ${i + 1}*\n📌 *Title:* ${img.title}\n🌐 *Source:* ${img.source}`
                    }, { quoted: m });
                }
                await m.react('✅');
            }

        } catch (error) {
            console.error('Google Img Search Main Error:', error);
            await m.react('❌');
            // සර්වර් කේස් එකක් ආවොත් චැට් එකට මැසේජ් එකක් දානවා බ්ලෑන්ක් වෙන්නේ නැතුව
            return await client.sendMessage(jid, { text: `❌ සර්වර් එකෙන් රෙස්පොන්ස් එකක් ආවේ නැහැ මචං.` }, { quoted: m });
        }
    }
);
