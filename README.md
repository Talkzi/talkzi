# Talkzi — WhatsApp Support Platform

Talkzi is a unified inbox + lead-tracking + WhatsApp broadcasting tool for
support teams. It runs on top of Chatwoot (chat engine), Supabase (data),
Firebase (live leads pipeline), and the Meta WhatsApp Cloud API (broadcast).

## What's new in this version

- **Rebrand:** ChatDesk → Talkzi (purple `#6b21a8` accent, new SVG mark).
- **Light & Dark themes:** toggle in the sidebar (☀️ / 🌙). Choice persists
  across reloads via `localStorage`.
- **Leads dashboard:** Firebase-backed real-time leads table with stats,
  sortable columns, summary popover, and a slide-over detail panel.
  **Click any lead row → it opens that contact's conversation in the inbox.**
  (Match is by `lead.conversation_id` if present, otherwise by phone-number
  match against your contacts list.)
- **Contacts page:** filter pills for **All / Ongoing Conversations / No
  Conversation**. Default opens on "Ongoing" so the active book is one click
  away.
- **Broadcast:** the WhatsApp Cloud API broadcast UI (templates, CSV upload,
  column mapping, campaign tracking, settings) now lives inside Talkzi as a
  full sidebar route — no more separate `localhost:5000` tab.

## Project Structure

```
talkzi/                ← repo root
├── src/
│   ├── components/
│   │   ├── broadcast/    WhatsApp broadcast UI
│   │   ├── leads/        Firebase-backed leads dashboard (NEW)
│   │   ├── contacts/     Contacts directory + ongoing filter
│   │   ├── conversations/ Inbox list
│   │   ├── chat/         Chat window, reply box, etc.
│   │   ├── knowledge/    Knowledge base
│   │   ├── reports/      Agent performance reports
│   │   ├── agents/       Agent management
│   │   ├── layout/       Sidebar
│   │   └── ui/           Shared (Avatar, Spinner, TalkziLogo, …)
│   ├── lib/
│   │   ├── api.js        Talkzi backend client
│   │   ├── firebase.js   Firebase config (leads DB)
│   │   └── utils.js
│   ├── store/index.js    Zustand stores (auth, UI, theme)
│   └── index.css         Theme tokens (dark + light)
├── public/talkzi-logo.png
├── server.py             Flask backend (Chatwoot + Supabase + WhatsApp)
└── supabase_schema.sql
```

## Quick Start

### 1. Backend

```bash
pip install flask flask-cors requests python-dotenv
python server.py
```

Runs at `http://localhost:5000`. Endpoints used by the frontend:

| Path                                     | Purpose                          |
| ---------------------------------------- | -------------------------------- |
| `/api/conversations` …                   | Chatwoot inbox                   |
| `/api/contacts` `/api/contacts/import`   | Supabase contacts                |
| `/api/me` `/api/templates` `/api/broadcast` `/api/send` `/api/create_template` `/api/delete_template` | WhatsApp Cloud API |
| `/api/knowledge` …                       | Knowledge base                   |
| `/api/agents` `/api/reports/summary`     | Agents & reporting               |

WhatsApp credentials default to the values you supplied in `server.py`
(`WA_PHONE_ID`, `WA_WABA_ID`, `WA_TOKEN`). To override, set them as env vars.

### 2. Frontend

```bash
npm install
npm run dev
```

Runs at `http://localhost:3000`. Vite proxies `/api/*` → `localhost:5000`.

### 3. Production build

```bash
npm run build
```

Output in `dist/`. The Flask server can serve it directly (`static_folder="dist"`).

## Linking leads to conversations

When a lead row is clicked on the Leads page, Talkzi tries:

1. `lead.conversation_id` — if your Firebase record already has it, perfect.
2. Otherwise, it normalizes `lead.Phone_Number` (digits only) and matches it
   against the Supabase contacts list. The first contact with that phone
   number wins, and Talkzi navigates to its `conversation_id`.

If no match exists you get a toast: *"No active conversation found for …"*.
This means the lead is brand-new and hasn't messaged yet.

To make matching always succeed, write `conversation_id` onto the Firebase
lead record at the same time you create the Chatwoot conversation.

## Theme

The active theme is stored in `localStorage` under `talkzi_theme`. The
`<html data-theme="…">` attribute is set before React mounts (inline script in
`index.html`) to prevent the dark→light flash on reload.

## Branding

The Talkzi logo lives in two places:

- `public/talkzi-logo.png` — favicon + raster reference.
- `src/components/ui/TalkziLogo.jsx` — `<TalkziMark />` and `<TalkziWordmark />`
  pure-SVG components used in the sidebar and login screen. Color follows
  CSS vars so it adapts to light/dark.

## Tech Stack

- **Frontend**: React 18, Vite, TanStack Query, Zustand, lucide-react
- **Backend**: Flask
- **Database**: Supabase (PostgreSQL) for contacts, agents, KB
- **Realtime leads**: Firebase Realtime Database
- **Chat engine**: Chatwoot
- **WhatsApp**: Meta Cloud API (direct, for broadcast)
