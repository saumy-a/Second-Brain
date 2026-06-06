const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const gemini = require('../services/gemini');
const tg = require('../services/telegram');
const { parseMessage } = require('../utils/parser');

// ── Webhook endpoint ──────────────────────────────────────
router.post('/', async (req, res) => {
  res.sendStatus(200); // always ack first, process async
  const update = req.body;

  // ── Handle incoming messages ─────────────────────────────
  if (!update.message) return;
  const msg = update.message;
  const parsed = parseMessage(msg);

  // ── Ensure user exists in DB ─────────────────────────────
  let { data: user } = await supabase
    .from('users').select('*').eq('telegram_chat_id', String(parsed.chatId)).single();

  if (!user) {
    const { data: newUser } = await supabase.from('users').insert({
      telegram_chat_id: String(parsed.chatId)
    }).select().single();
    user = newUser;
  }

  // ── Ignore empty messages ────────────────────────────────
  if (!parsed.content) return;

  // ── Suggest tag from Gemini ──────────────────────────────
  const suggestedTag = await gemini.suggestTag(parsed.content);

  // ── Save to database ─────────────────────────────────────
  await supabase
    .from("items")
    .insert({
      user_id: user.id,
      content: parsed.content,
      type: parsed.type,
      source_url: parsed.sourceUrl,
      status: "inbox",
      tag: suggestedTag
    });

  // ── Send text confirmation with AI tag ───────────────────
  await tg.sendMessage(parsed.chatId, `Saved ✅\n\nAI Tag: ${suggestedTag}`);
});

module.exports = router;