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
      const { id, data } = update.callback_query;
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

    // ── AI Analysis — decides what to do ─────────────────────
    const analysis = await gemini.analyzeMessage(parsed.content, parsed.type);
    console.log('🧠 AI Analysis:', JSON.stringify(analysis));

    // ════════════════════════════════════════════════════════
    //  CHAT — friendly conversational reply
    // ════════════════════════════════════════════════════════
    if (analysis.action === 'chat') {
      const reply = analysis.reply || await gemini.chatReply(parsed.content);
      await tg.sendMessage(parsed.chatId, reply);
      return;
    }

    // ════════════════════════════════════════════════════════
    //  SEARCH — find saved items and reply with results
    // ════════════════════════════════════════════════════════
    if (analysis.action === 'search') {
      const query = analysis.search_query || parsed.content;
      const reply = await gemini.searchAndReply(query, user.id, supabase);
      await tg.sendMessage(parsed.chatId, reply);
      return;
    }

    // ════════════════════════════════════════════════════════
    //  IGNORE — junk message, reply but don't save
    // ════════════════════════════════════════════════════════
    if (analysis.action === 'ignore') {
      await tg.sendMessage(parsed.chatId, analysis.reply);
      return;
    }

    // ════════════════════════════════════════════════════════
    //  SAVE  (+ optional reminder)
    // ════════════════════════════════════════════════════════
    const { data: item, error: saveError } = await supabase.from('items').insert({
      user_id: user.id,
      content: analysis.content_summary || parsed.content,
      type: parsed.type,
      source_url: parsed.sourceUrl || null,
      tag: analysis.tag,
      status: 'inbox',
      embedding: null
    }).select().single();

    if (saveError) throw saveError;

    // ── Reminder? ────────────────────────────────────────────
    if (analysis.action === 'save_and_remind' && analysis.remind_in_minutes) {
      const remindAt = new Date(Date.now() + analysis.remind_in_minutes * 60 * 1000);

      const { error: reminderError } = await supabase.from('reminders').insert({
        user_id: user.id,
        item_id: item.id,
        remind_at: remindAt.toISOString(),
        message: 'Time to act on this! ⚡',
        sent: false
      });

      if (reminderError) {
        console.error('❌ Error saving reminder:', reminderError.message);
        await tg.sendMessage(parsed.chatId, `✅ Saved!\n⚠️ But I couldn't set the reminder.`);
      } else {
        await tg.sendMessage(parsed.chatId, analysis.reply);
      }
    } else {
      await tg.sendMessage(parsed.chatId, analysis.reply || '✅ Saved to your Second Brain.');
    }

  } catch (err) {
    console.error("❌ Telegram Webhook Error:", err.message, err.stack);
    if (update.message?.chat?.id) {
      await tg.sendMessage(update.message.chat.id, "⚠️ Something went wrong. Please try again.");
    }
  }
});

module.exports = router;