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

  try {
    // ── Handle button taps (tag confirmation) ──────────────
    if (update.callback_query) {
      const { id, data, from, message } = update.callback_query;
      if (data.startsWith('tag:')) {
        const [, itemId, tag] = data.split(':');
        const { error } = await supabase.from('items').update({ tag }).eq('id', itemId);
        if (error) throw error;
        await tg.bot.answerCallbackQuery(id, { text: `Tagged as ${tag} ✅` });
      }
      return;
    }

    // ── Handle incoming messages ─────────────────────────────
    if (!update.message) return;
    const msg = update.message;
    const parsed = parseMessage(msg);

    // ── Ensure user exists in DB ─────────────────────────────
    let { data: user, error: userError } = await supabase
      .from('users').select('*').eq('telegram_chat_id', String(parsed.chatId)).single();

    if (userError && userError.code !== 'PGRST116') throw userError;

    if (!user) {
      const { data: newUser, error: insertError } = await supabase.from('users').insert({
        telegram_chat_id: String(parsed.chatId)
      }).select().single();
      if (insertError) throw insertError;
      user = newUser;
    }

    // ── Ignore empty messages ────────────────────────────────
    if (!parsed.content) return;

    // ── Suggest tag from Gemini ──────────────────────────────
    const suggestedTag = await gemini.suggestTag(parsed.content);

    // ── Generate embedding ───────────────────────────────────
    const embedding = await gemini.embed(parsed.content);

    // ── Similarity search ──────────────────────────────────────
    const { data: similar, error: rpcError } = await supabase.rpc('match_items', {
      query_embedding: embedding,
      match_threshold: 0.85,
      match_count: 1,
      p_user_id: user.id
    });

    if (rpcError) {
      console.warn("⚠️ Similarity search failed (check if match_items function exists):", rpcError.message);
    } else if (similar && similar.length > 0) {
      await tg.sendSimilarNudge(parsed.chatId, similar[0]);
    }

    // ── Save to database ─────────────────────────────────────
    const { data: item, error: saveError } = await supabase.from('items').insert({
      user_id: user.id,
      content: parsed.content,
      type: parsed.type,
      source_url: parsed.sourceUrl || null,
      tag: suggestedTag,
      status: 'inbox',
      embedding: embedding
    }).select().single();

    if (saveError) throw saveError;

    // ── Send tag confirmation with buttons ───────────────────
    await tg.sendTagPrompt(parsed.chatId, item.id, suggestedTag);

  } catch (err) {
    console.error("❌ Telegram Webhook Error:", err.message);
    // Optionally notify the user via Telegram
    if (update.message?.chat?.id) {
      await tg.sendMessage(update.message.chat.id, "⚠️ Sorry, I encountered an error while saving your message.");
    }
  }
});

module.exports = router;