"use strict";

module.exports = { notSubscribedChannels };

/**
 * Telegram userning kanallarga obuna bo‘lganini tekshiradi.
 * Agar kamida bitta kanalga obuna bo‘lmagan bo‘lsa inline keyboard qaytaradi.
 * Agar barcha kanallarga obuna bo‘lgan bo‘lsa null qaytaradi.
 *
 * @param {import("node-telegram-bot-api")} bot
 * @param {number} userId
 * @param {(number|string)[]} channelIds
 * @param {string} callbackData
 *
 * @returns {Promise<import("node-telegram-bot-api").InlineKeyboardButton[][] | null>}
 */
async function notSubscribedChannels(
  bot,
  userId,
  channelIds,
  callbackData = "check_sub"
) {
  validateParams(bot, userId, channelIds);

  const normalizedIds = normalizeChannelIds(channelIds);

  const results = await Promise.all(
    normalizedIds.map((channelId) =>
      checkChannelSubscription(bot, userId, channelId)
    )
  );

  const keyboard = results
    .filter(Boolean)
    .map((url) => [{ text: "➕ Obuna bo‘lish", url }]);

  if (!keyboard.length) return null;

  keyboard.push([
    { text: "🔄 Tekshirish", callback_data: callbackData }
  ]);

  return keyboard;
}

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

/**
 * Parametrlarni tekshiradi
 */
function validateParams(bot, userId, channelIds) {
  if (!bot || typeof bot.getChatMember !== "function") {
    throw new Error("notSubscribedChannels: invalid bot instance");
  }

  if (!userId || typeof userId !== "number") {
    throw new Error("notSubscribedChannels: invalid userId");
  }

  if (!Array.isArray(channelIds) || channelIds.length === 0) {
    throw new Error("notSubscribedChannels: channelIds must be a non-empty array");
  }
}

/**
 * Kanal ID larni -100 formatga normalize qiladi
 */
function normalizeChannelIds(channelIds) {
  return channelIds
    .map((id) => {
      const str = String(id).trim();

      if (!str) return null;

      return str.startsWith("-100")
        ? Number(str)
        : Number(`-100${str}`);
    })
    .filter(Number.isFinite);
}

/**
 * Bitta kanal uchun subscription tekshiradi
 * Agar obuna bo‘lmagan bo‘lsa kanal linkini qaytaradi
 *
 * @returns {Promise<string|null>}
 */
async function checkChannelSubscription(bot, userId, channelId) {
  const subscribed = await isUserSubscribed(bot, userId, channelId);

  if (subscribed) return null;

  const url = await resolveChannelUrl(bot, channelId);

  return url || null;
}

/**
 * User kanalga obuna bo‘lganini tekshiradi
 */
async function isUserSubscribed(bot, userId, channelId) {
  try {
    const member = await bot.getChatMember(channelId, userId);

    return ["member", "administrator", "creator"].includes(member?.status);
  } catch {
    return false;
  }
}

/**
 * Kanal URL ni topadi
 */
async function resolveChannelUrl(bot, channelId) {
  try {
    const chat = await bot.getChat(channelId);

    if (chat?.username) {
      return `https://t.me/${chat.username}`;
    }

    if (chat?.invite_link) {
      return chat.invite_link;
    }

    return await createInviteLink(bot, channelId);

  } catch {
    return null;
  }
}

/**
 * Invite link yaratishga harakat qiladi
 */
async function createInviteLink(bot, channelId) {
  try {
    const link = await bot.createChatInviteLink(channelId);
    return link?.invite_link || null;
  } catch {
    return null;
  }
}