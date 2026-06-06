# Second Brain

*Your personal AI that thinks like you*

Product Blueprint — v1.0

June 2026

Telegram · Web Dashboard · AI Chat · Document Q&A · Personality Layer

## Table of Contents

1. Vision
2. Product Overview
3. Features
4. Intelligence Core
5. Tech Stack
6. Database Schema
7. Build Plan
8. Future Features (v2+)
9. Non-Negotiables
10. Open Questions
11. Focus Tracker

---

## 1. Vision

Most people save things — reels, articles, ideas — and never look at them again. The save is the end of the journey, not the beginning. Second Brain fixes that.

Second Brain is a personal AI that lives in Telegram and on the web. You send it anything — a link, a thought, a document — and it captures it silently. Then it surfaces it back to you at the right time, tells you when you've thought about something before, and answers questions from everything you've ever saved.

Most importantly: it learns to think like you. Over time, it reflects your personality, your tone, the way your mind works. It's not a generic AI assistant — it's your second brain.

### 1.1 The core problem

- You save things but never review them
- You have ideas that disappear before you act on them
- You have documents (contracts, notes, PDFs) you can't query
- AI assistants are generic — they don't know how you think

### 1.2 The solution

- Zero-friction capture via Telegram (no new app, free bot API, no restrictions)
- Smart resurfacing — reminders, nudges, similarity matches
- Document Q&A — ask anything from your uploaded files
- A personality layer that learns your voice and mirrors it back

---

## 2. Product Overview

### 2.1 Access surfaces

There are three ways to interact with your Second Brain:

**Telegram**

The primary capture surface. You message your dedicated Telegram bot with anything — a link, a thought, a voice note, an image, a PDF. The bot replies instantly with a save confirmation and inline keyboard buttons. No friction. No business account needed. Free forever.

**Web Dashboard**

Your command centre. Sign in with email or Google, then browse everything you've saved. Filter by tag, search by keyword, upload documents, manage reminders, and chat with your AI. This is where you review, organise, and go deep.

**Web Chat (Ask AI)**

A conversational interface inside the dashboard. Ask anything: 'Summarise all my startup ideas', 'What did I save about focus?', 'Find that article about deep work'. The AI searches your saves and uploaded documents and answers in your voice.

### 2.2 Core user journey

| Step | Action | What happens |
|------|--------|--------------|
| 1 | Send a reel link on Telegram | Saved silently. Tag buttons sent back. Similarity check runs. |
| 2 | Confirm or pick a tag | Tagged and indexed. Embedding stored in vector DB. |
| 3 | Get a reminder 3 days later | Telegram nudge: 'You saved this — did you act on it?' |
| 4 | Open dashboard | See all saves, search, filter, upload docs. |
| 5 | Ask AI a question | Answers from your saves + docs, in your voice. |

---

## 3. Features

### 3.1 Capture (v1)

- Send any message type via Telegram: text, URL, image, voice note, PDF
- Silent save with instant confirmation reply
- Quick-reply tag buttons: idea / reel / article / document / other
- AI auto-suggests tag before asking — one tap to confirm
- Optional: set a reminder at save time ('remind me in 3 days')

### 3.2 Resurfacing & reminders (v1)

- Similarity nudge: before saving, checks if you've saved something similar
- Uses pgvector cosine similarity on embeddings
- Threshold configurable; above 0.85 similarity triggers a nudge
- Scheduled reminders: cron job sends Telegram messages for due items
- Periodic digest (optional): weekly summary of unreviewed saves

### 3.3 Web Dashboard (v1)

- Sign in with email/password or Google OAuth
- Inbox view: all saves, newest first
- Filter by tag, search by keyword
- Mark items as reviewed / archived / actioned
- Upload documents (PDF, DOCX, TXT)
- Manage reminders: edit, snooze, delete
- AI Chat panel: ask anything from your knowledge base

### 3.4 Document Q&A (v1)

- Upload any PDF, DOCX, or plain text file
- Document is chunked and embedded on upload (RAG pipeline)
- Ask questions in natural language: 'What does clause 7 of my contract say?'
- Answers are grounded in the document — no hallucination
- Multiple documents searchable together

### 3.5 Personality layer (v1 — core differentiator)

- On first use, a short onboarding flow collects your communication style
  - How formal/casual are you?
  - Do you prefer bullet points or paragraphs?
  - What topics dominate your thinking?
- System prompt is personalised per user from day one
- As saves accumulate, the AI infers more about how you think
- Responses mirror your vocabulary, tone, and structure
- Over time: 'personality drift detection' — AI notices when your thinking shifts

---

## 4. Intelligence Core

Every message, whether from Telegram, the dashboard, or the chat interface, passes through the intelligence core. It is a Node.js + Express server that orchestrates all AI operations.

### 4.1 Message pipeline

| Step | Module | What it does |
|------|--------|--------------|
| 1 | Receive | Telegram Bot API update hits Express webhook endpoint |
| 2 | Parse | Detects message type (text / URL / image / voice / doc), extracts content |
| 3a | Similarity search | Embeds content, queries pgvector, returns top matches above threshold |
| 3b | AI tagger | Claude reads content and suggests the most fitting tag |
| 4 | Save | Item + embedding + tag written to Supabase |
| 5 | Decide reply | Logic checks: similar found? Reminder requested? Or just confirm? |
| 6 | Reply | Sends Telegram message via Bot API with inline keyboard |

### 4.2 Personality engine

The personality engine is what makes Second Brain feel like yours. It operates at three levels:

**Level 1 — Profile (from day one)**

- Collected at onboarding: tone, format preference, key interests
- Stored in the users table as a JSON personality_profile field
- Injected into every Claude system prompt

**Level 2 — Inference (from your saves)**

- After 20+ saves, Claude analyses patterns in your content
- Detects recurring themes, vocabulary, and frameworks you use
- Updates the personality_profile automatically

**Level 3 — Feedback loop (ongoing)**

- You can rate AI responses ('more like this' / 'less like this')
- Low-rated responses are flagged and used for fine-tuning later (v2)
- High-rated responses reinforce the current personality profile

### 4.3 Document Q&A (RAG pipeline)

- Upload triggers: extract text → chunk (512 tokens, 64 overlap) → embed each chunk → store in document_chunks
- On query: embed question → cosine search on chunks → top-k chunks injected as context → Claude answers
- Answer is grounded; hallucination is minimised by explicit context injection
- Multiple documents are searched together in one query

---

## 5. Tech Stack

| Layer | Technology | Why |
|-------|------------|-----|
| Telegram integration | Telegram Bot API | Free, no business account, supports all message types, 2GB files |
| Backend server | Node.js + Express | Fast, async-first, great Telegram SDK support (node-telegram-bot-api) |
| AI (tagging, Q&A, personality) | Claude API (claude-sonnet-4-6) | Best instruction-following, long context for docs |
| Database | Supabase (Postgres) | Managed, free tier, built-in auth, row-level security |
| Vector search | pgvector (Supabase) | Native Postgres extension, no extra service needed |
| File storage | Supabase Storage | PDFs, images, voice notes stored and linked to items |
| Auth | Supabase Auth | Email + Google OAuth, JWT sessions, free |
| Frontend | Next.js (App Router) | React-based, fast, easy Vercel deployment |
| Frontend hosting | Vercel | Free tier, instant deploys, edge CDN |
| Backend hosting | Railway | Simple Node.js deployment, free tier to start |
| Embeddings | Claude / text-embedding-3-small | Either works; OpenAI embedding is cheaper at scale |
| Scheduler (reminders) | node-cron (on Railway) | Lightweight cron inside the Express server |

---

## 6. Database Schema

### 6.1 Core tables

**users**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| email | text unique | Used for login |
| telegram_chat_id | text unique | Telegram chat ID, set on first /start |
| personality_profile | jsonb | Tone, style, interests, inferred themes |
| onboarding_done | boolean | Whether personality setup is complete |
| created_at | timestamptz | Auto |

**items**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK → users | Owner |
| content | text | Raw text or extracted URL content |
| source_url | text nullable | If a link was sent |
| type | enum | text \| url \| image \| voice \| doc |
| tag | text nullable | User-confirmed tag |
| status | enum | inbox \| reviewed \| actioned \| archived |
| embedding | vector(1536) | For similarity search (pgvector) |
| created_at | timestamptz | Auto |

**reminders**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK | |
| item_id | uuid FK → items | What to remind about |
| remind_at | timestamptz | When to send the nudge |
| sent | boolean | Has it been sent? |
| message | text nullable | Custom reminder message |

**documents + document_chunks**

| Column | Type | Notes |
|--------|------|-------|
| documents.id | uuid PK | |
| documents.user_id | uuid FK | |
| documents.name | text | Original filename |
| documents.storage_path | text | Supabase Storage path |
| document_chunks.id | uuid PK | |
| document_chunks.doc_id | uuid FK | Parent document |
| document_chunks.chunk_text | text | 512-token chunk |
| document_chunks.embedding | vector(1536) | For semantic search |

---

## 7. Build Plan

### 7.1 Phase 1 — Telegram bot + database (Week 1–2)

- Create a Telegram bot via @BotFather (takes 2 minutes, completely free)
- Build Express server with /webhook endpoint on Railway
- Connect Supabase: create users, items, reminders tables
- Enable pgvector extension in Supabase
- Implement message parser for all 5 types
- Integrate Claude API for auto-tagging
- Implement similarity search with pgvector
- Implement reminder cron job
- End-to-end test: send message → save → reply → reminder

### 7.2 Phase 2 — Web dashboard (Week 3–4)

- Set up Next.js app on Vercel
- Implement Supabase Auth (email + Google)
- Build dashboard: inbox, filter, search, tag management
- Build document upload + RAG pipeline (chunk, embed, store)
- Build AI Chat panel with personality-aware system prompt
- Connect dashboard to same Supabase backend

### 7.3 Phase 3 — Personality layer (Week 5)

- Build onboarding flow (Telegram + dashboard)
- Create personality_profile schema and storage
- Inject personality into all Claude prompts
- Implement inference engine (analyse saves for patterns)
- Build feedback loop (thumbs up/down on AI replies)

### 7.4 Phase 4 — Polish + launch (Week 6)

- Mobile-responsive dashboard
- Error handling and retry logic for Telegram Bot API
- Rate limiting and abuse prevention
- Basic analytics: saves per day, most-used tags, reminder completion rate
- Onboarding guide for new users

---

## 8. Future Features (v2+)

### 8.1 Intelligence upgrades

- Daily/weekly digest: AI-written summary of your saved content in your voice
- Idea clustering: automatically groups related saves into 'thought threads'
- Pattern detection: 'You've been saving a lot about X lately — are you planning something?'
- Auto-generated action items: extracts to-dos from your saves
- Fine-tuning on your data (when enough feedback is collected)

### 8.2 Capture upgrades

- Browser extension: one-click save from any webpage
- Email forwarding: forward newsletters and emails to your brain
- iOS/Android share sheet integration
- Telegram bot as alternative capture channel
- Voice memo transcription + summarisation

### 8.3 Social / collaboration

- Share a save or insight with a friend (with their Second Brain)
- Team Second Brain: shared knowledge base for a small group
- Public 'brain pages': curated public collections you can share

### 8.4 Integrations

- Notion: push saves and notes to your Notion workspace
- Readwise: sync highlights and articles
- Google Calendar: set reminders that appear in your calendar
- Obsidian: export your brain as a markdown vault
- Zapier / Make: connect to any tool

### 8.5 Monetisation (when ready)

| Tier | Price | What's included |
|------|-------|-----------------|
| Free | ₹0 / month | 100 saves, 2 documents, basic reminders |
| Pro | ₹299 / month | Unlimited saves, 20 docs, full personality layer, digests |
| Team | ₹999 / month | 5 users, shared knowledge base, team digest |

---

## 9. Non-Negotiables

These principles must hold at every phase of the build:

- Zero friction to capture — if it takes more than one message to save something, it's broken
- Privacy first — your data is yours; row-level security on every table; no data sold or shared
- The AI should feel like you — not a generic assistant; personality is not a feature, it is the product
- Reliability over features — a bot that replies in 2 seconds beats one with 10 features and 5-second lag
- Everything is searchable — if you saved it, you should be able to find it instantly
- Reminders must be actionable — every nudge links back to the original save and gives you options

---

## 10. Open Questions

Things to decide before or during the build:

- Which embedding model to use? Claude's built-in vs OpenAI text-embedding-3-small (cheaper at scale)
- How many tags to offer by default? Start with 5 or let users create custom tags?
- Should reminders be opt-in or opt-out by default?
- Telegram bot: use a single bot for all users, distinguished by chat_id
- Onboarding: single Telegram conversation (/start flow) or a web form on the dashboard?
- At what point does the personality inference kick in — 20 saves? 50?
- Should the AI also proactively message you (not just reply) — e.g., a Monday morning digest?

---

## 11. Focus Tracker

You start saving things around a topic — a business idea, a skill, a project — then life happens and you drift to something new. The original thread is never formally abandoned. It just goes silent. Focus Tracker is a layer on top of Second Brain that watches what you're doing and calls you out when you're drifting — before the thread is lost for good.

### 11.1 The problem it solves

- You start saving around a topic then get pulled into something new
- The original thread is never formally abandoned — it just goes silent
- Weeks later you rediscover it by accident or forget it existed entirely
- You have zero visibility into how many things you've started vs finished
- The personality layer learns your drift patterns and will call you out on them

### 11.2 How it works

**Thread detection (automatic)**

You don't declare a project. The system detects it. When 3 or more saves cluster together semantically within a short time window, a focus thread is created automatically and named by Claude.

- Threshold: 3+ semantically similar saves within 7 days = new thread
- Claude names the thread from content: "Startup idea: no-code SaaS tools", "Learning: UI design"
- Telegram notification: "Looks like you've started a new thread: [name]. I'll keep track of it."
- You can rename, merge, or dismiss threads from the dashboard

**Drift detection (automatic)**

A cron job runs daily. For every active thread, it checks the last save date. If a thread has gone quiet past its drift threshold, a Telegram nudge fires.

- Default drift threshold: 5 days of no new saves to the thread
- Nudge message (in your voice): "You haven't added anything to '[thread name]' in 7 days. Still on it?"
- Quick-reply options: Still on it · Paused · Dropping it
- User-configurable threshold per thread from the dashboard

**Thread dashboard view**

A dedicated section on the web dashboard showing all your threads as cards. Each card shows the thread name, number of saves, date started, last active date, and current status.

- Statuses: Active · Drifting · Paused · Completed · Dropped
- Click into a thread to see all its saves, a timeline, and an AI summary of what you were exploring
- Pattern insight from the personality layer: "You typically drop threads after 10 days. You've been on this one for 8."

### 11.3 New database tables

**threads**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| user_id | uuid FK → users | Owner |
| name | text | AI-generated name, user can rename |
| status | enum | active \| drifting \| paused \| completed \| dropped |
| drift_threshold_days | integer | Default 5, user-configurable per thread |
| last_active_at | timestamptz | Updated on every new save to the thread |
| created_at | timestamptz | Auto |

**thread_items**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Auto-generated |
| thread_id | uuid FK → threads | Parent thread |
| item_id | uuid FK → items | The save belonging to this thread |
| added_at | timestamptz | When this item was linked to the thread |

### 11.4 Build plan addition (Phase 2)

Focus Tracker slots into Phase 2 alongside the dashboard. It reuses the existing saves pipeline and adds a lightweight clustering job on top.

- Create threads and thread_items tables in Supabase
- Add clustering job to intelligence core: runs after every save, checks for thread eligibility
- Add drift detection to the existing reminder cron job
- Build Threads page on the dashboard: cards with status, timeline, AI summary
- Integrate personality layer: pattern insight shown on each thread card

---

*End of document*
