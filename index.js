"use strict";

module.exports = { notSubscribedChannels };

/**
 * Telegram userning kanallarga obuna bo‘lganini tekshiradi.
 * Kamida bitta kanalga obuna bo‘lmagan bo‘lsa moslashtirilgan inline keyboard qaytaradi.
 *
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} userId
 * @param {number|string|(number|string)[]} channelIds
 * @param {string|object} [options="check_sub"] - Callback data yoki sozlamalar obyekti
 * @param {string} [options.callbackData="check_sub"] - Tekshirish tugmasi uchun callback_data
 * @param {string} [options.buttonText="➕ {title}"] - Kanal tugmasi matni (`{title}` avtomat almashadi)
 * @param {string} [options.checkText="🔄 Tekshirish"] - Tekshirish tugmasi matni
 * @param {number} [options.columns=1] - Kanallar tugmalari nechta ustunda joylashishi
 *
 * @returns {Promise<import("node-telegram-bot-api").InlineKeyboardButton[][] | null>}
 */
async function notSubscribedChannels(
  bot,
  userId,
  channelIds,
  options = "check_sub"
) {
  const idsArray = Array.isArray(channelIds) ? channelIds : [channelIds];

  validateParams(bot, userId, idsArray);

  // Sozlamalarni standart qiymatlar bilan birlashtirish (Backward compatibility saqlangan)
  const config = {
    callbackData: "check_sub",
    buttonText: "➕ {title}",
    checkText: "🔄 Tekshirish",
    columns: 1,
    ...(typeof options === "string" ? { callbackData: options } : options)
  };

  const normalizedIds = normalizeChannelIds(idsArray);

  const results = await Promise.all(
    normalizedIds.map((channelId) =>
      checkChannelSubscription(bot, userId, channelId)
    )
  );

  // Faqat obuna bo'linmagan va ma'lumotlari muvaffaqiyatli olingan kanallar
  const unsubscribedChannels = results.filter(Boolean);

  if (!unsubscribedChannels.length) return null;

  // Tugmalarni formatlash
  const channelButtons = unsubscribedChannels.map((channel) => {
    const text = config.buttonText.replace("{title}", channel.title);
    return { text, url: channel.url };
  });

  // Tugmalarni ustunlar bo'yicha bo'lish (Chunking)
  const keyboard = chunkArray(channelButtons, config.columns);

  // Oxiriga "Tekshirish" tugmasini alohida qator qilib qo'shish
  keyboard.push([
    { text: config.checkText, callback_data: config.callbackData }
  ]);

  return keyboard;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                   */
/* -------------------------------------------------------------------------- */

function validateParams(bot, userId, channelIds) {
  if (!bot || typeof bot.getChatMember !== "function") {
    throw new Error("notSubscribedChannels: invalid bot instance");
  }

  if (!userId || typeof userId !== "number") {
    throw new Error("notSubscribedChannels: invalid userId");
  }

  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    throw new Error("notSubscribedChannels: channelIds must be a valid channel ID or a non-empty array");
  }
}

function normalizeChannelIds(channelIds) {
  return channelIds
    .map((id) => {
      const str = String(id).trim();
      if (!str) return null;
      return str.startsWith("-100") ? Number(str) : Number(`-100${str}`);
    })
    .filter(Number.isFinite);
}

/**
 * Bitta kanal uchun subscription tekshiradi.
 * Obuna bo‘lmagan bo‘lsa kanal linki va sarlavhasini qaytaradi.
 *
 * @returns {Promise<{url: string, title: string}|null>}
 */
async function checkChannelSubscription(bot, userId, channelId) {
  const subscribed = await isUserSubscribed(bot, userId, channelId);

  if (subscribed) return null;

  return await getChannelDetails(bot, channelId);
}

async function isUserSubscribed(bot, userId, channelId) {
  try {
    const member = await bot.getChatMember(channelId, userId);
    return ["member", "administrator", "creator"].includes(member?.status);
  } catch {
    return false;
  }
}

/**
 * Kanal URL va Title ma'lumotlarini qaytaradi
 */
async function getChannelDetails(bot, channelId) {
  try {
    const chat = await bot.getChat(channelId);
    const title = chat?.title || "Kanalga o'tish";

    if (chat?.username) {
      return { url: `https://t.me/${chat.username}`, title };
    }

    if (chat?.invite_link) {
      return { url: chat.invite_link, title };
    }

    // Agar taklif havolasi bo'lmasa, yangi yaratamiz
    const link = await bot.createChatInviteLink(channelId);
    return link?.invite_link ? { url: link.invite_link, title } : null;

  } catch {
    return null;
  }
}

/**
 * Massivni berilgan o'lcham bo'yicha bo'laklarga ajratadi (Ustunlar sxemasi uchun)
 */
function chunkArray(array, size) {
  const chunked = [];
  const validSize = Math.max(1, parseInt(size) || 1);
  for (let i = 0; i < array.length; i += validSize) {
    chunked.push(array.slice(i, i + validSize));
  }
  return chunked;
}