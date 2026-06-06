# Second Brain

*Complete Build Guide*

Telegram Bot · Supabase · Claude AI · Next.js Dashboard

Node.js · pgvector · Railway · Vercel

v1.0 · June 2026

---

## Table of Contents

1. Overview
2. Phase 1 — Telegram Bot
3. Phase 2 — Vector Search + Reminders
4. Phase 3 — Web Dashboard (Next.js)
5. Phase 4 — Document Q&A (RAG)
6. Phase 5 — Personality + Focus Tracker
7. Quick Reference

---

## 1. Overview

This guide picks up exactly where you are — Node.js project, Supabase connected, items table created, POST /save working — and walks you through every remaining step with complete code. Follow the phases in order.

### 1.1 What you have already

- Node.js + Express server running on port 3000
- Supabase project with URL + secret key in .env
- items table: id, content, tag, type, source_url, created_at
- POST /save endpoint that inserts to Supabase
- GET /test endpoint that reads from Supabase

### 1.2 What you are building next

| Phase | What | Steps |
|-------|------|-------|
| 1 | Telegram bot | Bot setup, webhook, parser, Claude tagger, reply |
| 2 | Vector search + reminders | pgvector, embeddings, similarity, cron nudges |
| 3 | Web dashboard | Next.js, Supabase Auth, inbox, AI chat |
| 4 | Document Q&A | Upload, RAG pipeline, answer from docs |
| 5 | Personality + Focus Tracker | Onboarding, thread detection, drift cron |

---

## 2. Phase 1 — Telegram Bot

### Step 1: Create your Telegram bot

BotFather → token → .env

Open Telegram, search for @BotFather, and run these commands:

```
/newbot

# BotFather will ask:
# 1. Name: Second Brain
# 2. Username: second_brain_yourname_bot
# Then it gives you a token like:
# 123456789:ABCdef-ghijk...
```

Add the token to your .env file:

**`.env`**

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=eyJ...
TELEGRAM_TOKEN=123456789:ABCdef-ghijk...
CLAUDE_API_KEY=sk-ant-...
PORT=3000
```

> Get your Claude API key from console.anthropic.com → API Keys. The free tier gives you enough to start.

### Step 2: Install Telegram + Claude packages

```bash
npm install node-telegram-bot-api @anthropic-ai/sdk
```

### Step 3: Update your database schema

New columns + users table

Your current items table is missing critical columns. Run this SQL in the Supabase Dashboard → SQL Editor:

**Supabase SQL Editor**

```sql
-- 1. Add missing columns to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE items ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inbox';
ALTER TABLE items ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

-- 2. Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id TEXT UNIQUE,
  personality_profile JSONB DEFAULT '{}',
  onboarding_done BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create reminders table (for Phase 2)
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  item_id UUID REFERENCES items(id),
  remind_at TIMESTAMPTZ,
  sent BOOLEAN DEFAULT FALSE,
  message TEXT
);

-- 4. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 4: Update project structure

Add new files

Your final structure for Phase 1:

```
Second-Brain/
├── src/
│   ├── routes/
│   │   ├── telegram.js (new ← Telegram webhook handler)
│   │   └── save.js (existing)
│   ├── services/
│   │   ├── supabase.js (existing)
│   │   ├── telegram.js (new ← bot instance + send helpers)
│   │   └── claude.js (new ← Claude API calls)
│   ├── utils/
│   │   └── parser.js (new ← detect message type)
│   └── server.js (update ← register Telegram route)
├── .env
└── package.json
```

### Step 5: Create the Claude service

AI tagging + embeddings

**`src/services/claude.js`**

```javascript
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

// Suggest a tag for any piece of content
async function suggestTag(content) {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: `Classify this content with ONE tag from: idea, reel, article, document, other.\n\nContent: ${content}\n\nReply with just the tag word.`
    }]
  });
  return message.content[0].text.trim().toLowerCase();
}

// Generate an embedding vector for similarity search
async function embed(text) {
  const response = await client.beta.embeddings.create({
    model: 'voyage-3',
    input: text,
  });
  return response.data[0].embedding;
}

// Answer a question using saved items as context
async function answerFromContext(question, contextItems, personalityProfile = {}) {
  const context = contextItems.map(i => i.content).join('\n---\n');
  const personality = personalityProfile.tone || 'helpful and direct';
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: `You are a personal second brain assistant. Tone: ${personality}. Answer based only on the context provided.`,
    messages: [{
      role: 'user',
      content: `Context:\n${context}\n\nQuestion: ${question}`
    }]
  });
  return message.content[0].text;
}

module.exports = { suggestTag, embed, answerFromContext };
```

### Step 6: Create the message parser

Detect content type from Telegram

**`src/utils/parser.js`**

```javascript
// Detect what type of message was sent
function parseMessage(msg) {
  const chatId = msg.chat.id;
  const result = { chatId, type: 'text', content: '', fileId: null };

  if (msg.document) {
    result.type = 'doc';
    result.content = msg.document.file_name || 'Uploaded document';
    result.fileId = msg.document.file_id;
  } else if (msg.voice || msg.audio) {
    result.type = 'voice';
    result.content = 'Voice note';
    result.fileId = (msg.voice || msg.audio).file_id;
  } else if (msg.photo) {
    result.type = 'image';
    result.content = msg.caption || 'Image';
    result.fileId = msg.photo[msg.photo.length - 1].file_id;
  } else if (msg.text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = msg.text.match(urlRegex);
    if (urls) {
      result.type = 'url';
      result.content = msg.text;
      result.sourceUrl = urls[0];
    } else {
      result.type = 'text';
      result.content = msg.text;
    }
  }

  return result;
}

module.exports = { parseMessage };
```

### Step 7: Create the Telegram service

Bot instance + send helpers

**`src/services/telegram.js`**

```javascript
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: false });

// Send a simple text message
async function sendMessage(chatId, text) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

// Send save confirmation with tag buttons
async function sendTagPrompt(chatId, itemId, suggestedTag) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '💡 idea', callback_data: `tag:${itemId}:idea` },
        { text: '🎬 reel', callback_data: `tag:${itemId}:reel` },
        { text: '📝 article', callback_data: `tag:${itemId}:article` },
      ],
      [
        { text: '📄 doc', callback_data: `tag:${itemId}:document` },
        { text: '✨ other', callback_data: `tag:${itemId}:other` },
      ]
    ]
  };

  const text = `✅ Saved! AI suggests: *${suggestedTag}*\n\nConfirm or change tag:`;
  return bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

// Send a similarity nudge
async function sendSimilarNudge(chatId, similarItem) {
  const text = `🔄 You saved something similar before:\n\n_${similarItem.content.slice(0, 150)}..._\n\nStill relevant?`;
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

module.exports = { bot, sendMessage, sendTagPrompt, sendSimilarNudge };
```

### Step 8: Create the Telegram webhook route

Core message handler

**`src/routes/telegram.js`**

```javascript
const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const claude = require('../services/claude');
const tg = require('../services/telegram');
const { parseMessage } = require('../utils/parser');

// ── Webhook endpoint ──────────────────────────────────────
router.post('/', async (req, res) => {
  res.sendStatus(200); // always ack first, process async
  const update = req.body;

  // ── Handle button taps (tag confirmation) ──────────────
  if (update.callback_query) {
    const { id, data, from, message } = update.callback_query;
    if (data.startsWith('tag:')) {
      const [, itemId, tag] = data.split(':');
      await supabase.from('items').update({ tag }).eq('id', itemId);
      await tg.bot.answerCallbackQuery(id, { text: `Tagged as ${tag} ✅` });
    }
    return;
  }

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

  // ── Suggest tag from Claude ──────────────────────────────
  const suggestedTag = await claude.suggestTag(parsed.content);

  // ── Save to database ─────────────────────────────────────
  const { data: item } = await supabase.from('items').insert({
    user_id: user.id,
    content: parsed.content,
    type: parsed.type,
    source_url: parsed.sourceUrl || null,
    tag: suggestedTag,
    status: 'inbox'
  }).select().single();

  // ── Send tag confirmation with buttons ───────────────────
  await tg.sendTagPrompt(parsed.chatId, item.id, suggestedTag);
});

module.exports = router;
```

### Step 9: Update server.js

Register Telegram route + webhook

**`src/server.js`**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/telegram', require('./routes/telegram'));
app.use('/save', require('./routes/save'));

// Test
app.get('/', (req, res) => res.send('Second Brain Running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));

// Register webhook with Telegram once deployed
// PUT THIS IN A ONE-TIME SETUP SCRIPT (setup-webhook.js):
// const bot = require('./services/telegram').bot;
// bot.setWebHook(`https://your-railway-url.com/telegram`);
```

### Step 10: Deploy to Railway + register webhook

Go live

1. Push your code to GitHub.
2. Create a new Railway project from your repo.
3. Add all your .env variables in Railway → Variables tab.
4. Once deployed, run the webhook registration once:

**`setup-webhook.js` (run once: `node setup-webhook.js`)**

```javascript
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

const url = `https://YOUR-RAILWAY-URL.up.railway.app/telegram`;

bot.setWebHook(url).then(() => {
  console.log('Webhook set to:', url);
  process.exit();
});
```

> Test by sending any message to your bot on Telegram. It should reply with 'Saved ✓' and tag buttons within 2 seconds.

---

## 3. Phase 2 — Vector Search + Reminders

### Step 11: Add similarity search

pgvector + embeddings on save

Update `src/routes/telegram.js` to embed and search before saving:

**`src/routes/telegram.js` (add inside the message handler, before saving)**

```javascript
// ── Generate embedding ───────────────────────────────────
const embedding = await claude.embed(parsed.content);

// ── Similarity search ──────────────────────────────────────
const { data: similar } = await supabase.rpc('match_items', {
  query_embedding: embedding,
  match_threshold: 0.85,
  match_count: 1,
  p_user_id: user.id
});

if (similar && similar.length > 0) {
  await tg.sendSimilarNudge(parsed.chatId, similar[0]);
}

// ── Save WITH embedding ──────────────────────────────────
const { data: item } = await supabase.from('items').insert({
  user_id: user.id, content: parsed.content,
  type: parsed.type, source_url: parsed.sourceUrl || null,
  tag: suggestedTag, status: 'inbox', embedding
}).select().single();
```

Create the Supabase function for vector search. Run this SQL in Supabase SQL Editor:

**Supabase SQL Editor**

```sql
CREATE OR REPLACE FUNCTION match_items(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT,
  p_user_id UUID
) RETURNS TABLE(id UUID, content TEXT, similarity FLOAT) AS $$
  SELECT id, content,
    1 - (embedding <=> query_embedding) AS similarity
  FROM items
  WHERE user_id = p_user_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
```

### Step 12: Build the reminder system

Cron job + Telegram nudges

**`src/services/reminders.js`**

```javascript
const cron = require('node-cron');
const supabase = require('./supabase');
const tg = require('./telegram');

// Run every 5 minutes, check for due reminders
cron.schedule('*/5 * * * *', async () => {
  const now = new Date().toISOString();
  const { data: due } = await supabase
    .from('reminders')
    .select('*, items(*), users(telegram_chat_id)')
    .eq('sent', false)
    .lte('remind_at', now);

  for (const reminder of (due || [])) {
    const chatId = reminder.users.telegram_chat_id;
    const item = reminder.items;
    const text = `🔔 Reminder: _${item.content.slice(0,120)}_\n\nDid you act on this?`;
    await tg.sendMessage(chatId, text);
    await supabase.from('reminders').update({ sent: true }).eq('id', reminder.id);
  }
});

console.log('Reminder cron started');
```

Add one line to `server.js` to start the cron:

```javascript
// At the bottom of server.js
require('./services/reminders'); // starts the cron job
```

> Install node-cron first: `npm install node-cron`

---

## 4. Phase 3 — Web Dashboard (Next.js)

### Step 13: Create the Next.js app

In a separate folder

```bash
npx create-next-app@latest second-brain-web
# Options: TypeScript? No / ESLint? Yes / Tailwind? Yes / App Router? Yes

cd second-brain-web
npm install @supabase/supabase-js @supabase/ssr
```

**`second-brain-web/.env.local`**

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...
CLAUDE_API_KEY=sk-ant-...
```

### Step 14: Supabase client helpers

Used across all pages

**`second-brain-web/lib/supabase.js`**

```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Server-side client (uses secret key)
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY
  );
}
```

### Step 15: Inbox page

Display all your saves

**`second-brain-web/app/page.jsx`**

```jsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      let q = supabase.from('items').select('*').order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('tag', filter);
      if (search) q = q.ilike('content', `%${search}%`);
      const { data } = await q;
      setItems(data || []);
    }
    load();
  }, [filter, search]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Second Brain</h1>
      <input placeholder="Search..." value={search}
        onChange={e => setSearch(e.target.value)}
        className="border p-2 rounded w-full mb-4"/>
      <div className="flex gap-2 mb-6">
        {['all','idea','reel','article','document'].map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded ${filter===t?'bg-teal-600 text-white':'bg-gray-100'}`}>{t}</button>
        ))}
      </div>
      {items.map(item => (
        <div key={item.id} className="border rounded p-4 mb-3">
          <span className="text-xs bg-teal-100 text-teal-800 px-2 py-0.5 rounded">{item.tag}</span>
          <p className="mt-2">{item.content}</p>
          <p className="text-xs text-gray-400 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
}
```

### Step 16: AI Chat API route

Ask questions from your saves

**`second-brain-web/app/api/chat/route.js`**

```javascript
import { supabaseAdmin } from '../../../lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request) {
  const { question } = await request.json();
  const db = supabaseAdmin();
  const { data: items } = await db
    .from('items').select('content, tag')
    .order('created_at', { ascending: false }).limit(30);

  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  const context = items.map(i => `[${i.tag}] ${i.content}`).join('\n');

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6', max_tokens: 500,
    system: 'You are a personal second brain assistant. Answer from the saved items context.',
    messages: [{ role: 'user', content: `Saves:\n${context}\n\nQ: ${question}` }]
  });

  return Response.json({ answer: msg.content[0].text });
}
```

> Deploy the Next.js app on Vercel: connect your GitHub repo, add the .env.local variables in Vercel → Environment Variables, and deploy.

---

## 5. Phase 4 — Document Q&A (RAG)

### Step 17: Create document tables

SQL in Supabase

**Supabase SQL Editor**

```sql
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT,
  embedding VECTOR(1536),
  chunk_index INT
);
```

### Step 18: Document upload + chunk + embed

Full RAG pipeline

Install the PDF parser:

```bash
npm install pdf-parse multer
```

**`src/services/rag.js`**

```javascript
const pdfParse = require('pdf-parse');
const supabase = require('./supabase');
const claude = require('./claude');

// Split text into overlapping 512-token chunks
function chunkText(text, size = 512, overlap = 64) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += (size - overlap)) {
    chunks.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  return chunks;
}

// Process uploaded PDF buffer
async function processDocument(buffer, fileName, userId) {
  const parsed = await pdfParse(buffer);
  const chunks = chunkText(parsed.text);
  const { data: doc } = await supabase.from('documents').insert({
    user_id: userId, name: fileName
  }).select().single();

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await claude.embed(chunks[i]);
    await supabase.from('document_chunks').insert({
      doc_id: doc.id, chunk_text: chunks[i], embedding, chunk_index: i
    });
  }
  return doc;
}

// Answer a question from document chunks
async function askDocument(question, userId) {
  const qEmbedding = await claude.embed(question);
  const { data: chunks } = await supabase.rpc('match_chunks', {
    query_embedding: qEmbedding, match_count: 5, p_user_id: userId
  });
  const context = (chunks || []).map(c => c.chunk_text).join('\n\n');
  const answer = await claude.answerFromContext(question, [{ content: context }]);
  return answer;
}

module.exports = { processDocument, askDocument };
```

Add the `match_chunks` function in Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding VECTOR(1536),
  match_count INT,
  p_user_id UUID
) RETURNS TABLE(chunk_text TEXT, similarity FLOAT) AS $$
  SELECT dc.chunk_text, 1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.doc_id
  WHERE d.user_id = p_user_id
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE sql STABLE;
```

---

## 6. Phase 5 — Personality + Focus Tracker

### Step 19: Personality onboarding on Telegram

Collect tone + interests on /start

Add this to `src/routes/telegram.js` inside the message handler:

**`src/routes/telegram.js` (add at top of message handler)**

```javascript
// ── Handle /start command ────────────────────────────────
if (msg.text === '/start') {
  if (!user.onboarding_done) {
    await tg.sendMessage(parsed.chatId,
      `Welcome to Second Brain! 🧠\n\nA few quick questions to personalise your AI.\n\n1. How do you prefer responses?`
    );
    await tg.bot.sendMessage(parsed.chatId, 'Pick your style:', {
      reply_markup: { inline_keyboard: [[
        { text: 'Short & punchy', callback_data: 'onboard:tone:casual' },
        { text: 'Detailed & thorough', callback_data: 'onboard:tone:detailed' },
      ]] }
    });
  } else {
    await tg.sendMessage(parsed.chatId, `You're back! Send me anything to save. 💾`);
  }
  return;
}

// ── Handle onboarding callback ───────────────────────────
if (update.callback_query?.data.startsWith('onboard:')) {
  const [, key, value] = update.callback_query.data.split(':');
  const profile = user.personality_profile || {};
  profile[key] = value;
  await supabase.from('users').update({
    personality_profile: profile, onboarding_done: true
  }).eq('id', user.id);
  await tg.sendMessage(parsed.chatId, `✅ Got it! I'll respond in a ${value} style.\n\nStart sending things to save!`);
  return;
}
```

### Step 20: Focus Tracker — thread detection

Create threads table + clustering

**Supabase SQL Editor**

```sql
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  status TEXT DEFAULT 'active',
  drift_threshold_days INT DEFAULT 5,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thread_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  added_at TIMESTAMPTZ DEFAULT NOW()
);
```

**`src/services/focusTracker.js`**

```javascript
const cron = require('node-cron');
const supabase = require('./supabase');
const claude = require('./claude');
const tg = require('./telegram');

// Called after every new save
async function checkAndCluster(item, userId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: recent } = await supabase.rpc('match_items', {
    query_embedding: item.embedding,
    match_threshold: 0.80,
    match_count: 5,
    p_user_id: userId
  });

  if (!recent || recent.length < 2) return;

  // Check if a thread already exists for this cluster
  const existingIds = recent.map(r => r.id);
  const { data: existing } = await supabase
    .from('thread_items').select('thread_id')
    .in('item_id', existingIds).limit(1);

  if (existing && existing.length > 0) {
    const threadId = existing[0].thread_id;
    await supabase.from('thread_items').insert({ thread_id: threadId, item_id: item.id });
    await supabase.from('threads').update({ last_active_at: new Date().toISOString() }).eq('id', threadId);
  } else {
    const name = await nameThread(recent.map(r => r.content));
    const { data: thread } = await supabase.from('threads').insert({
      user_id: userId, name, status: 'active'
    }).select().single();
    await supabase.from('thread_items').insert([
      ...recent.map(r => ({ thread_id: thread.id, item_id: r.id })),
      { thread_id: thread.id, item_id: item.id }
    ]);
    return { newThread: true, name };
  }
}

async function nameThread(contents) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 20,
    messages: [{ role: 'user', content: `Name this thought thread in 5 words max:\n${contents.join('\n')}` }]
  });
  return msg.content[0].text.trim();
}

// Daily drift detection cron
cron.schedule('0 9 * * *', async () => { // 9am daily
  const { data: threads } = await supabase
    .from('threads').select('*, users(telegram_chat_id)')
    .eq('status','active');

  for (const thread of (threads || [])) {
    const days = (Date.now() - new Date(thread.last_active_at).getTime()) / (1000 * 3600 * 24);
    if (days >= thread.drift_threshold_days) {
      const chatId = thread.users.telegram_chat_id;
      await tg.bot.sendMessage(chatId,
        `⏳ You haven't added to *${thread.name}* in ${Math.floor(days)} days. Still on it?`,
        { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[
          { text: '✅ Still on it', callback_data: `drift:${thread.id}:active` },
          { text: '⏸️ Paused', callback_data: `drift:${thread.id}:paused` },
          { text: '🗑️ Drop it', callback_data: `drift:${thread.id}:dropped` },
        ]] } }
      );
      await supabase.from('threads').update({ status: 'drifting' }).eq('id', thread.id);
    }
  }
});

module.exports = { checkAndCluster };
```

> Add `require('./services/focusTracker')` at the bottom of `server.js` to start the drift detection cron alongside the reminder cron.

---

## 7. Quick Reference

### All environment variables

| Variable | Where to get it | Used in |
|----------|-----------------|---------|
| TELEGRAM_TOKEN | @BotFather on Telegram | Bot server |
| CLAUDE_API_KEY | console.anthropic.com | Claude calls |
| SUPABASE_URL | Supabase → Settings → API | DB + storage |
| SUPABASE_SECRET_KEY | Supabase → Settings → API | Server-side only |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase → Settings → API | Frontend (safe) |

### npm packages — backend

| Package | Purpose |
|---------|---------|
| express | HTTP server + routing |
| dotenv | Load .env variables |
| cors | Allow cross-origin requests from dashboard |
| @supabase/supabase-js | Supabase DB + storage client |
| node-telegram-bot-api | Telegram Bot API client |
| @anthropic-ai/sdk | Claude AI API client |
| node-cron | Cron jobs for reminders + drift detection |
| pdf-parse | Extract text from PDF uploads |
| multer | Handle multipart file uploads |

### Supabase SQL functions to create

| Function | What it does |
|----------|--------------|
| `match_items(...)` | Vector similarity search on items table (Phase 2) |
| `match_chunks(...)` | Vector similarity search on document_chunks (Phase 4) |

---

*End of guide*
