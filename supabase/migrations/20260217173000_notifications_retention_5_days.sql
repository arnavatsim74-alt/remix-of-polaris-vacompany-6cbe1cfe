-- Delete notifications older than 5 days and schedule automatic cleanup.

create or replace function public.cleanup_old_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
  where created_at < now() - interval '5 days';
end;
$$;

-- run once immediately
select public.cleanup_old_notifications();

-- schedule daily cleanup (idempotent schedule registration)
do $$
begin
  begin
    perform 1 from cron.job where jobname = 'cleanup_old_notifications_daily';
  exception
    when undefined_table then
      return;
  end;

  if not exists (select 1 from cron.job where jobname = 'cleanup_old_notifications_daily') then
    perform cron.schedule(
      'cleanup_old_notifications_daily',
      '0 3 * * *',
      $$select public.cleanup_old_notifications();$$
    );
  end if;
end;
$$;
