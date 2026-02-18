-- Track event reminder dispatches so Discord thread reminders are sent only once per event/type.
create table if not exists public.event_discord_reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reminder_type text not null default 't_minus_30m',
  thread_id text,
  created_at timestamptz not null default now(),
  unique (event_id, reminder_type)
);

alter table public.event_discord_reminders enable row level security;

-- Admin-only visibility/management.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_discord_reminders'
      and policyname = 'Admins can manage event discord reminders'
  ) then
    create policy "Admins can manage event discord reminders"
      on public.event_discord_reminders
      for all
      using (public.has_role(auth.uid(), 'admin'))
      with check (public.has_role(auth.uid(), 'admin'));
  end if;
end $$;
