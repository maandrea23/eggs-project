# Brianna Eggs Farm Manager

Mobile-first poultry farm management MVP for one small egg farm with COP money tracking, offline daily logging, charts, CSV/PDF exports, and farm data persistence.

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

5. Click **Owner Mode**.

The owner mode saves data in this browser with `localStorage`, so daily egg logs keep working even when the internet is unavailable after the app has loaded.

## What Is Included

- Owner and operator modes for the internal farm tool.
- Dashboard for birds, hens, coop capacity, eggs collected, cartons of 30, loose eggs, feed stock, sales, expenses, and profit in COP.
- Coop management for name, capacity, hens, chicks, deaths, removals, and new birds.
- Fast daily egg logging for eggs collected, cracked eggs, cartons, loose eggs, and notes.
- Sales tracking by cartons of 30 with COP totals and optional customer name.
- Feed purchase, feed usage, and farm expense tracking.
- Inventory and low-stock alerts.
- Health records and maintenance reminders.
- Basic reports with charts, CSV export, and PDF export.
- Blank starting records so the farm can enter its own production data.

## Dailey Database

The app is set up to use Dailey's managed database when deployed.

1. Dailey should run the project with the `docker-compose.yml` file in this repo.

2. The `db` service tells Dailey to provision a managed MySQL database for this app.

3. The app reads database credentials from `DATABASE_URL`, `MYSQL_URL`, or standard MySQL environment variables.

4. The app creates its first table automatically:

   ```sql
   farm_state
   ```

5. For local database testing, copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

6. Add a local MySQL connection string only if you want to test the database API locally:

   ```bash
   DATABASE_URL=mysql://user:password@localhost:3306/eggs_project
   ```

7. Restart the local server:

   ```bash
   npm run dev
   ```

## Important Notes

- The current MVP keeps an offline copy in the browser for speed and daily farm use.
- When Dailey database credentials are available, the app mirrors the full farm state into the `farm_state` table.
- A future version should split the JSON state into normalized tables for coops, egg logs, sales, feed, expenses, inventory, health, and reminders.

## Main Files

- `src/components/FarmApp.tsx` - the mobile-first app UI and local workflows.
- `src/lib/types.ts` - shared TypeScript data types.
- `src/lib/farm-state-defaults.ts` - blank starting farm records.
- `src/lib/calculations.ts` - dashboard, report, alert, and insight calculations.
- `src/lib/local-store.ts` - offline localStorage persistence.
- `src/lib/dailey-db.ts` - server-side Dailey MySQL persistence.
- `src/app/api/farm-state/route.ts` - API route for reading and saving farm state.
- `docker-compose.yml` - Dailey app plus managed database service.
