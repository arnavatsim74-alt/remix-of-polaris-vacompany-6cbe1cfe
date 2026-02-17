-- Notifications table for in-app alerts
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

create policy if not exists "Pilots can view own notifications"
on public.notifications
for select
using (exists (
  select 1 from public.pilots p where p.id = notifications.recipient_pilot_id and p.user_id = auth.uid()
));

create policy if not exists "Pilots can update own notifications"
on public.notifications
for update
using (exists (
  select 1 from public.pilots p where p.id = notifications.recipient_pilot_id and p.user_id = auth.uid()
));

create policy if not exists "Admins can insert notifications"
on public.notifications
for insert
with check (public.has_role(auth.uid(), 'admin'::app_role));

create index if not exists idx_notifications_recipient_created
on public.notifications(recipient_pilot_id, created_at desc);

-- Replay file support for practicals
alter table public.academy_practicals
  add column if not exists replay_file_url text;

-- Aircraft unlock by rank support
alter table public.aircraft
  add column if not exists min_rank public.pilot_rank;

update public.aircraft
set min_rank = coalesce(min_rank, 'cadet'::public.pilot_rank)
where min_rank is null;
