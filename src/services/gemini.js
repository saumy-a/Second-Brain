const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Suggest a tag for any piece of content (with retry and error fallback)
async function suggestTag(content) {
  const maxRetries = 3;
  const delayMs = 1500;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
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
    model: "text-embedding-004",
    contents: text,
    config: {
      outputDimensionality: 1536
    }
  });
  return response.embeddings[0].values;
}

// Answer a question using saved items as context
async function answerFromContext(question, contextItems, personalityProfile = {}) {
  const context = contextItems.map(i => i.content).join('\n---\n');
  const personality = personalityProfile.tone || 'helpful and direct';
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: `You are a personal second brain assistant. Tone: ${personality}. Answer based only on the context provided.`
    },
    contents: `Context:\n${context}\n\nQuestion: ${question}`
  });
  
  return response.text;
}

module.exports = { suggestTag, embed, answerFromContext };
