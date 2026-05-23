"use strict";

module.exports = { notSubscribedChannels, safeBroadcast };

/**
 * Telegram userning kanallarga obuna bo‘lganini tekshiradi.
 * Kamida bitta kanalga obuna bo‘lmagan bo‘lsa moslashtirilgan inline keyboard qaytaradi.
 *
 * @param {import("node-telegram-bot-api")} bot - Telegram bot instansi
 * @param {number|string} userId - Foydalanuvchi IDsi
 * @param {number|string|(number|string)[]} channelIds - ID, Username yoki t.me havolalari (Yakka yoki Massiv)
 * @param {string|object} [options="check_sub"] - Callback data yoki vizual sozlamalar obyekti
 */
async function notSubscribedChannels(
  bot,
  userId,
  channelIds,
  options = "check_sub"
) {
  const targetUserId = Number(userId);
  const idsArray = Array.isArray(channelIds) ? channelIds : [channelIds];

  validateChannelsParams(bot, targetUserId, idsArray);

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
      checkChannelSubscription(bot, targetUserId, channelId)
    )
  );

  const unsubscribedChannels = results.filter(Boolean);

  if (!unsubscribedChannels.length) return null;

  const channelButtons = unsubscribedChannels.map((channel) => {
    const text = config.buttonText.replace("{title}", channel.title);
    return { text, url: channel.url };
  });

  const keyboard = chunkArray(channelButtons, config.columns);

  keyboard.push([
    { text: config.checkText, callback_data: config.callbackData }
  ]);

  return keyboard;
}

/**
 * Telegram foydalanuvchilariga xavfsiz va moslashuvchan tarzda ommaviy xabar yuboradi (Broadcast).
 * Matn, rasm, video, fayl, audio, gif va boshqa media turlarini avtomatik taniyda va yuboradi.
 * Telegram'ning "Too Many Requests" (429) cheklovlarini dynamic chetlab o'tadi.
 *
 * @param {import("node-telegram-bot-api")} bot - Bot instansi
 * @param {(number|string)[]} userIds - Telegram user ID-lari massivi
 * @param {object} message - Yuboriladigan xabar/media obyekti
 * @param {string} [message.type="text"] - Xabar turi: "text", "photo", "video", "document", "audio", "animation", "voice", "sticker"
 * @param {string} [message.text] - Matnli xabarlar uchun asosiy matn
 * @param {string|Buffer|import("fs").ReadStream} [message.media] - Media fayl (file_id, URL yoki fayl oqimi)
 * @param {object} [message.options] - inline_keyboard, caption, parse_mode va boshqa qo'shimcha parametrlar
 * @param {object} [options] - Qo'shimcha sozlamalar
 * @param {number} [options.delay=35] - Har bir xabar orasidagi kechikish (millisekundda)
 * @param {Function} [options.onProgress] - Progressni kuzatish uchun callback funksiya
 *
 * @returns {Promise<{ success: number, blocked: number, failed: number, blockedIds: number[], failedIds: number[] }>}
 */
async function safeBroadcast(bot, userIds, message, options = {}) {
  if (!bot) {
    throw new Error("safeBroadcast: invalid bot instance");
  }
  if (!Array.isArray(userIds)) {
    throw new Error("safeBroadcast: userIds must be an array");
  }
  if (!message || typeof message !== "object") {
    throw new Error("safeBroadcast: message parameters must be an object");
  }

  const config = {
    delay: 35,
    onProgress: null,
    ...options
  };

  const report = {
    success: 0,
    blocked: 0,
    failed: 0,
    blockedIds: [],
    failedIds: []
  };

  // Moslashuvchan tozalash: Dublikatlarni o'chirish va faqat butun sonli IDlarni qoldirish
  const cleanUserIds = [...new Set(
    userIds
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id) && id > 0)
  )];

  if (cleanUserIds.length === 0) return report;

  // Xabar turiga qarab bot metodini va uning parametrlarini aniqlash (Smart Router)
  const { sendMethod, arg1, arg2 } = resolveMessagePayload(bot, message);

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  for (let i = 0; i < cleanUserIds.length; i++) {
    const userId = cleanUserIds[i];

    try {
      // Dinamik metod chaqiruvi (Masalan: bot.sendPhoto(userId, photo, options))
      if (arg2 !== undefined) {
        await bot[sendMethod](userId, arg1, arg2);
      } else {
        await bot[sendMethod](userId, arg1);
      }
      report.success++;
    } catch (error) {
      const errorStr = String(error?.message || error?.response?.body?.description || error);

      if (
        errorStr.includes("bot was blocked by the user") ||
        errorStr.includes("user is deactivated") ||
        errorStr.includes("chat not found")
      ) {
        report.blocked++;
        report.blockedIds.push(userId);
      } else if (errorStr.includes("Too Many Requests") || errorStr.includes("429")) {
        // Dynamic retry_after logic
        const retryAfter = error.parameters?.retry_after
          ? (error.parameters.retry_after * 1000) + 500
          : 2500;

        await sleep(retryAfter);
        i--; // Jarayonni ushbu foydalanuvchiga qaytarish
        continue;
      } else {
        report.failed++;
        report.failedIds.push(userId);
      }
    }

    if (config.delay > 0 && i < cleanUserIds.length - 1) {
      await sleep(config.delay);
    }

    if (typeof config.onProgress === "function") {
      config.onProgress({
        current: i + 1,
        total: cleanUserIds.length,
        ...report
      });
    }
  }

  return report;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Kelayotgan xabar tarkibiga qarab to'g'ri Telegram metodini va argumentlarni moslashtiradi
 */
function resolveMessagePayload(bot, message) {
  // Agar xabar turi aniq ko'rsatilmagan bo'lsa, ichidagi kalit so'zlardan aniqlaymiz
  let type = message.type ? String(message.type).toLowerCase() : null;

  if (!type) {
    if (message.photo) type = "photo";
    else if (message.video) type = "video";
    else if (message.document) type = "document";
    else if (message.audio) type = "audio";
    else if (message.animation) type = "animation";
    else if (message.voice) type = "voice";
    else if (message.sticker) type = "sticker";
    else type = "text";
  }

  const mediaSource = message.media || message[type];
  const msgOptions = message.options || {};

  switch (type) {
    case "photo":
      if (typeof bot.sendPhoto !== "function") throw new Error("bot.sendPhoto is not a function");
      return { sendMethod: "sendPhoto", arg1: mediaSource, arg2: msgOptions };
    case "video":
      if (typeof bot.sendVideo !== "function") throw new Error("bot.sendVideo is not a function");
      return { sendMethod: "sendVideo", arg1: mediaSource, arg2: msgOptions };
    case "document":
      if (typeof bot.sendDocument !== "function") throw new Error("bot.sendDocument is not a function");
      return { sendMethod: "sendDocument", arg1: mediaSource, arg2: msgOptions };
    case "audio":
      if (typeof bot.sendAudio !== "function") throw new Error("bot.sendAudio is not a function");
      return { sendMethod: "sendAudio", arg1: mediaSource, arg2: msgOptions };
    case "animation":
      if (typeof bot.sendAnimation !== "function") throw new Error("bot.sendAnimation is not a function");
      return { sendMethod: "sendAnimation", arg1: mediaSource, arg2: msgOptions };
    case "voice":
      if (typeof bot.sendVoice !== "function") throw new Error("bot.sendVoice is not a function");
      return { sendMethod: "sendVoice", arg1: mediaSource, arg2: msgOptions };
    case "sticker":
      if (typeof bot.sendSticker !== "function") throw new Error("bot.sendSticker is not a function");
      return { sendMethod: "sendSticker", arg1: mediaSource, arg2: msgOptions };
    case "text":
    default:
      if (typeof bot.sendMessage !== "function") throw new Error("bot.sendMessage is not a function");
      const textContent = message.text || (typeof mediaSource === "string" ? mediaSource : "");
      if (!textContent) throw new Error("safeBroadcast: text message type requires a valid text content");
      return { sendMethod: "sendMessage", arg1: textContent, arg2: msgOptions };
  }
}

function validateChannelsParams(bot, userId, channelIds) {
  if (!bot || typeof bot.getChatMember !== "function") {
    throw new Error("notSubscribedChannels: invalid bot instance");
  }
  if (isNaN(userId) || userId <= 0) {
    throw new Error("notSubscribedChannels: invalid or missing userId");
  }
  if (channelIds.length === 0) {
    throw new Error("notSubscribedChannels: channelIds array cannot be empty");
  }
}

function normalizeChannelIds(channelIds) {
  return channelIds
    .map((id) => {
      if (typeof id === "number") {
        return String(id).startsWith("-100") ? id : Number(`-100${id}`);
      }

      if (typeof id !== "string") return null;
      let str = id.trim();
      if (!str) return null;

      const linkMatch = str.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,})(?:\/|\?|$)/i);
      if (linkMatch && linkMatch[1]) {
        return `@${linkMatch[1]}`;
      }

      if (/^-?\d+$/.test(str)) {
        return str.startsWith("-100") ? Number(str) : Number(`-100${str.replace("-", "")}`);
      }

      if (!str.startsWith("@") && /^[a-zA-Z0-9_]{5,}$/.test(str)) {
        return `@${str}`;
      }

      return str.startsWith("@") ? str : null;
    })
    .filter(Boolean);
}

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

    const link = await bot.createChatInviteLink(channelId);
    return link?.invite_link ? { url: link.invite_link, title } : null;
  } catch {
    return null;
  }
}

function chunkArray(array, size) {
  const chunked = [];
  const validSize = Math.max(1, parseInt(size) || 1);
  for (let i = 0; i < array.length; i += validSize) {
    chunked.push(array.slice(i, i + validSize));
  }
  return chunked;
}