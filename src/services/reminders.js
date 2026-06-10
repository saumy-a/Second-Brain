const cron = require('node-cron');
const supabase = require('./supabase');
const tg = require('./telegram');

// Run every 5 minutes, check for due reminders
cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date().toISOString();
    
    // Fetch due reminders with related item and user data
    const { data: due, error } = await supabase
      .from('reminders')
      .select(`
        *,
        items (content),
        users (telegram_chat_id)
      `)
      .eq('sent', false)
      .lte('remind_at', now);

    if (error) {
      console.error('❌ Error fetching due reminders:', error.message);
      return;
    }

    if (!due || due.length === 0) return;

    console.log(`🔔 Found ${due.length} due reminders. Processing...`);

    for (const reminder of due) {
      const chatId = reminder.users?.telegram_chat_id;
      const content = reminder.items?.content || 'No content found';
      const customMessage = reminder.message || 'Did you act on this?';

      if (!chatId) {
        console.warn(`⚠️ Skipping reminder ${reminder.id}: No telegram_chat_id found.`);
        continue;
      }

      const text = `🔔 *Reminder*\n\n_${content.slice(0, 150)}${content.length > 150 ? '...' : ''}_\n\n${customMessage}`;
      
      try {
        await tg.sendMessage(chatId, text);
        
        // Mark as sent
        const { error: updateError } = await supabase
          .from('reminders')
          .update({ sent: true })
          .eq('id', reminder.id);

        if (updateError) {
          console.error(`❌ Error marking reminder ${reminder.id} as sent:`, updateError.message);
        }
      } catch (tgError) {
        console.error(`❌ Failed to send Telegram reminder ${reminder.id}:`, tgError.message);
      }
    }
  } catch (globalError) {
    console.error('❌ Global Reminder Cron Error:', globalError.message);
  }
});

console.log('✅ Reminder cron job initialized.');
