# hakimov

Telegram botlar uchun yordamchi utilitlar. Hozircha foydalanuvchi kerakli kanallarga obuna bo'lganini tekshiradigan va obuna bo'lish uchun inline klaviatura tuzadigan funksiya mavjud.

## Ornatish

```bash
npm install hakimov
```

## Foydalanish

```js
const { notSubscribedChannels } = require('hakimov');

// Xabar ishlovchisi ichidagi misol
const keyboard = await notSubscribedChannels(
	bot,
	msg.from.id,
	["-1001234567890", "-1009876543210"],
	"check_sub"
);

if (keyboard) {
	await bot.sendMessage(
		msg.chat.id,
		"Iltimos, kerakli kanallarga obuna bo'ling:",
		{
			reply_markup: {
				inline_keyboard: keyboard
			}
		}
	);
	return;
}

// Foydalanuvchi barcha kanallarga obuna bo'lganida asosiy oqimni davom ettiring
```

## API

### notSubscribedChannels(bot, userId, channelIds, callbackData?)

Keltirilgan kanal ro'yxati bo'yicha foydalanuvchi obunasini tekshiradi. Agar kamida bitta kanalga obuna bo'lmasa, inline klaviatura qaytaradi. Agar hammasiga obuna bo'lsa, `null` qaytaradi.

#### Parametrlar

- `bot` (object, required): Telegram bot instance. `getChatMember`, `getChat`, va ixtiyoriy `createChatInviteLink` metodlariga ega bo'lishi kerak.
- `userId` (number, required): Telegram foydalanuvchi ID.
- `channelIds` (Array<number|string> | number | string, required): Kanal ID yoki ID'lar ro'yxati. `-100` prefiksi bilan yoki prefikssiz bo'lishi mumkin. Bitta ID yoki Array ko'rinishida berilishi mumkin.
- `callbackData` (string, optional): Oxirgi "tekshirish" tugmasi uchun `callback_data`. Standart qiymat `check_sub`.

#### Qaytadi

- `Array` inline klaviatura qatorlari (agar kamida bitta kanal yo'q bo'lsa).
- `null` (agar foydalanuvchi barcha kanallarga obuna bo'lsa).

## Xulq-atvor eslatmalari

- Agar `getChatMember` kanal bo'yicha xato qaytarsa, foydalanuvchi obuna emas deb olinadi.
- Funksiya kanalga kirish linkini `username`, `invite_link`, yoki ruxsat bo'lsa yangi invite link yaratish orqali topishga harakat qiladi.

## Repository

- Issues: https://github.com/hakimovdev1/hakimov-npm/issues
- Source: https://github.com/hakimovdev1/hakimov-npm

## License

ISC
