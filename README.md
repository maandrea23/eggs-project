# Brianna Eggs Farm Manager

Mobile-first poultry farm management MVP for one small egg farm with 2 automated coops, about 250 hens, COP money tracking, demo data, offline daily logging, charts, CSV/PDF exports, and Supabase-ready auth/database setup.

## Run It Locally

1. Open Terminal in this folder:

   ```bash
   cd "/Users/muendakamara/Desktop/Brianna Egg App"
   ```

2. Install packages if needed:

   ```bash
   npm install
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open this address in your browser:

   [http://localhost:3000](http://localhost:3000)

5. Click **Demo Login**.

The demo mode saves data in this browser with `localStorage`, so daily egg logs keep working even when the internet is unavailable after the app has loaded.

## What Is Included

- Login screen with demo mode and optional Supabase email/password auth.
- Dashboard for birds, hens, coops, eggs collected, cartons of 30, loose eggs, feed stock, sales, expenses, and profit in COP.
- Coop management for names, capacity, hens, chicks, bird moves, deaths, removals, and new birds.
- Fast daily egg logging for Coop 1, Coop 2, cracked eggs, cartons, loose eggs, and notes.
- Sales tracking by cartons of 30 with COP totals and optional customer name.
- Feed purchase, feed usage, and farm expense tracking.
- Inventory and low-stock alerts.
- Health records and maintenance reminders.
- Basic reports with charts, CSV export, and PDF export.
- Demo data for 2 coops and 250 hens.

## Connect Supabase

1. Create a Supabase project.

2. Open the Supabase SQL Editor.

3. Copy the contents of:

   ```bash
   supabase/setup.sql
   ```

4. Paste it into the SQL Editor and run it.

5. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

6. Fill in your Supabase project values:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

7. Restart the local server:

   ```bash
   npm run dev
   ```

8. Use **Create User** or **Supabase Sign In** on the login screen.

## Important Notes

- Never put a Supabase `service_role` key in `NEXT_PUBLIC_` variables. Browser code must only use a publishable/anon-style public key.
- `supabase/setup.sql` enables Row Level Security on every public table.
- The current MVP keeps the main farm data local for speed and offline use. Unsynced offline actions can be pushed into the Supabase `offline_sync_queue` table when Supabase is configured.
- A future version should add a full Supabase repository layer that reads/writes every farm table directly after selecting the owner farm.

## Main Files

- `src/components/FarmApp.tsx` - the mobile-first app UI and local workflows.
- `src/lib/types.ts` - shared TypeScript data types.
- `src/lib/demo-data.ts` - seed/demo farm records.
- `src/lib/calculations.ts` - dashboard, report, alert, and insight calculations.
- `src/lib/local-store.ts` - offline localStorage persistence.
- `src/lib/supabase-client.ts` - browser Supabase client helper.
- `supabase/setup.sql` - database tables, grants, and RLS policies.
