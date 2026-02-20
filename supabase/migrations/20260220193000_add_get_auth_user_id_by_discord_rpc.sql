create or replace function public.get_auth_user_id_by_discord(p_discord_user_id text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
begin
  select i.user_id into v_user_id
  from auth.identities i
  where i.provider = 'discord'
    and i.provider_id = p_discord_user_id
  limit 1;

  return v_user_id;
end;
$$;

revoke all on function public.get_auth_user_id_by_discord(text) from public;
grant execute on function public.get_auth_user_id_by_discord(text) to service_role;
