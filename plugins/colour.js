const Jimp = require('jimp'); 
const { downloadContentFromMessage } = require('@whiskeysockets/baileys'); 
const { Sparky } = require('../lib'); 

// Saturation (කලර් වැඩි කරන) මට්ටම් 5
const satLevels = {
    '1': 20,  
    '2': 40,  
    '3': 60,  
    '4': 80,  
    '5': 100  
};

Sparky(
    {
        // 🛠️ ප්‍රීෆික්ස් එක විදිහට ඩොට් එක (^\.) අනිවාර්ය කරලා Regex එක හැදුවා මචං
        name: /^\.(colour|color)\s*([1-5])$/i, 
        fromMe: false,
        category: 'editor',
        desc: 'Edit a photo to increase colour/saturation based on level 1-5 with dot prefix.',
        use: 'Reply to a photo with .colour 1-5 or .color 1-5'
    },
    async ({ m, client, match }) => {
        // match[1] = colour/color, match[2] = මට්ටම (1-5)
        const cmdName = match[1]; 
        const level = match[2];
        const jid = m.chat;

        // 1. ෆොටෝ එකකට reply කරලාද බලනවා
        const quoted = m.quoted ? m.quoted : m;
        const mime = quoted.msg?.mimetype || '';

        if (!mime.startsWith('image')) {
            await m.react('❌');
            return await client.sendMessage(jid, { text: '❌ කරුණාකර පින්තූරයකට reply කරලා මේ කමාන්ඩ් එක ගහන්න.' });
        }

        try {
            await m.react('📥'); 

            // 2. Reply කරපු පින්තූරයේ buffer එක බාගැනීම
            const stream = await downloadContentFromMessage(quoted.msg, 'image');
            let buffer = Buffer.from([]);
            for await(const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // 3. Image Processing කොටස
            await m.react('🎨'); 

            const image = await Jimp.read(buffer); 
            const satAmount = satLevels[level]; 

            // කලර් වැඩි කරලා HD Quality එකෙන්ම අවුට්පුට් එක හදනවා
            image
                .normalize()
                .color([{ apply: 'saturate', params: [satAmount] }]);

            const editedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG, { quality: 100 });

            // 4. එඩිට් වෙච්ච පින්තූරය යැවීම
            await m.react('✅'); 
            await client.sendMessage(
                jid, 
                { 
                    image: editedBuffer, 
                    caption: `🎨 *Edited via Sadew-MD*\n✨ *Command:* .${cmdName}${level}\n💎 *Saturation:* +${satAmount}%` 
                }, 
                { quoted: m }
            );

        } catch (error) {
            console.error('Image editor error:', error);
            await m.react('❌');
            return await client.sendMessage(jid, { text: `❌ පින්තූරය එඩිට් කරන්න බැරි වුණා.` });
        }
    }
);
