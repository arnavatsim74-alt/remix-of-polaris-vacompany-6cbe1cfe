alter table public.pilots
  add column if not exists discord_username text;

create unique index if not exists pilots_discord_username_key
  on public.pilots (lower(discord_username))
  where discord_username is not null;
