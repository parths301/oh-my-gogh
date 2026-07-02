-- ============================================================
-- Oh my Gogh! — Supabase schema
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ---- admin allowlist ---------------------------------------------------
-- Any email in this table can write to the catalog/content from the admin.
create table if not exists public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

-- SECURITY DEFINER is required here: the "admin read admins" policy below
-- calls is_admin(), which reads the admins table. Without SECURITY DEFINER
-- that read re-triggers RLS on admins -> calls is_admin() again -> infinite
-- recursion (Postgres error 54001, stack depth exceeded). Running as the
-- function owner bypasses RLS for this internal read and breaks the loop,
-- while callers still only ever get back a boolean.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins a
    where a.email = (auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---- catalog -----------------------------------------------------------
create table if not exists public.products (
  id          text primary key,
  name        text not null,
  cat         text not null default 'Apparel',
  price       integer not null default 0,        -- whole units of settings.currency
  inventory   integer not null default 0,
  status      text not null default 'draft',     -- published | draft
  tint        text not null default '20,42,84',
  medium      text default '',
  artist      text default 'Atelier OMG',
  sizes       text[] not null default '{One}',
  sold        integer not null default 0,
  blurb       text default '',
  image_url   text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.artists (
  id          text primary key,
  name        text not null,
  medium      text default '',
  location    text default '',
  tint        text not null default '46,138,134',
  quote       text default '',
  bio_text    text default '',
  instagram   text default '',
  portfolio   text default '',
  featured    boolean not null default false,
  status      text not null default 'active',
  image_url   text,
  position    integer not null default 0
);

create table if not exists public.journal_posts (
  id          text primary key,
  title       text not null,
  cat         text default 'Materials',
  read_time   text default '5 min read',
  author      text default 'Atelier OMG',
  date        text default '',
  excerpt     text default '',
  body_text   text default '',
  status      text not null default 'draft',
  tint        text not null default '20,42,84',
  image_url   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.collections (
  id          text primary key,
  name        text not null,
  description text default '',
  product_ids text[] not null default '{}',
  status      text not null default 'draft',
  position    integer not null default 0
);

create table if not exists public.discounts (
  id          text primary key,
  code        text not null unique,
  type        text not null default 'pct',       -- pct | fixed
  value       integer not null default 0,
  "limit"     integer not null default 0,        -- 0 = unlimited
  used        integer not null default 0,
  expires     text default '',
  active      boolean not null default true
);

create table if not exists public.customers (
  id          text primary key,
  name        text not null,
  email       text,
  location    text default '',
  since       text default '',
  ltv         integer not null default 0,
  order_count integer not null default 0,
  avg         integer not null default 0,
  status      text not null default 'active',
  note        text default ''
);

-- ---- orders ------------------------------------------------------------
create table if not exists public.orders (
  id            text primary key,                 -- e.g. OMG-482194
  customer      text not null,
  email         text,
  address       text default '',
  date          text default '',
  stage         integer not null default 1,       -- 0 ordered .. 4 delivered
  method        text default 'Razorpay',
  tracking      text default '',
  subtotal      integer not null default 0,
  shipping      integer not null default 0,
  total         integer not null default 0,
  currency      text not null default 'INR',
  rzp_order_id  text,
  rzp_payment_id text,
  created_at    timestamptz not null default now()
);

create table if not exists public.order_items (
  id         bigint generated always as identity primary key,
  order_id   text not null references public.orders(id) on delete cascade,
  product_id text,
  name       text,
  size       text default 'One',
  qty        integer not null default 1,
  price      integer not null default 0
);

-- ---- settings (single row) --------------------------------------------
create table if not exists public.settings (
  id        integer primary key default 1,
  store     text default 'Oh my Gogh!',
  email     text default 'parth@ohmygogh.com',
  currency  text default 'INR (₹)',
  providers jsonb not null default '{}'::jsonb,
  constraint settings_single_row check (id = 1)
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.products       enable row level security;
alter table public.artists        enable row level security;
alter table public.journal_posts  enable row level security;
alter table public.collections    enable row level security;
alter table public.discounts      enable row level security;
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.settings       enable row level security;
alter table public.admins         enable row level security;

-- public storefront can read only *published* catalog/content
drop policy if exists "read published products" on public.products;
create policy "read published products" on public.products
  for select using (status = 'published' or public.is_admin());

drop policy if exists "read active artists" on public.artists;
create policy "read active artists" on public.artists
  for select using (status = 'active' or public.is_admin());

drop policy if exists "read published posts" on public.journal_posts;
create policy "read published posts" on public.journal_posts
  for select using (status = 'published' or public.is_admin());

drop policy if exists "read published collections" on public.collections;
create policy "read published collections" on public.collections
  for select using (status = 'published' or public.is_admin());

drop policy if exists "read active discounts" on public.discounts;
create policy "read active discounts" on public.discounts
  for select using (active = true or public.is_admin());

drop policy if exists "read settings" on public.settings;
create policy "read settings" on public.settings
  for select using (true);

-- admin-only full write across content tables
do $$
declare t text;
begin
  foreach t in array array['products','artists','journal_posts','collections','discounts','customers','settings'] loop
    execute format('drop policy if exists "admin write %1$s" on public.%1$I;', t);
    execute format($f$create policy "admin write %1$s" on public.%1$I
      for all using (public.is_admin()) with check (public.is_admin());$f$, t);
  end loop;
end $$;

-- customers / orders / order_items: readable + writable only by admins
-- (orders are created server-side with the service-role key, which bypasses RLS)
drop policy if exists "admin read customers" on public.customers;
create policy "admin read customers" on public.customers
  for select using (public.is_admin());

drop policy if exists "admin all orders" on public.orders;
create policy "admin all orders" on public.orders
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin all order_items" on public.order_items;
create policy "admin all order_items" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin read admins" on public.admins;
create policy "admin read admins" on public.admins
  for select using (public.is_admin());

-- ============================================================
-- Storage — product / artist / journal photos
-- Public bucket so the storefront can hot-link images directly;
-- only admins (per is_admin()) can upload, replace or delete.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "admin insert media" on storage.objects;
create policy "admin insert media" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "admin update media" on storage.objects;
create policy "admin update media" on storage.objects
  for update using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "admin delete media" on storage.objects;
create policy "admin delete media" on storage.objects
  for delete using (bucket_id = 'media' and public.is_admin());
