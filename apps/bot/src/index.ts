import { botConfig } from './config.js';
import { createBot } from './bot.js';

async function main() {
  if (!botConfig.token) {
    console.error(
      'TELEGRAM_BOT_TOKEN در فایل .env تنظیم نشده است.\n' +
        '1) در BotFather یک بات بسازید و توکن را بگیرید\n' +
        '2) TELEGRAM_BOT_TOKEN=... را در .env ریشه پروژه بگذارید\n' +
        '3) API را روشن کنید و دوباره npm run dev:bot را اجرا کنید'
    );
    process.exit(1);
  }

  console.log(`Bot API base: ${botConfig.apiBase}`);
  const bot = createBot(botConfig.token);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  await bot.launch();
  const me = await bot.telegram.getMe();
  console.log(`Telegram bot @${me.username} is running (polling)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
