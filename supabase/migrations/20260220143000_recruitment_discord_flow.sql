alter table public.pilot_applications
  add column if not exists discord_user_id text;

create unique index if not exists pilot_applications_discord_user_id_key
  on public.pilot_applications(discord_user_id)
  where discord_user_id is not null;

create table if not exists public.recruitment_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.pilot_applications(id) on delete cascade,
  exam_id uuid not null references public.academy_exams(id) on delete cascade,
  token text not null unique,
  score integer,
  passed boolean,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.recruitment_exam_sessions enable row level security;

-- Tokens are secrets; clients should only use RPC-based reads/writes.
create policy "No direct reads recruitment sessions"
  on public.recruitment_exam_sessions
  for select
  using (false);

create policy "No direct writes recruitment sessions"
  on public.recruitment_exam_sessions
  for all
  using (false)
  with check (false);

create or replace function public.submit_recruitment_exam(p_token text, p_score integer, p_passed boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.recruitment_exam_sessions%rowtype;
  v_app public.pilot_applications%rowtype;
  v_pid text;
  v_existing_pilot uuid;
begin
  select * into v_session
  from public.recruitment_exam_sessions
  where token = p_token
  limit 1;

  if v_session.id is null then
    raise exception 'Invalid recruitment token';
  end if;

  if v_session.completed_at is not null then
    return jsonb_build_object('ok', true, 'already_completed', true, 'passed', v_session.passed, 'score', v_session.score);
  end if;

  update public.recruitment_exam_sessions
  set score = p_score,
      passed = p_passed,
      completed_at = now()
  where id = v_session.id;

  if not p_passed then
    return jsonb_build_object('ok', true, 'passed', false, 'score', p_score);
  end if;

  select * into v_app
  from public.pilot_applications
  where id = v_session.application_id
  limit 1;

  if v_app.id is null then
    raise exception 'Linked application not found';
  end if;

  select id into v_existing_pilot
  from public.pilots
  where user_id = v_app.user_id
  limit 1;

  if v_existing_pilot is null then
    v_pid := public.get_next_pid();

    insert into public.pilots (user_id, pid, full_name, vatsim_id, ivao_id)
    values (v_app.user_id, v_pid, v_app.full_name, v_app.vatsim_id, v_app.ivao_id)
    on conflict (user_id) do nothing;

    insert into public.user_roles (user_id, role)
    values (v_app.user_id, 'pilot')
    on conflict do nothing;

    update public.pilot_applications
    set status = 'approved',
        assigned_pid = coalesce(assigned_pid, v_pid),
        reviewed_at = coalesce(reviewed_at, now())
    where id = v_app.id;
  end if;

  return jsonb_build_object('ok', true, 'passed', true, 'score', p_score);
end;
$$;
