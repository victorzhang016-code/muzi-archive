-- Persist the derived aesthetic engine output separately from source wardrobe data.
-- This is a replaceable snapshot: source rows remain the authority and are never rewritten.

create table public.aesthetic_analysis_runs (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  snapshot_hash text not null,
  engine_version text not null,
  run jsonb not null,
  generated_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.aesthetic_analysis_runs enable row level security;

create policy aesthetic_analysis_runs_owner_all
  on public.aesthetic_analysis_runs for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

revoke all on public.aesthetic_analysis_runs from anon, public;
grant select, insert, update, delete on public.aesthetic_analysis_runs to authenticated;
