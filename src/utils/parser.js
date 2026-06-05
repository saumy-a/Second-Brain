function parseMessage(msg) {
  return {
    chatId: msg.chat.id,
    content: msg.text || "",
    type: "text"
  };
}

module.exports = {
  parseMessage
};