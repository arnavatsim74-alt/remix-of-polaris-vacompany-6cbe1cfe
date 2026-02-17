-- Fix event gate assignment race conditions + challenge acceptance workflow support.

-- Challenge acceptance status support
alter table public.challenge_completions
  add column if not exists status text not null default 'incomplete';

alter table public.challenge_completions
  alter column completed_at drop not null;

update public.challenge_completions
set status = case when completed_at is not null then 'complete' else 'incomplete' end
where status is null or status not in ('incomplete', 'complete');

alter table public.challenge_completions
  drop constraint if exists challenge_completions_status_check;

alter table public.challenge_completions
  add constraint challenge_completions_status_check
  check (status in ('incomplete', 'complete'));

-- Allow pilots to accept/update their own challenge records.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_completions' and policyname = 'Users can create own challenge acceptance'
  ) then
    create policy "Users can create own challenge acceptance"
      on public.challenge_completions
      for insert
      with check (pilot_id in (select id from public.pilots where user_id = auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'challenge_completions' and policyname = 'Users can update own challenge acceptance'
  ) then
    create policy "Users can update own challenge acceptance"
      on public.challenge_completions
      for update
      using (pilot_id in (select id from public.pilots where user_id = auth.uid()))
      with check (pilot_id in (select id from public.pilots where user_id = auth.uid()));
  end if;
end
$$;

-- Atomic event registration with fair gate assignment
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
begin
  -- Ensure caller is operating on their own pilot record.
  if not exists (
    select 1 from public.pilots p where p.id = p_pilot_id and p.user_id = auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  -- Per-event lock to avoid concurrent duplicate gate assignment.
  perform pg_advisory_xact_lock(hashtext(p_event_id::text));

  select * into v_registration
  from public.event_registrations
  where event_id = p_event_id and pilot_id = p_pilot_id;

  if found then
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

  insert into public.event_registrations (event_id, pilot_id, assigned_dep_gate, assigned_arr_gate)
  values (p_event_id, p_pilot_id, v_dep_gate, v_arr_gate)
  returning * into v_registration;

  return v_registration;
end;
$$;
