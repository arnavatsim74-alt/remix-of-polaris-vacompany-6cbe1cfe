create or replace function public.can_access_recruitment_exam(p_token text, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select exists (
    select 1
    from public.recruitment_exam_sessions s
    join public.pilot_applications a on a.id = s.application_id
    where s.token = p_token
      and a.user_id = p_user_id
      and s.completed_at is null
  ) into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;
