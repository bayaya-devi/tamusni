create extension if not exists pgcrypto;

create table if not exists public.tamusni_users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null default 'USER' check (role in ('USER','ADMIN')),
  created_at timestamptz not null default now()
);

create table if not exists public.tamusni_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  locale text not null default 'fr',
  created_at timestamptz not null default now()
);

create table if not exists public.tamusni_saved_items (
  user_id text not null references public.tamusni_users(id) on delete cascade,
  item_id text not null,
  item_type text not null check (item_type in ('article','video')),
  title text not null,
  url text not null,
  created_at timestamptz not null default now(),
  primary key (user_id,item_id)
);

alter table public.tamusni_users enable row level security;
alter table public.tamusni_newsletter_subscribers enable row level security;
alter table public.tamusni_saved_items enable row level security;

comment on table public.tamusni_users is 'TAMUSNI account mirror managed by Cloudflare Functions.';
comment on table public.tamusni_newsletter_subscribers is 'TAMUSNI newsletter subscriptions.';
comment on table public.tamusni_saved_items is 'TAMUSNI saved articles and videos.';
