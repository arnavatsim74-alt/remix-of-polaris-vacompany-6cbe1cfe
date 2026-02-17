-- Fix pilot practical completion/replay upload issues and notification inserts for non-admin users.

-- 1) Allow pilots to update only their own practical rows (for scheduled/completed statuses).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'academy_practicals'
      and policyname = 'Users can mark own practicals completed'
  ) then
    create policy "Users can mark own practicals completed"
      on public.academy_practicals
      for update
      using (
        pilot_id in (select id from public.pilots where user_id = auth.uid())
      )
      with check (
        pilot_id in (select id from public.pilots where user_id = auth.uid())
        and status in ('scheduled', 'completed')
      );
  end if;
end
$$;

-- 2) Allow pilots to create notifications only for themselves.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'notifications'
      and policyname = 'Pilots can insert own notifications'
  ) then
    create policy "Pilots can insert own notifications"
      on public.notifications
      for insert
      with check (
        recipient_pilot_id in (select id from public.pilots where user_id = auth.uid())
      );
  end if;
end
$$;

-- 3) Allow pilots to upload replay files to their own folder in site-assets bucket.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Pilots can upload own practical replays'
  ) then
    create policy "Pilots can upload own practical replays"
      on storage.objects
      for insert
      with check (
        bucket_id = 'site-assets'
        and name like (
          'practical-replays/'
          || (select id::text from public.pilots where user_id = auth.uid() limit 1)
          || '/%'
        )
      );
  end if;
end
$$;
