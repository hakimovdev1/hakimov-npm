# @hakimov/tgbot

A lightweight utility package for building Telegram bots faster with Node.js.

`@hakimov/tgbot` provides high-level helpers for:

* Subscription checking for required Telegram channels
* Automatic inline keyboard generation
* Safe broadcast messaging with rate-limit handling
* Media-aware message routing
* Blocked-user detection
* Progress tracking during broadcasts

Designed for developers using urlnode-telegram-bot-api[https://github.com/yagop/node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api).

---

# Features

## `notSubscribedChannels()`

Checks whether a Telegram user is subscribed to one or multiple channels.

If the user is missing subscriptions, the function automatically generates an inline keyboard containing:

* Channel join buttons
* A re-check button
* Custom button layouts
* Support for usernames, channel IDs, and Telegram links

### Supported Inputs

* Channel username
* Numeric channel ID
* `@channel`
* `https://t.me/channel`
* Arrays of multiple channels

---

## `safeBroadcast()`

A robust Telegram broadcast system with built-in protection against Telegram API limits.

### Included Capabilities

* Automatic retry handling for `429 Too Many Requests`
* Duplicate user removal
* Invalid ID filtering
* Blocked-user detection
* Supports all major Telegram media types
* Progress callbacks
* Delay control between messages

### Supported Message Types

* Text
* Photo
* Video
* Document
* Audio
* Animation / GIF
* Voice
* Sticker

---

# Installation

```bash
npm install @hakimov/tgbot
```

---

# Requirements

* Node.js 18+
* A Telegram bot created with BotFather
* Compatible with CommonJS

---

# Import

```js
const {
  notSubscribedChannels,
  safeBroadcast
} = require("@hakimov/tgbot");
```

---

# Usage

# 1. Channel Subscription Check

## Basic Example

```js
const TelegramBot = require("node-telegram-bot-api");
const { notSubscribedChannels } = require("@hakimov/tgbot");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

bot.on("message", async (msg) => {
  const keyboard = await notSubscribedChannels(
    bot,
    msg.from.id,
    [
      "@mychannel",
      "https://t.me/newschannel",
      -1001234567890
    ]
  );

  if (keyboard) {
    return bot.sendMessage(
      msg.chat.id,
      "Please join all required channels.",
      {
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
  }

  bot.sendMessage(msg.chat.id, "Access granted.");
});
```

---

## Custom Button Configuration

```js
const keyboard = await notSubscribedChannels(
  bot,
  msg.from.id,
  ["@channel1", "@channel2"],
  {
    callbackData: "verify_subscriptions",
    buttonText: "Join {title}",
    checkText: "Check Again",
    columns: 2
  }
);
```

## Available Options

| Option         | Type     | Default         | Description                               |
| -------------- | -------- | --------------- | ----------------------------------------- |
| `callbackData` | `string` | `check_sub`     | Callback data for the verification button |
| `buttonText`   | `string` | `➕ {title}`     | Join button text template                 |
| `checkText`    | `string` | `🔄 Tekshirish` | Verification button text                  |
| `columns`      | `number` | `1`             | Buttons per row                           |

---

# 2. Safe Broadcast System

## Simple Text Broadcast

```js
const { safeBroadcast } = require("@hakimov/tgbot");

const users = [123456789, 987654321];

const report = await safeBroadcast(
  bot,
  users,
  {
    text: "Server maintenance starts in 10 minutes."
  }
);

console.log(report);
```

---

## Broadcast Photo

```js
await safeBroadcast(
  bot,
  users,
  {
    type: "photo",
    media: "https://example.com/image.jpg",
    options: {
      caption: "New update released"
    }
  }
);
```

---

## Broadcast Video

```js
await safeBroadcast(
  bot,
  users,
  {
    type: "video",
    media: "./video.mp4",
    options: {
      caption: "Watch the new feature demo"
    }
  }
);
```

---

## Broadcast with Inline Keyboard

```js
await safeBroadcast(
  bot,
  users,
  {
    text: "Open dashboard",
    options: {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open",
              url: "https://example.com"
            }
          ]
        ]
      }
    }
  }
);
```

---

## Progress Tracking

```js
await safeBroadcast(
  bot,
  users,
  {
    text: "Broadcast message"
  },
  {
    delay: 50,
    onProgress: (progress) => {
      console.log(
        `${progress.current}/${progress.total}`,
        `Success: ${progress.success}`,
        `Blocked: ${progress.blocked}`,
        `Failed: ${progress.failed}`
      );
    }
  }
);
```

---

# Broadcast Response Format

```js
{
  success: 120,
  blocked: 5,
  failed: 2,
  blockedIds: [111111111],
  failedIds: [222222222]
}
```

---

# API Reference

# `notSubscribedChannels(bot, userId, channelIds, options)`

## Parameters

| Parameter    | Type                        | Required | Description           |
| ------------ | --------------------------- | -------- | --------------------- |
| `bot`        | `TelegramBot`               | Yes      | Telegram bot instance |
| `userId`     | `number \| string`          | Yes      | Telegram user ID      |
| `channelIds` | `Array \| string \| number` | Yes      | Channels to verify    |
| `options`    | `object \| string`          | No       | Custom configuration  |

## Returns

Returns:

* `null` if the user is subscribed to all channels
* `inline_keyboard` array if subscriptions are missing

---

# `safeBroadcast(bot, userIds, message, options)`

## Parameters

| Parameter | Type            | Required | Description             |
| --------- | --------------- | -------- | ----------------------- |
| `bot`     | `TelegramBot`   | Yes      | Telegram bot instance   |
| `userIds` | `Array<number>` | Yes      | Target user IDs         |
| `message` | `object`        | Yes      | Message payload         |
| `options` | `object`        | No       | Broadcast configuration |

---

# Broadcast Options

| Option       | Type       | Default | Description                            |
| ------------ | ---------- | ------- | -------------------------------------- |
| `delay`      | `number`   | `35`    | Delay between messages in milliseconds |
| `onProgress` | `Function` | `null`  | Progress callback                      |

---

# Error Handling

The package automatically handles:

* Invalid Telegram IDs
* Duplicate IDs
* Telegram flood limits
* Blocked bots
* Deactivated users
* Missing chats

Errors that cannot be recovered are added to the `failedIds` array.

---

# Example Project Structure

```txt
project/
├── bot.js
├── package.json
└── node_modules/
```

---

# Full Example

```js
const TelegramBot = require("node-telegram-bot-api");
const {
  notSubscribedChannels,
  safeBroadcast
} = require("@hakimov/tgbot");

const bot = new TelegramBot(process.env.BOT_TOKEN, {
  polling: true
});

const REQUIRED_CHANNELS = [
  "@channel1",
  "@channel2"
];

bot.on("message", async (msg) => {
  const keyboard = await notSubscribedChannels(
    bot,
    msg.from.id,
    REQUIRED_CHANNELS
  );

  if (keyboard) {
    return bot.sendMessage(
      msg.chat.id,
      "Please subscribe first.",
      {
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
  }

  await bot.sendMessage(msg.chat.id, "Welcome.");
});

async function announce() {
  const users = [123456789, 987654321];

  const result = await safeBroadcast(
    bot,
    users,
    {
      text: "New update is available"
    },
    {
      delay: 40
    }
  );

  console.log(result);
}
```

---

# Best Practices

## Recommended

* Store blocked IDs in a database
* Use delays larger than `35ms` for very large broadcasts
* Validate uploaded media before broadcasting
* Use progress callbacks for admin dashboards

## Avoid

* Broadcasting to millions of users without queue systems
* Sending unsupported media objects
* Ignoring Telegram rate limits

---

# License

ISC

---

# Author

Created by urlhakimovdev1 GitHub[https://github.com/hakimovdev1](https://github.com/hakimovdev1)

---

# Repository

urlGitHub Repository[https://github.com/hakimovdev1/hakimov-npm](https://github.com/hakimovdev1/hakimov-npm)
