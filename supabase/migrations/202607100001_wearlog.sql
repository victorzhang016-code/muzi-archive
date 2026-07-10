create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  public_id text not null unique,
  legacy_firebase_uid text unique,
  wardrobe_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wardrobe_items (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) <= 200),
  brand text check (brand is null or char_length(brand) <= 200),
  category text not null,
  season text not null,
  length text,
  top_type text,
  accessory_type text,
  rating numeric,
  story text not null default '' check (char_length(story) <= 10000),
  purchase_year integer,
  image_url text check (image_url is null or char_length(image_url) <= 1200000),
  order_index integer,
  shared boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.best_matches (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  items jsonb not null default '{}'::jsonb,
  all_item_ids text[] not null default '{}',
  name text,
  story text,
  scene_tags text[],
  photo_url text,
  shared boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.aesthetic_profiles (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  style_tendency text not null default '',
  color_palette text[] not null default '{}',
  category_pattern text not null default '',
  explore_suggestions text[] not null default '{}',
  based_on_count integer not null default 0,
  generated_at timestamptz not null default now()
);

create table public.ai_import_usage (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  window_start bigint not null,
  count integer not null default 0 check (count >= 0)
);

create index wardrobe_items_owner_created_idx on public.wardrobe_items(owner_id, created_at desc);
create index best_matches_owner_created_idx on public.best_matches(owner_id, created_at desc);
create index best_matches_all_item_ids_idx on public.best_matches using gin(all_item_ids);
create index profiles_public_id_idx on public.profiles(public_id);

alter table public.profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.best_matches enable row level security;
alter table public.aesthetic_profiles enable row level security;
alter table public.ai_import_usage enable row level security;

create policy profiles_owner_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_owner_insert on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_owner_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy wardrobe_items_owner_all on public.wardrobe_items for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy best_matches_owner_all on public.best_matches for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy aesthetic_profiles_owner_all on public.aesthetic_profiles for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy ai_import_usage_owner_select on public.ai_import_usage for select to authenticated using (owner_id = auth.uid());

revoke all on public.profiles, public.wardrobe_items, public.best_matches, public.aesthetic_profiles, public.ai_import_usage from anon;
revoke all on public.profiles, public.wardrobe_items, public.best_matches, public.aesthetic_profiles, public.ai_import_usage from public;
