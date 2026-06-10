const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─────────────────────────────────────────────────────────────────
//  LOCAL FALLBACK  (works with zero Gemini quota)
// ─────────────────────────────────────────────────────────────────

function localAnalyze(content, messageType) {
  const text = content.trim();
  const lower = text.toLowerCase();

  // ── Search intent ─────────────────────────────────────────────
  if (/^(find|search|look|show|get|fetch|what|did i|do i have|have i|recall|remember)/i.test(lower) ||
      /saved?.*(about|related|on|for)\s+\w/i.test(lower)) {
    const query = text
      .replace(/^(find|search|look for|show me|get|recall|remember|did i save|do i have|have i saved?)\s*/i, '')
      .replace(/[?!.]+$/, '')
      .trim();
    return { action: 'search', search_query: query || text, reply: null, tag: 'other', remind_in_minutes: null, content_summary: null };
  }

  // ── Chat intent ───────────────────────────────────────────────
  if (/^(hi|hey|hello|what's up|sup|how are you|good morning|good evening|good night|who are you|what can you do|help|helo|hii|heloo)/i.test(lower)) {
    return { action: 'chat', reply: null, tag: 'other', remind_in_minutes: null, content_summary: null, search_query: null };
  }

  // ── Junk filter ───────────────────────────────────────────────
  const isJunk =
    text.length <= 2 ||
    /^[a-z]$/i.test(text) ||
    /^(ok|okay|k|test|lol|haha|yes|no|yep|nope|bye|thanks|thx|ty|np|sure|👍|🙏|❤️)$/i.test(text);

  if (isJunk) {
    return { action: 'ignore', tag: 'other', remind_in_minutes: null, reply: "That doesn't look like something worth saving 😊", content_summary: null, search_query: null };
  }

  // ── Reminder detection ────────────────────────────────────────
  const hasRemind = /remind/i.test(lower);
  let remindMinutes = null;

  if (hasRemind) {
    const inMin = lower.match(/in\s+(\d+)\s*min/i);
    if (inMin) remindMinutes = parseInt(inMin[1]);

    if (!remindMinutes) {
      const inHr = lower.match(/in\s+(\d+)\s*h(?:our|r)?s?/i);
      if (inHr) remindMinutes = parseInt(inHr[1]) * 60;
    }

    if (!remindMinutes) {
      const atTime = lower.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      if (atTime) {
        let h = parseInt(atTime[1]);
        const m = atTime[2] ? parseInt(atTime[2]) : 0;
        const ampm = atTime[3]?.toLowerCase();
        if (ampm === 'pm' && h < 12) h += 12;
        if (ampm === 'am' && h === 12) h = 0;
        const target = new Date();
        target.setHours(h, m, 0, 0);
        if (target <= new Date()) target.setDate(target.getDate() + 1);
        remindMinutes = Math.round((target - Date.now()) / 60000);
      }
    }

    if (!remindMinutes && /tomorrow/i.test(lower)) remindMinutes = 12 * 60;
    if (!remindMinutes) remindMinutes = 60;
  }

  // ── Tag classification ────────────────────────────────────────
  let tag = 'other';
  if (/https?:\/\//i.test(text)) tag = 'article';
  else if (/idea|think|should|could|maybe|what if/i.test(lower)) tag = 'idea';
  else if (/reel|video|watch|youtube|instagram/i.test(lower)) tag = 'reel';
  else if (/doc|document|file|pdf|report/i.test(lower)) tag = 'document';

  // ── Clean content ─────────────────────────────────────────────
  let cleanContent = text.replace(/,?\s*remind me.*/i, '').replace(/remind me.*/i, '').trim() || text;

  if (hasRemind && remindMinutes) {
    const remindAt = new Date(Date.now() + remindMinutes * 60000);
    const timeStr = remindAt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true, day: 'numeric', month: 'short'
    });
    return { action: 'save_and_remind', tag, remind_in_minutes: remindMinutes, reply: `✅ Saved!\n⏰ I'll remind you at *${timeStr}*`, content_summary: cleanContent, search_query: null };
  }

  return { action: 'save', tag, remind_in_minutes: null, reply: '✅ Saved to your Second Brain.', content_summary: cleanContent, search_query: null };
}

// ─────────────────────────────────────────────────────────────────
//  AI ANALYSIS  (primary — falls back to localAnalyze on failure)
// ─────────────────────────────────────────────────────────────────

/**
 * Analyze a message and return a structured decision object.
 * action: "save" | "save_and_remind" | "ignore" | "chat" | "search"
 */
async function analyzeMessage(content, messageType = 'text') {
  const now = new Date();
  const istNow = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

  const prompt = `You are a smart personal second-brain assistant bot. Analyze the user message and respond with ONLY valid JSON (no markdown, no backticks).

Current date/time (IST): ${istNow}
Message type: ${messageType}
User message: "${content}"

Respond with this exact JSON structure:
{
  "action": "save" | "save_and_remind" | "ignore" | "chat" | "search",
  "tag": "idea" | "reel" | "article" | "document" | "other",
  "remind_in_minutes": null | number,
  "search_query": null | "extracted search keywords",
  "reply": "your reply text",
  "content_summary": null | "cleaned content to save"
}

Action rules:
- "chat": Greetings (hi, hello, hey), casual conversation, questions about what you can do, emotional messages. Generate a warm, friendly reply.
- "search": User wants to FIND something from their saved items. Phrases: "find", "search", "show me", "did I save", "do I have", "what was that", "recall". Extract search_query from the message.
- "ignore": Junk — single characters, test messages. reply should be short and friendly.
- "save": Meaningful content to save (notes, links, ideas, photos with captions).
- "save_and_remind": User explicitly mentions "remind me", "remind", "later at X". Calculate remind_in_minutes from now.

For "chat": reply warmly. You are a personal second brain. Keep it short. content_summary=null, search_query=null.
For "search": search_query=extracted keywords, reply=null (code will fill search results), content_summary=null.
For "save"/"save_and_remind": content_summary=clean content without reminder phrasing.
For "ignore": reply=short friendly message, content_summary=null, search_query=null.`;

  const maxRetries = 2;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: prompt,
      });

      const text = response.text.trim();
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const result = JSON.parse(cleaned);

      const validActions = ['save', 'save_and_remind', 'ignore', 'chat', 'search'];
      if (!validActions.includes(result.action)) result.action = 'save';
      if (!['idea', 'reel', 'article', 'document', 'other'].includes(result.tag)) result.tag = 'other';
      if (result.action === 'save_and_remind' && (!result.remind_in_minutes || result.remind_in_minutes <= 0)) {
        result.remind_in_minutes = 60;
      }

      return result;
    } catch (error) {
      console.error(`Gemini analyzeMessage error (attempt ${i + 1}/${maxRetries}):`, error.message);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.warn('⚠️ Gemini unavailable, using local fallback analysis');
  return localAnalyze(content, messageType);
}

// ─────────────────────────────────────────────────────────────────
//  CHAT REPLY  — conversational response
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a friendly conversational reply.
 * Falls back to a canned response if Gemini is unavailable.
 */
async function chatReply(userMessage) {
  const SYSTEM = `You are a friendly, smart personal second-brain assistant on Telegram. 
Your user saves notes, ideas, links, and reminders through you.
Be warm, concise (1-3 sentences), use emojis naturally.
You can: save content, set reminders, and search past saves.
If asked what you can do, explain those three things briefly.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      config: { systemInstruction: SYSTEM },
      contents: userMessage,
    });
    return response.text.trim();
  } catch (err) {
    console.error('Gemini chatReply error:', err.message);
    // Local canned replies
    const lower = userMessage.toLowerCase();
    if (/hi|hello|hey|helo|hii/i.test(lower)) return "Hey! 👋 I'm your Second Brain. Send me anything to save it — ideas, links, notes. You can also say *remind me* to set a reminder, or *find [topic]* to search your saves!";
    if (/what can you do|help/i.test(lower)) return "I can:\n📥 *Save* — send me anything (text, links, photos) to store it\n⏰ *Remind* — add 'remind me at 6pm' to any message\n🔍 *Search* — say 'find my idea about X' to recall past saves";
    if (/how are you/i.test(lower)) return "Doing great! 🧠 Ready to save your thoughts. What's on your mind?";
    return "Hey! 😊 Send me something to save, or say *find [topic]* to search your Second Brain.";
  }
}

// ─────────────────────────────────────────────────────────────────
//  SEARCH & ANSWER  — find items and generate a reply
// ─────────────────────────────────────────────────────────────────

/**
 * Search saved items by keyword and generate a reply.
 * Uses text search (ilike) since vector search isn't active.
 */
async function searchAndReply(query, userId, supabase) {
  // Search items table with multiple keyword matches
  const keywords = query.split(/\s+/).filter(w => w.length > 2);
  let q = supabase
    .from('items')
    .select('id, content, tag, type, source_url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Build OR filter for all keywords
  if (keywords.length > 0) {
    const filters = keywords.map(k => `content.ilike.%${k}%`).join(',');
    q = q.or(filters);
  } else {
    q = q.ilike('content', `%${query}%`);
  }

  const { data: items, error } = await q;

  if (error) {
    console.error('Search error:', error.message);
    return "❌ Couldn't search right now. Try again?";
  }

  if (!items || items.length === 0) {
    return `🔍 Couldn't find anything about *${query}* in your Second Brain.\n\nTry different keywords?`;
  }

  // Format results
  let response = `🔍 Found *${items.length}* item${items.length > 1 ? 's' : ''} about *${query}*:\n\n`;
  items.forEach((item, i) => {
    const date = new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    const preview = item.content.length > 120 ? item.content.slice(0, 120) + '…' : item.content;
    const tagEmoji = { idea: '💡', reel: '🎬', article: '📰', document: '📄', other: '📌' }[item.tag] || '📌';
    response += `${i + 1}. ${tagEmoji} ${preview}`;
    if (item.source_url) response += `\n   🔗 ${item.source_url}`;
    response += `\n   _${date}_\n\n`;
  });

  return response.trim();
}

// ─────────────────────────────────────────────────────────────────
//  LEGACY HELPERS  (kept for compatibility)
// ─────────────────────────────────────────────────────────────────

async function suggestTag(content) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: `Classify this content with ONE tag from: idea, reel, article, document, other.\n\nContent: ${content}\n\nReply with just the tag word.`,
      });
      return response.text.trim().toLowerCase();
    } catch (error) {
      console.error(`Gemini suggestTag error (attempt ${i + 1}/${maxRetries}):`, error.message);
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 1500));
    }
  }
  return "other";
}

async function embed(text) {
  const response = await ai.models.embedContent({ model: "gemini-embedding-001", contents: text });
  return response.embeddings[0].values;
}

async function answerFromContext(question, contextItems, personalityProfile = {}) {
  const context = contextItems.map(i => i.content).join('\n---\n');
  const personality = personalityProfile.tone || 'helpful and direct';
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    config: { systemInstruction: `You are a personal second brain assistant. Tone: ${personality}. Answer based only on the context provided.` },
    contents: `Context:\n${context}\n\nQuestion: ${question}`,
  });
  return response.text;
}

module.exports = { analyzeMessage, chatReply, searchAndReply, suggestTag, embed, answerFromContext };
