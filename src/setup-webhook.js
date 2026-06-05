require("dotenv").config();

const TelegramBot =
require("node-telegram-bot-api");

const bot = new TelegramBot(
process.env.TELEGRAM_TOKEN
);

bot.setWebHook(
"https://floridly-peremptory-derek.ngrok-free.dev/telegram"
);

console.log("Webhook Set");