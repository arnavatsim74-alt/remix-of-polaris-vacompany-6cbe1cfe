# Discord PIREP Bot

This bot adds a `/pirep` slash command to file PIREPs directly into Supabase.

## Requirements

- Create a Discord bot application and invite it with `applications.commands` + bot scope.
- Add `discord_user_id` to pilots table (migration included in this repo).
- Set env vars:

```bash
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_GUILD_ID=... # optional, faster command registration for one guild
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

## Run

```bash
node discord-bot/bot.mjs
```

## Command

- `/pirep flight_number dep_icao arr_icao operator aircraft flight_type flight_hours [flight_date]`
- Operators are loaded from `site_settings.key = pirep_operators`.
- Aircraft choices are loaded from `aircraft` table.
