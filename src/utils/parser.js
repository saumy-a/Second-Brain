function parseMessage(msg) {

  const result = {
    chatId: msg.chat.id,
    type: "text",
    content: "",
    sourceUrl: null,
    fileId: null
  };

  if (msg.document) {
    result.type = "doc";
    result.content = msg.document.file_name || "Document";
    result.fileId = msg.document.file_id;
  }

  else if (msg.photo) {
    result.type = "image";
    result.content = msg.caption || "Image";
    result.fileId = msg.photo[msg.photo.length - 1].file_id;
  }

  else if (msg.voice) {
    result.type = "voice";
    result.content = "Voice Note";
    result.fileId = msg.voice.file_id;
  }

  else if (msg.text) {

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = msg.text.match(urlRegex);

    if (urls) {
      result.type = "url";
      result.content = msg.text;
      result.sourceUrl = urls[0];
    } else {
      result.type = "text";
      result.content = msg.text;
    }
  }

  return result;
}

module.exports = { parseMessage };