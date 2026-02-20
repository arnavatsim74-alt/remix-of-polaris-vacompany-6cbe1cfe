alter table public.pilot_applications
  add column if not exists discord_username text,
  add column if not exists if_grade text,
  add column if not exists is_ifatc text,
  add column if not exists ifc_trust_level text,
  add column if not exists age_range text,
  add column if not exists ifc_profile_url text,
  add column if not exists other_va_membership text,
  add column if not exists hear_about_aflv text;

-- Discord users must now complete the full application form manually.
drop trigger if exists on_auth_user_discord_application on auth.users;
drop function if exists public.auto_create_discord_pilot_application();
