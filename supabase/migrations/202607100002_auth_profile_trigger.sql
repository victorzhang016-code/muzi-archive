create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, public_id, legacy_firebase_uid, wardrobe_public)
  values (new.id, new.id::text, null, false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles, public.wardrobe_items, public.best_matches, public.aesthetic_profiles, public.ai_import_usage to authenticated;
