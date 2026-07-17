-- Keep profile identity fields server/database controlled. The browser may
-- read its own profile, but can only change wardrobe_public through the RPC.
revoke insert, update, delete on public.profiles from authenticated;

drop policy if exists profiles_owner_insert on public.profiles;
drop policy if exists profiles_owner_update on public.profiles;

create or replace function public.set_wardrobe_public(enabled boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set wardrobe_public = enabled,
      updated_at = now()
  where id = auth.uid();
$$;

revoke all on function public.set_wardrobe_public(boolean) from public, anon;
grant execute on function public.set_wardrobe_public(boolean) to authenticated;
