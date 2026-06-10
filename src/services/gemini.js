const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Smart local fallback — works without Gemini.
 * Handles junk filtering, reminder parsing, and basic tag classification.
 */
function localAnalyze(content, messageType) {
  const text = content.trim();
  const lower = text.toLowerCase();

  // ── Junk filter ───────────────────────────────────────────
  const isJunk =
    text.length <= 2 ||
    /^[a-z]$/i.test(text) ||
    /^(hi|hey|hello|ok|okay|k|test|lol|haha|yes|no|yep|nope|bye|thanks|thx|ty|np|sure|👍|🙏|❤️)$/i.test(text);

  if (isJunk) {
    return {
      action: 'ignore',
      tag: 'other',
      remind_in_minutes: null,
      reply: "That doesn't look like something worth saving 😊",
      content_summary: null
    };
  }

  // ── Reminder detection ────────────────────────────────────
  const hasRemind = /remind/i.test(lower);
  let remindMinutes = null;

  if (hasRemind) {
    // "in X min/minutes/mins"
    const inMin = lower.match(/in\s+(\d+)\s*min/i);
    if (inMin) remindMinutes = parseInt(inMin[1]);

    // "in X hour/hours/hr"
    if (!remindMinutes) {
      const inHr = lower.match(/in\s+(\d+)\s*h(?:our|r)?s?/i);
      if (inHr) remindMinutes = parseInt(inHr[1]) * 60;
    }

    // "at Xpm/Xam/X:00"
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

    // "tomorrow"
    if (!remindMinutes && /tomorrow/i.test(lower)) {
      remindMinutes = 12 * 60; // ~12 hours
    }

    if (!remindMinutes) remindMinutes = 60; // default 1h if "remind" mentioned
  }

  // ── Tag classification ────────────────────────────────────
  let tag = 'other';
  if (/https?:\/\//i.test(text)) tag = 'article';
  else if (/idea|think|should|could|maybe|what if/i.test(lower)) tag = 'idea';
  else if (/reel|video|watch|youtube|instagram/i.test(lower)) tag = 'reel';
  else if (/doc|document|file|pdf|report/i.test(lower)) tag = 'document';

  // ── Clean content ─────────────────────────────────────────
  let cleanContent = text
    .replace(/,?\s*remind me.*/i, '')
    .replace(/remind me.*/i, '')
    .trim()
    || text;

  if (hasRemind && remindMinutes) {
    const remindAt = new Date(Date.now() + remindMinutes * 60000);
    const timeStr = remindAt.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit',
      hour12: true, day: 'numeric', month: 'short'
    });
    return {
      action: 'save_and_remind',
      tag,
      remind_in_minutes: remindMinutes,
      reply: `✅ Saved!\n⏰ I'll remind you at *${timeStr}*`,
      content_summary: cleanContent
    };
  }

  return {
    action: 'save',
    tag,
    remind_in_minutes: null,
    reply: '✅ Saved to your Second Brain.',
    content_summary: cleanContent
  };
}

/**
 * Analyze a message with AI to determine intent, tag, reminder, and reply.
 * Falls back to local smart analysis if Gemini is unavailable.
 */
async function analyzeMessage(content, messageType = 'text') {
  const now = new Date();
  const istNow = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

  const prompt = `You are a smart personal second-brain assistant. Analyze the user's message and respond with ONLY valid JSON (no markdown, no backticks).

Current date/time (IST): ${istNow}
Message type: ${messageType}
User message: "${content}"

Respond with this exact JSON structure:
{
  "action": "save" or "save_and_remind" or "ignore",
  "tag": "idea" or "reel" or "article" or "document" or "other",
  "remind_in_minutes": null or number_of_minutes_from_now,
  "reply": "your friendly reply to the user",
  "content_summary": "cleaned up version of what to save"
}

Rules:
- "ignore": Use for junk, single characters, greetings like "hi", "hello", "ok", test messages, or anything not worth saving.
- "save": Use for meaningful content worth saving (ideas, links, notes, images with captions).
- "save_and_remind": Use when the user says things like "remind me", "later", "remind at", "in 1 hour", etc. Calculate remind_in_minutes from now.
- "tag": Classify the content. "idea" for thoughts/plans, "reel" for video/media, "article" for reading material, "document" for files, "other" for everything else.
- "reply": Keep it short, warm, use emojis. If reminding, mention the time. If ignoring, be friendly.
- "content_summary": Extract the meaningful part. Remove "remind me" phrasing, keep the actual content.
- For "ignore", set content_summary to null and remind_in_minutes to null.`;

  const maxRetries = 2;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: prompt,
      });

      const text = response.text.trim();
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const result = JSON.parse(cleaned);

      // Validate required fields
      if (!result.action || !['save', 'save_and_remind', 'ignore'].includes(result.action)) {
        result.action = 'save';
      }
      if (!result.tag || !['idea', 'reel', 'article', 'document', 'other'].includes(result.tag)) {
        result.tag = 'other';
      }
      if (result.action === 'save_and_remind' && (!result.remind_in_minutes || result.remind_in_minutes <= 0)) {
        result.remind_in_minutes = 60; // Default 1 hour
      }

      return result;
    } catch (error) {
      console.error(`Gemini analyzeMessage error (attempt ${i + 1}/${maxRetries}):`, error.message);
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  }

  // Fallback: use local smart analysis if Gemini fails
  console.warn('⚠️ Gemini unavailable, using local fallback analysis');
  return localAnalyze(content, messageType);
}

// Suggest a tag for any piece of content (with retry and error fallback)
async function suggestTag(content) {
  const maxRetries = 3;
  const delayMs = 1500;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: `Classify this content with ONE tag from: idea, reel, article, document, other.\n\nContent: ${content}\n\nReply with just the tag word.`,
      });
      return response.text.trim().toLowerCase();
    } catch (error) {
      console.error(`Gemini suggestTag error (attempt ${i + 1}/${maxRetries}):`, error.message);
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // Fallback if all attempts fail
  return "other";
}

// Generate an embedding vector for similarity search
async function embed(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  return response.embeddings[0].values;
}

// Answer a question using saved items as context
async function answerFromContext(question, contextItems, personalityProfile = {}) {
  const context = contextItems.map(i => i.content).join('\n---\n');
  const personality = personalityProfile.tone || 'helpful and direct';
  
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    config: {
      systemInstruction: `You are a personal second brain assistant. Tone: ${personality}. Answer based only on the context provided.`,
    },
    contents: `Context:\n${context}\n\nQuestion: ${question}`,
  });
  return response.text;
}

module.exports = { analyzeMessage, suggestTag, embed, answerFromContext };

