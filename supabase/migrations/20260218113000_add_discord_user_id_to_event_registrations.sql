-- Persist Discord user IDs per event participation so reminder mentions don't need manual mapping.
alter table public.event_registrations
  add column if not exists discord_user_id text;

create index if not exists idx_event_registrations_discord_user_id
  on public.event_registrations(discord_user_id);

-- Backfill existing rows from pilots table (legacy/manual mapping).
update public.event_registrations er
set discord_user_id = p.discord_user_id
from public.pilots p
where er.pilot_id = p.id
  and er.discord_user_id is null
  and p.discord_user_id is not null;

-- Update registration function to auto-capture Discord ID from auth identity when available.
create or replace function public.register_for_event(p_event_id uuid, p_pilot_id uuid)
returns public.event_registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_dep_gate text;
  v_arr_gate text;
  v_discord_user_id text;
begin
  -- Ensure caller is operating on their own pilot record.
  if not exists (
    select 1 from public.pilots p where p.id = p_pilot_id and p.user_id = auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  -- Try to capture Discord ID directly from auth identity.
  select i.provider_id
    into v_discord_user_id
  from auth.identities i
  where i.user_id = auth.uid()
    and i.provider = 'discord'
  limit 1;

  -- Fallback to pilot stored discord_user_id if present.
  if v_discord_user_id is null then
    select p.discord_user_id into v_discord_user_id
    from public.pilots p
    where p.id = p_pilot_id
    limit 1;
  end if;

  -- Per-event lock to avoid concurrent duplicate gate assignment.
  perform pg_advisory_xact_lock(hashtext(p_event_id::text));

  select * into v_registration
  from public.event_registrations
  where event_id = p_event_id and pilot_id = p_pilot_id;

  if found then
    -- Keep existing row but backfill discord_user_id if missing now.
    if v_registration.discord_user_id is null and v_discord_user_id is not null then
      update public.event_registrations
      set discord_user_id = v_discord_user_id
      where id = v_registration.id
      returning * into v_registration;
    end if;
    return v_registration;
  end if;

  select * into v_event
  from public.events
  where id = p_event_id
  for update;

  select g into v_dep_gate
  from unnest(coalesce(v_event.available_dep_gates, array[]::text[])) g
  where g not in (
    select coalesce(assigned_dep_gate, '')
    from public.event_registrations
    where event_id = p_event_id
  )
  limit 1;

  select g into v_arr_gate
  from unnest(coalesce(v_event.available_arr_gates, array[]::text[])) g
  where g not in (
    select coalesce(assigned_arr_gate, '')
    from public.event_registrations
    where event_id = p_event_id
  )
  limit 1;

  insert into public.event_registrations (event_id, pilot_id, assigned_dep_gate, assigned_arr_gate, discord_user_id)
  values (p_event_id, p_pilot_id, v_dep_gate, v_arr_gate, v_discord_user_id)
  returning * into v_registration;

  return v_registration;
end;
$$;
