-- Run this once in Supabase SQL Editor before enabling Telegram beta notifications.
create table if not exists public.telegram_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  chat_id text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.telegram_subscriptions enable row level security;
-- The application accesses this table only from the Vercel API using the service-role key.
-- Do not add public SELECT/INSERT/UPDATE policies for anon users.
