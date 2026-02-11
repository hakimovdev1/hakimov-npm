module.exports = { notSubscribedChannels };

/**
 * Foydalanuvchi kanallarga obuna bo‘lgan yoki bo‘lmaganini tekshiradi
 * Agar kamida bitta kanalga obuna bo‘lmagan bo‘lsa:
 *  - obuna bo‘lish tugmalari (inline keyboard) qaytaradi
 *  - oxiriga "Tekshirish" callback tugmasini qo‘shadi
 *
 * Agar barcha kanallarga obuna bo‘lgan bo‘lsa — null qaytaradi
 *
 * @param {Object} bot - Telegram bot instance (node-telegram-bot-api yoki mos)
 * @param {number} userId - Foydalanuvchi ID
 * @param {Array<number|string>} channelIds - Kanal ID lar (-100 bilan yoki usiz)
 * @param {string} callbackData - "Tekshirish" tugmasi uchun callback_data
 *
 * @returns {Array|null} inline_keyboard array yoki null
 */
async function notSubscribedChannels(
    bot,
    userId,
    channelIds,
    callbackData = 'check_sub'
) {
    /* ---------- Parametrlar validatsiyasi ---------- */
    if (!bot?.getChatMember)
        throw new Error('notSubscribedChannels: bot noto‘g‘ri');

    if (!userId)
        throw new Error('notSubscribedChannels: userId noto‘g‘ri');

    if (!Array.isArray(channelIds) || !channelIds.length)
        throw new Error('notSubscribedChannels: channelIds bo‘sh');

    /* ---------- Kanal ID ni -100 formatga keltirish ---------- */
    const normalizeChannelId = id =>
        String(id).startsWith('-100')
            ? Number(id)
            : Number(`-100${id}`);

    const keyboard = [];
    let needSubscribe = false;

    /* ---------- Har bir kanal bo‘yicha tekshiruv ---------- */
    for (const rawId of channelIds) {
        const channelId = normalizeChannelId(rawId);

        /* ---------- 1. Foydalanuvchi obuna bo‘lganmi? ---------- */
        try {
            const member = await bot.getChatMember(channelId, userId);

            // Agar obuna bo‘lgan bo‘lsa — keyingi kanalga o‘tamiz
            if (['member', 'administrator', 'creator'].includes(member.status))
                continue;
        } catch {
            // getChatMember xato bersa ham
            // foydalanuvchi obuna emas deb hisoblaymiz
        }

        // Kamida bitta kanalga obuna bo‘lmagan
        needSubscribe = true;

        /* ---------- 2. Kanalga kirish uchun link topish ---------- */
        try {
            const chat = await bot.getChat(channelId);
            let url = null;

            // 2.1 Public kanal bo‘lsa
            if (chat.username) {
                url = `https://t.me/${chat.username}`;

                // 2.2 Private kanal va invite_link mavjud bo‘lsa
            } else if (chat.invite_link) {
                url = chat.invite_link;

                // 2.3 Oxirgi chora — yangi invite link yaratish
            } else {
                try {
                    const link = await bot.createChatInviteLink(channelId);
                    url = link.invite_link;
                } catch {
                    // Bot admin bo‘lmasa yoki ruxsat yo‘q bo‘lsa — url bo‘lmaydi
                }
            }

            // Agar link topilgan bo‘lsa — tugma qo‘shamiz
            if (url) {
                keyboard.push([
                    { text: '➕ Obuna bo‘lish', url }
                ]);
            }

        } catch {
            // getChat xatolari — e’tiborsiz qoldiriladi
        }
    }

    /* ---------- Agar barcha kanallarga obuna bo‘lgan bo‘lsa ---------- */
    if (!needSubscribe) return null;

    /* ---------- Oxiriga "Tekshirish" tugmasi ---------- */
    keyboard.push([
        { text: '🔄 Tekshirish', callback_data: callbackData }
    ]);

    return keyboard;
}


