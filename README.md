# 🧠 Second Brain

> A personal AI-powered knowledge management system — save notes, links, ideas, and reminders through Telegram, and recall them instantly.

---

## ✨ What It Does

Second Brain is a Telegram bot backed by a Node.js/Express server that uses **Google Gemini AI** to intelligently classify and store anything you send it. Think of it as your external memory:

- 📥 **Save** — Send text, links, ideas, or photos; the bot auto-tags and stores them in Supabase.
- ⏰ **Remind** — Add *"remind me at 6pm"* to any message and get a Telegram notification at the right time.
- 🔍 **Search** — Say *"find my idea about X"* and the bot searches your saved items and replies with results.
- 💬 **Chat** — Greet the bot, ask what it can do, or just have a conversation.

---

## 🏗️ Architecture

```
Second Brain
├── src/                    # Node.js / Express backend
│   ├── server.js           # Express app entry point
│   ├── routes/
│   │   ├── telegram.js     # Telegram webhook handler (core logic)
│   │   ├── save.js         # REST save endpoint
│   │   ├── search.js       # REST search endpoint
│   │   └── test.js         # Debug: list all items
│   ├── services/
│   │   ├── gemini.js       # Google Gemini AI (analysis, chat, search)
│   │   ├── supabase.js     # Supabase client
│   │   ├── telegram.js     # Telegram bot client (node-telegram-bot-api)
│   │   └── reminders.js    # Background cron for scheduled reminders
│   └── utils/
│       ├── index.js        # General helpers
│       └── parser.js       # Telegram message parser
│
└── second-brain-web/       # Next.js dashboard (web frontend)
    └── src/app/
        └── api/items/      # API route to read saved items
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express v5 |
| AI | Google Gemini 2.0 Flash Lite (`@google/genai`) |
| Database | Supabase (PostgreSQL) |
| Bot | Telegram Webhook (`node-telegram-bot-api`) |
| Scheduler | `node-cron` (background reminders) |
| Frontend | Next.js 14 (web dashboard) |
| Dev | Nodemon |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema below
- A Telegram bot token (from [@BotFather](https://t.me/BotFather))
- A [Google AI Studio](https://aistudio.google.com) API key for Gemini

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/Second-Brain.git
cd Second-Brain
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...

# Telegram
TELEGRAM_TOKEN=<your-bot-token>

# Google Gemini
GEMINI_API_KEY=<your-gemini-api-key>
```

> ⚠️ **Never commit `.env` to version control.** It is already listed in `.gitignore`.

### 3. Set Up the Database

Run the following SQL in your Supabase SQL editor:

```sql
-- Users table
create table users (
  id uuid primary key default gen_random_uuid(),
  telegram_chat_id text unique not null,
  created_at timestamptz default now()
);

-- Items table
create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  content text not null,
  type text default 'text',        -- 'text' | 'photo' | 'link'
  tag text default 'other',        -- 'idea' | 'reel' | 'article' | 'document' | 'other'
  status text default 'inbox',
  source_url text,
  embedding vector(768),           -- optional, for semantic search
  created_at timestamptz default now()
);

-- Reminders table
create table reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  item_id uuid references items(id) on delete cascade,
  remind_at timestamptz not null,
  message text,
  sent boolean default false,
  created_at timestamptz default now()
);
```

### 4. Register Telegram Webhook

```bash
node src/setup-webhook.js
```

This registers your server's URL as the webhook with Telegram. You'll need a public HTTPS URL (e.g., from [ngrok](https://ngrok.com) for local dev or a deployed server).

### 5. Run the Server

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The server starts on `http://localhost:3000`.

---

## 🤖 Bot Commands & Usage

| Input | What happens |
|-------|-------------|
| `"buy groceries"` | Saves as a note tagged `other` |
| `"https://example.com great article"` | Saves as tag `article` |
| `"remind me to call mom in 2 hours"` | Saves + sets a 2-hour reminder |
| `"find my idea about startup"` | Searches saved items for "startup" |
| `"hi"` / `"hello"` | Friendly chat reply |

---

## 🔌 REST API

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Health check |
| `POST` | `/telegram` | Telegram webhook (used by Telegram) |
| `POST` | `/save` | Save an item manually |
| `GET` | `/search?q=<query>` | Search saved items |
| `GET` | `/api/test` | List all items (debug) |

---

## 🌐 Web Dashboard

A Next.js frontend lives in `second-brain-web/`. To run it:

```bash
cd second-brain-web
npm install
npm run dev
```

Runs on `http://localhost:3001` by default.

---

## 📁 Project Structure Notes

- **Gemini fallback**: If the Gemini API is unavailable, `src/services/gemini.js` falls back to regex-based local analysis — so the bot always works.
- **Reminders**: `src/services/reminders.js` runs a background cron job that polls the `reminders` table and sends Telegram messages when due.
- **Message parser**: `src/utils/parser.js` normalizes all Telegram message types (text, photo captions, links) into a unified format.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a PR

---

## 📄 License

ISC © Saumya
