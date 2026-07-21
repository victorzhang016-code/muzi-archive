-- Sprint 1: vision candidates, Victor's review history, and explicit consent.
-- Candidate attributes remain separate from the legacy wardrobe item row until
-- Victor confirms them.

create table public.aesthetic_vision_consents (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.aesthetic_vision_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.wardrobe_items(id) on delete cascade,
  image_hash text not null,
  source_image_url text not null,
  model_version text not null,
  status text not null default 'proposed'
    check (status in ('pending', 'processing', 'proposed', 'confirmed', 'rejected', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, item_id, image_hash, model_version)
);

create table public.aesthetic_vision_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid not null references public.aesthetic_vision_analyses(id) on delete cascade,
  action text not null check (action in ('created', 'confirmed', 'rejected', 'edited', 'retried')),
  previous_payload jsonb,
  next_payload jsonb,
  previous_status text,
  next_status text,
  created_at timestamptz not null default now()
);

create index aesthetic_vision_analyses_owner_item_idx
  on public.aesthetic_vision_analyses(owner_id, item_id, updated_at desc);
create index aesthetic_vision_analyses_status_idx
  on public.aesthetic_vision_analyses(owner_id, status, updated_at desc);
create index aesthetic_vision_revisions_analysis_idx
  on public.aesthetic_vision_revisions(owner_id, analysis_id, created_at desc);

alter table public.aesthetic_vision_consents enable row level security;
alter table public.aesthetic_vision_analyses enable row level security;
alter table public.aesthetic_vision_revisions enable row level security;

create policy aesthetic_vision_consents_owner_all
  on public.aesthetic_vision_consents for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy aesthetic_vision_analyses_owner_all
  on public.aesthetic_vision_analyses for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy aesthetic_vision_revisions_owner_select
  on public.aesthetic_vision_revisions for select to authenticated
  using (owner_id = auth.uid());

create policy aesthetic_vision_revisions_owner_insert
  on public.aesthetic_vision_revisions for insert to authenticated
  with check (owner_id = auth.uid());

revoke all on public.aesthetic_vision_consents,
  public.aesthetic_vision_analyses,
  public.aesthetic_vision_revisions from anon, public;
grant select, insert, update, delete on public.aesthetic_vision_consents to authenticated;
grant select, insert, update, delete on public.aesthetic_vision_analyses to authenticated;
grant select, insert on public.aesthetic_vision_revisions to authenticated;
