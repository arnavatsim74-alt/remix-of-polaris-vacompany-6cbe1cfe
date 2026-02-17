-- Unified, idempotent migration to avoid prior merge/migration conflicts.

-- Notifications table
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

-- Notification policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Pilots can view own notifications') THEN
    CREATE POLICY "Pilots can view own notifications" ON public.notifications FOR SELECT
      USING (recipient_pilot_id IN (SELECT id FROM public.pilots WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Pilots can update own notifications') THEN
    CREATE POLICY "Pilots can update own notifications" ON public.notifications FOR UPDATE
      USING (recipient_pilot_id IN (SELECT id FROM public.pilots WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Admins can insert notifications') THEN
    CREATE POLICY "Admins can insert notifications" ON public.notifications FOR INSERT
      WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Pilots can insert own notifications') THEN
    CREATE POLICY "Pilots can insert own notifications" ON public.notifications FOR INSERT
      WITH CHECK (recipient_pilot_id IN (SELECT id FROM public.pilots WHERE user_id = auth.uid()));
  END IF;
END $$;

create index if not exists idx_notifications_recipient_created
  on public.notifications(recipient_pilot_id, created_at desc);

-- Ensure required columns
alter table public.academy_practicals add column if not exists replay_file_url text;
alter table public.aircraft add column if not exists min_rank public.pilot_rank;

update public.aircraft
set min_rank = 'cadet'::public.pilot_rank
where min_rank is null;

-- Pilot practical completion permissions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='academy_practicals' AND policyname='Users can mark own practicals completed') THEN
    CREATE POLICY "Users can mark own practicals completed"
      ON public.academy_practicals
      FOR UPDATE
      USING (pilot_id IN (SELECT id FROM public.pilots WHERE user_id = auth.uid()))
      WITH CHECK (
        pilot_id IN (SELECT id FROM public.pilots WHERE user_id = auth.uid())
        AND status IN ('scheduled', 'completed')
      );
  END IF;
END $$;

-- Pilot replay upload permissions to site-assets/practical-replays/<pilot_id>/...
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Pilots can upload own practical replays') THEN
    CREATE POLICY "Pilots can upload own practical replays"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'site-assets'
        AND name LIKE (
          'practical-replays/' ||
          (SELECT id::text FROM public.pilots WHERE user_id = auth.uid() LIMIT 1) ||
          '/%'
        )
      );
  END IF;
END $$;

-- DB-level notifications for assignments (avoids app-layer conflicts)
create or replace function public.notify_practical_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(recipient_pilot_id, title, message, type, related_entity, related_id)
    values (
      new.pilot_id,
      'New practical assigned',
      'A practical has been assigned to you.',
      'practical_assigned',
      'academy_practical',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_practical_assigned on public.academy_practicals;
create trigger trg_notify_practical_assigned
after insert on public.academy_practicals
for each row execute function public.notify_practical_assigned();

create or replace function public.notify_exam_assigned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications(recipient_pilot_id, title, message, type, related_entity, related_id)
  select e.pilot_id,
         'New exam assigned',
         'A new exam has been assigned in your academy course.',
         'exam_assigned',
         'academy_exam',
         new.id
  from public.academy_enrollments e
  where e.course_id = new.course_id;

  return new;
end;
$$;

drop trigger if exists trg_notify_exam_assigned on public.academy_exams;
create trigger trg_notify_exam_assigned
after insert on public.academy_exams
for each row execute function public.notify_exam_assigned();
