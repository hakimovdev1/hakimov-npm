# hakimovdev

Utilities for Telegram bots. Currently includes a helper that checks whether a user is subscribed to required channels and builds an inline keyboard for subscription prompts.

## Install

```bash
npm install hakimovdev
```

## Usage

```js
const { notSubscribedChannels } = require('hakimovdev');

// Example inside a message handler
const keyboard = await notSubscribedChannels(
	bot,
	msg.from.id,
	["-1001234567890", "-1009876543210"],
	"check_sub"
);

if (keyboard) {
	await bot.sendMessage(
		msg.chat.id,
		"Please subscribe to the required channels:",
		{
			reply_markup: {
				inline_keyboard: keyboard
			}
		}
	);
	return;
}

// Continue normal flow when the user is subscribed to all channels
```

## API

### notSubscribedChannels(bot, userId, channelIds, callbackData?)

Checks a user's membership across a list of channels and returns an inline keyboard for channels that the user has not joined. When all channels are joined, it returns `null`.

#### Parameters

- `bot` (object, required): Telegram bot instance. Must implement `getChatMember`, `getChat`, and optionally `createChatInviteLink`.
- `userId` (number, required): Telegram user ID.
- `channelIds` (Array<number|string>, required): List of channel IDs. Values can be with or without the `-100` prefix.
- `callbackData` (string, optional): Callback data for the final "check" button. Default is `check_sub`.

#### Returns

- `Array` inline keyboard rows when at least one channel is missing.
- `null` when the user is subscribed to all channels.

## Behavior Notes

- If `getChatMember` fails for a channel, the user is treated as not subscribed.
- The helper tries to build a join link using `username`, `invite_link`, or by creating a new invite link if permitted.

## Repository

- Issues: https://github.com/hakimovdev1/hakimov-npm/issues
- Source: https://github.com/hakimovdev1/hakimov-npm

## License

ISC
