
# Migration from Lovable Cloud to External Supabase + Edge Function Setup Guide

This is a comprehensive step-by-step guide for migrating your project to your own Supabase instance and setting up all edge functions. No code changes are needed -- this is a setup/ops guide.

---

## Part 1: Create Your Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. Note down these values from **Settings > API**:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **Anon/Public Key** (starts with `eyJ...`)
   - **Service Role Key** (starts with `eyJ...` -- keep secret!)
   - **Project Reference ID** (the `abcdefgh` part of the URL)

---

## Part 2: Run Database Migrations

In your Supabase dashboard, go to **SQL Editor** and run each migration file **in order**. Your project has 14 migration files. Run them one at a time in this order:

1. `20260206174118` -- Creates all core tables (pilots, pireps, aircraft, events, etc.), enums, RLS policies, triggers, and seeds aircraft data
2. `20260206174127` through `20260211042708` -- Each subsequent migration adds features (announcements, NOTAMs, challenges, rank configs, bonus cards, multipliers, site_settings, etc.)

You can find all the SQL content in your project's `supabase/migrations/` folder. Copy-paste each file's content into the SQL Editor and click **Run**.

---

## Part 3: Enable Required Extensions

In **SQL Editor**, run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
```

`pg_cron` is used for scheduled tasks (daily featured route notifications).  
`pg_net` is used for HTTP calls from database triggers (rank promotion notifications).

---

## Part 4: Deploy Edge Functions

Your project has 3 edge functions. Here is how to deploy each one using the Supabase CLI.

### Prerequisites
Install the Supabase CLI:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### Function 1: `discord-rank-notification`
**Purpose**: Sends Discord notifications for rank promotions, new PIREPs, featured routes, and new challenges. Called by database triggers and application code.

**Deploy**:
```bash
supabase functions deploy discord-rank-notification --no-verify-jwt
```

The `--no-verify-jwt` flag is important because this function is called from database triggers (via `pg_net`) which don't send JWT tokens.

### Function 2: `daily-featured-notification`
**Purpose**: Runs on a daily schedule. Fetches today's featured routes (minimum 2 required), includes active multiplier info, and sends a Discord embed.

**Deploy**:
```bash
supabase functions deploy daily-featured-notification --no-verify-jwt
```

### Function 3: `setup-admin`
**Purpose**: Automatically creates a pilot profile and admin role for pre-approved email addresses (currently `admin@aflv.ru`).

**Deploy**:
```bash
supabase functions deploy setup-admin --no-verify-jwt
```

---

## Part 5: Set Up Secrets

In the Supabase dashboard, go to **Edge Functions > Manage Secrets** and add these:

| Secret Name | Where to Get It |
|---|---|
| `DISCORD_WEBHOOK_URL` | Discord Server Settings > Integrations > Webhooks > New Webhook > Copy URL (default/fallback) |
| `DISCORD_WEBHOOK_PIREP` | Create a webhook in your PIREP notifications channel |
| `DISCORD_WEBHOOK_RANK` | Create a webhook in your rank promotions channel |
| `DISCORD_WEBHOOK_FEATURED` | Create a webhook in your featured routes channel |
| `DISCORD_WEBHOOK_CHALLENGES` | Create a webhook in your challenges channel |

The built-in secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are automatically available to all edge functions -- you do **not** need to add them manually.

### How to create a Discord webhook:
1. Open Discord, go to **Server Settings > Integrations > Webhooks**
2. Click **New Webhook**
3. Name it (e.g., "AFLV PIREPs")
4. Select the channel where notifications should appear
5. Click **Copy Webhook URL**
6. Paste it into the Supabase secret

---

## Part 6: Set Up the Cron Job (Daily Featured Notifications)

In **SQL Editor**, run this (replace `YOUR_PROJECT_REF` and `YOUR_ANON_KEY`):

```sql
SELECT cron.schedule(
  'daily-featured-route-notification',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/daily-featured-notification',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

- `0 0 * * *` = every day at 00:00 UTC = 5:30 AM IST
- This calls the `daily-featured-notification` function which checks for at least 2 featured routes and includes active multiplier info

To verify or manage cron jobs later:
```sql
SELECT * FROM cron.job;           -- list all jobs
SELECT cron.unschedule('daily-featured-route-notification');  -- remove job
```

---

## Part 7: Set Up Database Trigger for Rank Notifications

The migration files already create the trigger function `update_pilot_stats_on_pirep()` which calls `discord-rank-notification` via `pg_net`. However, you need to verify the URL in the trigger matches your new project.

In **SQL Editor**, update the trigger function to use your new project URL:

```sql
CREATE OR REPLACE FUNCTION public.update_pilot_stats_on_pirep()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_hours DECIMAL;
    hours_to_add DECIMAL;
    old_rank TEXT;
    new_rank TEXT;
    pilot_name TEXT;
    pilot_pid TEXT;
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        hours_to_add := NEW.flight_hours * NEW.multiplier;
        
        SELECT current_rank, full_name, pid INTO old_rank, pilot_name, pilot_pid
        FROM public.pilots WHERE id = NEW.pilot_id;
        
        UPDATE public.pilots
        SET 
            total_hours = total_hours + hours_to_add,
            total_pireps = total_pireps + 1,
            current_rank = public.calculate_rank(total_hours + hours_to_add),
            updated_at = NOW()
        WHERE id = NEW.pilot_id
        RETURNING total_hours, current_rank INTO new_hours, new_rank;
        
        IF old_rank IS DISTINCT FROM new_rank AND old_rank IS NOT NULL THEN
            PERFORM net.http_post(
                url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/discord-rank-notification',
                body := jsonb_build_object(
                    'pilot_name', pilot_name,
                    'pid', pilot_pid,
                    'old_rank', old_rank,
                    'new_rank', new_rank
                ),
                headers := '{"Content-Type": "application/json"}'::jsonb
            );
        END IF;
    END IF;
    
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
        hours_to_add := OLD.flight_hours * OLD.multiplier;
        UPDATE public.pilots
        SET 
            total_hours = GREATEST(0, total_hours - hours_to_add),
            total_pireps = GREATEST(0, total_pireps - 1),
            current_rank = public.calculate_rank(GREATEST(0, total_hours - hours_to_add)),
            updated_at = NOW()
        WHERE id = OLD.pilot_id;
    END IF;
    
    RETURN NEW;
END;
$$;
```

Replace `YOUR_PROJECT_REF` with your actual Supabase project reference ID.

---

## Part 8: Create Storage Buckets

In Supabase dashboard > **Storage**, create these public buckets:
- `event-banners` (public)
- `site-assets` (public)

---

## Part 9: Update Your Frontend

In your Lovable project, update the `.env` file values:

```
VITE_SUPABASE_PROJECT_ID="YOUR_PROJECT_REF"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_ANON_KEY"
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
```

---

## Part 10: Set Up Admin Account

1. Sign up with `admin@aflv.ru` on your app
2. The `handle_admin_user_signup` database trigger automatically assigns the admin role
3. Alternatively, the `setup-admin` edge function runs on login and does the same thing

---

## About the "Create your own" vs "Remix" Button

If a project shows **"Create your own"** instead of **"Remix"**, it means that project is not eligible for remixing. This happens when:
- The project is **private** and you are not the owner
- The project owner has **disabled remixing** in their project settings
- The project uses a **connected backend** that cannot be cloned

If you own the project, go to **Settings > General** and check the sharing/visibility options. If it is someone else's project, you would need to ask them to make it remixable.

---

## Summary Checklist

- [ ] Create Supabase project
- [ ] Run all 14 migration files in order
- [ ] Enable `pg_cron` and `pg_net` extensions
- [ ] Install Supabase CLI and link project
- [ ] Deploy 3 edge functions with `--no-verify-jwt`
- [ ] Add 5 Discord webhook secrets
- [ ] Create the cron job for daily notifications (00:00 UTC)
- [ ] Update the trigger function URL to your new project
- [ ] Create `event-banners` and `site-assets` storage buckets
- [ ] Update `.env` with your new Supabase credentials
- [ ] Sign up with `admin@aflv.ru` to activate admin role
