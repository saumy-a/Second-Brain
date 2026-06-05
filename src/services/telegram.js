const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(
  process.env.TELEGRAM_TOKEN,
  { polling: false }
);

module.exports = bot;