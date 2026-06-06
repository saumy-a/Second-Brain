require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const token = process.env.TELEGRAM_TOKEN;
const appUrl = process.env.APP_URL || "https://second-brain-production-539a.up.railway.app";
const webhookUrl = `${appUrl}/telegram`;

if (!token) {
  console.error("❌ ERROR: TELEGRAM_TOKEN is missing in .env");
  process.exit(1);
}

const bot = new TelegramBot(token);

console.log(`📡 Attempting to set webhook to: ${webhookUrl}`);

bot.setWebHook(webhookUrl)
  .then(() => {
    console.log("✅ Webhook successfully set!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Failed to set webhook:", err.message);
    process.exit(1);
  });