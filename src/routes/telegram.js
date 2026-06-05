const express = require("express");
const router = express.Router();

const supabase = require("../services/supabase");
const bot = require("../services/telegram");

const { parseMessage } = require("../utils/parser");

router.post("/", async (req, res) => {

  res.sendStatus(200);

  const update = req.body;

  if (!update.message) return;

  const parsed = parseMessage(update.message);

  await supabase
    .from("items")
    .insert({
      content: parsed.content,
      type: parsed.type
    });

  await bot.sendMessage(
    parsed.chatId,
    "Saved ✅"
  );

});

module.exports = router;