-- Defensive follow-up migration for environments where the prior migration failed mid-way.
-- This migration is idempotent and safe to run multiple times.

-- 1) Notifications table
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_pilot_id uuid not null references public.pilots(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'general',
  related_entity text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- 2) Policies (without CREATE POLICY IF NOT EXISTS for broader Postgres compatibility)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Pilots can view own notifications'
  ) then
    create policy "Pilots can view own notifications"
      on public.notifications
      for select
      using (
        exists (
          select 1
          from public.pilots p
          where p.id = notifications.recipient_pilot_id
            and p.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Pilots can update own notifications'
  ) then
    create policy "Pilots can update own notifications"
      on public.notifications
      for update
      using (
        exists (
          select 1
          from public.pilots p
          where p.id = notifications.recipient_pilot_id
            and p.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Admins can insert notifications'
  ) then
    create policy "Admins can insert notifications"
      on public.notifications
      for insert
      with check (public.has_role(auth.uid(), 'admin'::public.app_role));
  end if;
end
$$;

create index if not exists idx_notifications_recipient_created
  on public.notifications(recipient_pilot_id, created_at desc);

-- 3) Ensure practical replay column exists
alter table public.academy_practicals
  add column if not exists replay_file_url text;

-- 4) Ensure aircraft min_rank exists + deterministic backfill
alter table public.aircraft
  add column if not exists min_rank public.pilot_rank;

update public.aircraft
set min_rank = 'cadet'::public.pilot_rank
where min_rank is null;
