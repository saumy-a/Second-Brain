const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

// Send a simple text message
async function sendMessage(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// Send save confirmation with tag buttons
async function sendTagPrompt(chatId, itemId, suggestedTag) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '💡 idea', callback_data: `tag:${itemId}:idea` },
        { text: '🎬 reel', callback_data: `tag:${itemId}:reel` },
        { text: '📝 article', callback_data: `tag:${itemId}:article` },
      ],
      [
        { text: '📄 doc', callback_data: `tag:${itemId}:document` },
        { text: '✨ other', callback_data: `tag:${itemId}:other` },
      ]
    ]
  };

  const text = `✅ Saved! AI suggests: *${suggestedTag}*\n\nConfirm or change tag:`;
  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// Send a similarity nudge
async function sendSimilarNudge(chatId, similarItem) {
  const text = `🔄 You saved something similar before:\n\n_${similarItem.content.slice(0, 150)}..._\n\nStill relevant?`;
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

module.exports = { bot, sendMessage, sendTagPrompt, sendSimilarNudge };