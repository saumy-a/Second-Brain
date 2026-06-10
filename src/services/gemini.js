const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Analyze a message with AI to determine intent, tag, reminder, and reply.
 * Returns structured JSON with all decisions in one call.
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

  // Fallback: save everything if AI fails
  return {
    action: 'save',
    tag: 'other',
    remind_in_minutes: null,
    reply: '✅ Saved to your Second Brain.',
    content_summary: content
  };
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

