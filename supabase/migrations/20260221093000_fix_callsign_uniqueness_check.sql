create or replace function public.finalize_recruitment_registration(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_session public.recruitment_exam_sessions%rowtype;
  v_app public.pilot_applications%rowtype;
  v_existing_pilot uuid;
  v_user_id uuid;
  v_app_id uuid;
  v_email text;
  v_normalized_pid text;
begin
  select * into v_session
  from public.recruitment_exam_sessions
  where token = p_token
  limit 1;

  if v_session.id is null then
    raise exception 'Invalid recruitment token';
  end if;

  if coalesce(v_session.passed, false) = false then
    raise exception 'Entrance exam not passed yet';
  end if;

  if v_session.preferred_pid is null then
    return jsonb_build_object('approved', false, 'requires_callsign', true);
  end if;

  v_normalized_pid := upper(trim(v_session.preferred_pid));

  v_user_id := v_session.auth_user_id;

  if v_user_id is null and v_session.discord_user_id is not null then
    v_user_id := public.get_auth_user_id_by_discord(v_session.discord_user_id);
  end if;

  v_email := nullif(trim(v_session.pending_email), '');
  if v_user_id is null and v_email is not null then
    select u.id into v_user_id
    from auth.users u
    where lower(u.email) = lower(v_email)
    order by u.created_at desc
    limit 1;
  end if;

  if v_user_id is null then
    return jsonb_build_object('approved', false, 'requires_registration', true, 'message', 'Register on Crew Center first');
  end if;

  v_app_id := public.ensure_application_for_recruitment(v_user_id, v_session.discord_user_id, coalesce(v_session.discord_user_id, 'Recruit Pilot'), v_email);

  update public.recruitment_exam_sessions
  set auth_user_id = v_user_id,
      application_id = v_app_id,
      preferred_pid = v_normalized_pid
  where id = v_session.id;

  select * into v_app from public.pilot_applications where id = v_app_id limit 1;

  if exists (
    select 1
    from public.pilots p
    where upper(trim(p.pid)) = v_normalized_pid
      and p.user_id <> v_user_id
  ) then
    return jsonb_build_object('approved', false, 'message', 'Callsign already taken');
  end if;

  select id into v_existing_pilot
  from public.pilots
  where user_id = v_user_id
  limit 1;

  if v_existing_pilot is null then
    insert into public.pilots (user_id, pid, full_name, vatsim_id, ivao_id, discord_user_id)
    values (v_user_id, v_normalized_pid, v_app.full_name, v_app.vatsim_id, v_app.ivao_id, v_session.discord_user_id);

    insert into public.user_roles (user_id, role)
    values (v_user_id, 'pilot')
    on conflict do nothing;
  else
    update public.pilots
    set pid = v_normalized_pid,
        discord_user_id = coalesce(discord_user_id, v_session.discord_user_id)
    where id = v_existing_pilot;
  end if;

  update public.pilot_applications
  set status = 'approved',
      assigned_pid = v_normalized_pid,
      reviewed_at = coalesce(reviewed_at, now())
  where id = v_app_id;

  return jsonb_build_object('approved', true, 'pid', v_normalized_pid, 'user_id', v_user_id);
end;
$$;
