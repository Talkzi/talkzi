-- ═══════════════════════════════════════════════════════════════
-- ChatDesk — Supabase Schema (v2)
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. AGENTS ────────────────────────────────────────────────────────────────
create table if not exists agents (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text not null unique,
  password    text not null,
  role        text default 'agent',  -- 'admin' | 'agent'
  created_at  timestamptz default now()
);

-- ── 2. CONVERSATIONS METADATA ─────────────────────────────────────────────────
create table if not exists conversations (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null unique,
  contact_name    text   default '',
  contact_number  text   default '',
  status          text   default 'open',   -- 'open' | 'resolved' | 'pending'
  assigned_to     bigint references agents(id) on delete set null,
  tags            text[] default '{}',
  notes           text   default '',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists idx_conversations_conv_id  on conversations(conversation_id);
create index if not exists idx_conversations_status   on conversations(status);
create index if not exists idx_conversations_assigned on conversations(assigned_to);

-- ── 3. LABELS ────────────────────────────────────────────────────────────────
create table if not exists labels (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  color      text default '#9b72ff',
  created_at timestamptz default now()
);

-- ── 4. CONVERSATION LABELS ───────────────────────────────────────────────────
create table if not exists conversation_labels (
  id              bigint generated always as identity primary key,
  conversation_id bigint not null,
  label_name      text   not null,
  created_at      timestamptz default now(),
  unique(conversation_id, label_name)
);
create index if not exists idx_conv_labels_conv_id on conversation_labels(conversation_id);

-- ── 5. KNOWLEDGE BASE ────────────────────────────────────────────────────────
create table if not exists knowledge_base (
  id          bigint generated always as identity primary key,
  title       text not null,
  content     text not null,
  category    text default 'General',
  tags        text default '',
  created_by  text default 'Admin',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ── 6. CONTACTS ──────────────────────────────────────────────────────────────
-- Imported from CSV or synced from Chatwoot.
-- conversation_id links to Chatwoot so clicking a contact opens their chat.
create table if not exists contacts (
  id                  bigint generated always as identity primary key,
  name                text   default '',
  phone_number        text   default '',
  email               text   default '',
  chatwoot_contact_id bigint,
  conversation_id     bigint,
  created_at          timestamptz default now()
);
create index if not exists idx_contacts_phone on contacts(phone_number);

-- ── DISABLE RLS (for dev; enable + restrict in production) ───────────────────
alter table agents              disable row level security;
alter table conversations       disable row level security;
alter table labels              disable row level security;
alter table conversation_labels disable row level security;
alter table knowledge_base      disable row level security;
alter table contacts            disable row level security;

-- ── SEED: Default admin ───────────────────────────────────────────────────────
insert into agents (name, email, password, role)
values ('Admin', 'admin@chatdesk.com', 'admin123', 'admin')
on conflict (email) do nothing;

-- ── SEED: Labels ──────────────────────────────────────────────────────────────
insert into labels (name, color) values
  ('urgent',    '#ff4d6d'),
  ('billing',   '#ffb020'),
  ('shipping',  '#06b6d4'),
  ('complaint', '#ff6b6b'),
  ('follow_up', '#9b72ff')
on conflict (name) do nothing;

-- ── SEED: KB Article ──────────────────────────────────────────────────────────
insert into knowledge_base (title, content, category, tags, created_by) values (
  'How to track your order',
  'To track your order:
1. Go to our website and click "Track Order"
2. Enter your order number (found in your confirmation email)
3. Enter your email address and click Track.

If your order has not moved in 5 business days, contact us.',
  'Shipping', 'tracking, order, delivery', 'Admin'
) on conflict do nothing;
