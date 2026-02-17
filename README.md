# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Supabase migration troubleshooting (notifications/replays/min-rank)

Use the unified migration:

- `supabase/migrations/20260217143000_academy_notifications_and_permissions_unified.sql`

It is idempotent and includes:
- notifications table + RLS policies,
- practical replay/min-rank columns,
- practical completion + replay upload permissions,
- DB-level assignment notifications for practicals and exams.

## Discord OAuth setup (Vite + Supabase)

This project is a **Vite SPA** (not Next.js), so you do **not** need `app/auth/callback/route.ts`.
Supabase handles the OAuth callback at its own endpoint.

Use these values:

- **Discord OAuth2 Redirect URL** (in Discord Developer Portal):
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`
- **Supabase Auth > URL Configuration > Site URL**:
  - `https://ramva-vacompany.vercel.app`
- **Supabase Auth > URL Configuration > Additional Redirect URLs**:
  - `https://ramva-vacompany.vercel.app/*`
  - `http://localhost:5173/*` (for local dev)

The app uses:
- `/auth` for Discord sign-in
- `/apply` for Discord registration

On Discord registration, if the user signed in via Discord and has no application yet, the app auto-creates a row in `pilot_applications` with the Discord email/name so admins can review it in Applications.

### About `522 Connection timed out` on `*.supabase.co`

A `522` means Cloudflare couldn't reach the Supabase origin at that moment (provider/network outage), not a bad app route.

Try:
- Re-test after a few minutes.
- Check [Supabase status](https://status.supabase.com/).
- Retry with another network/VPN.
- Confirm your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct in Vercel env vars.
