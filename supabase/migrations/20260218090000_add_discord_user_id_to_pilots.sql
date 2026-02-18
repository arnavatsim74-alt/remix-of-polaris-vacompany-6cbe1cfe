alter table public.pilots
  add column if not exists discord_user_id text;

create unique index if not exists pilots_discord_user_id_key
  on public.pilots(discord_user_id)
  where discord_user_id is not null;
