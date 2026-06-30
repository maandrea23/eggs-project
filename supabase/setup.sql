-- Brianna Eggs Farm Manager MVP schema for Supabase.
-- Run this in the Supabase SQL Editor after creating a project.
-- Important: This uses RLS and explicit grants for newer Supabase projects
-- where SQL-created tables may not be exposed to the Data API automatically.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  currency text not null default 'COP',
  carton_size integer not null default 30,
  created_at timestamptz not null default now()
);

create table if not exists public.coops (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  capacity integer not null default 0,
  hens integer not null default 0,
  chicks integer not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.bird_movements (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  coop_id uuid references public.coops(id) on delete set null,
  movement_date date not null,
  movement_type text not null check (movement_type in ('new_birds', 'death', 'removal', 'transfer_in', 'transfer_out')),
  quantity integer not null check (quantity >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.egg_logs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  log_date date not null,
  coop_1_eggs integer not null default 0,
  coop_2_eggs integer not null default 0,
  cracked_eggs integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (farm_id, log_date)
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sale_date date not null,
  cartons integer not null check (cartons >= 0),
  price_per_carton_cop integer not null check (price_per_carton_cop >= 0),
  customer_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_purchases (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  purchase_date date not null,
  feed_type text not null,
  quantity_kg numeric(10,2) not null check (quantity_kg >= 0),
  price_cop integer not null check (price_cop >= 0),
  supplier text,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_usage (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  usage_date date not null,
  quantity_kg numeric(10,2) not null check (quantity_kg >= 0),
  coop_id uuid references public.coops(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  expense_date date not null,
  category text not null,
  amount_cop integer not null check (amount_cop >= 0),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  category text not null,
  quantity numeric(10,2) not null default 0,
  unit text not null,
  reorder_level numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  record_date date not null,
  coop_id uuid references public.coops(id) on delete set null,
  record_type text not null check (record_type in ('sick', 'death', 'vaccination', 'medicine')),
  sick_birds integer default 0,
  deaths integer default 0,
  notes text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  title text not null,
  due_date date not null,
  coop_id uuid references public.coops(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'done')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  title text not null,
  remind_on date not null,
  reminder_type text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.offline_sync_queue (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  table_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.coops enable row level security;
alter table public.bird_movements enable row level security;
alter table public.egg_logs enable row level security;
alter table public.sales enable row level security;
alter table public.feed_purchases enable row level security;
alter table public.feed_usage enable row level security;
alter table public.expenses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.health_records enable row level security;
alter table public.maintenance_tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.offline_sync_queue enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.farms,
  public.coops,
  public.bird_movements,
  public.egg_logs,
  public.sales,
  public.feed_purchases,
  public.feed_usage,
  public.expenses,
  public.inventory_items,
  public.health_records,
  public.maintenance_tasks,
  public.reminders,
  public.offline_sync_queue
to authenticated;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "farms_owner_all" on public.farms;
create policy "farms_owner_all"
on public.farms for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

drop policy if exists "coops_owner_all" on public.coops;
create policy "coops_owner_all"
on public.coops for all to authenticated
using (
  exists (
    select 1 from public.farms
    where farms.id = coops.farm_id
      and farms.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.farms
    where farms.id = coops.farm_id
      and farms.owner_id = (select auth.uid())
  )
);

drop policy if exists "bird_movements_owner_all" on public.bird_movements;
create policy "bird_movements_owner_all"
on public.bird_movements for all to authenticated
using (exists (select 1 from public.farms where farms.id = bird_movements.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = bird_movements.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "egg_logs_owner_all" on public.egg_logs;
create policy "egg_logs_owner_all"
on public.egg_logs for all to authenticated
using (exists (select 1 from public.farms where farms.id = egg_logs.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = egg_logs.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "sales_owner_all" on public.sales;
create policy "sales_owner_all"
on public.sales for all to authenticated
using (exists (select 1 from public.farms where farms.id = sales.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = sales.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "feed_purchases_owner_all" on public.feed_purchases;
create policy "feed_purchases_owner_all"
on public.feed_purchases for all to authenticated
using (exists (select 1 from public.farms where farms.id = feed_purchases.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = feed_purchases.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "feed_usage_owner_all" on public.feed_usage;
create policy "feed_usage_owner_all"
on public.feed_usage for all to authenticated
using (exists (select 1 from public.farms where farms.id = feed_usage.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = feed_usage.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "expenses_owner_all" on public.expenses;
create policy "expenses_owner_all"
on public.expenses for all to authenticated
using (exists (select 1 from public.farms where farms.id = expenses.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = expenses.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "inventory_items_owner_all" on public.inventory_items;
create policy "inventory_items_owner_all"
on public.inventory_items for all to authenticated
using (exists (select 1 from public.farms where farms.id = inventory_items.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = inventory_items.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "health_records_owner_all" on public.health_records;
create policy "health_records_owner_all"
on public.health_records for all to authenticated
using (exists (select 1 from public.farms where farms.id = health_records.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = health_records.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "maintenance_tasks_owner_all" on public.maintenance_tasks;
create policy "maintenance_tasks_owner_all"
on public.maintenance_tasks for all to authenticated
using (exists (select 1 from public.farms where farms.id = maintenance_tasks.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = maintenance_tasks.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "reminders_owner_all" on public.reminders;
create policy "reminders_owner_all"
on public.reminders for all to authenticated
using (exists (select 1 from public.farms where farms.id = reminders.farm_id and farms.owner_id = (select auth.uid())))
with check (exists (select 1 from public.farms where farms.id = reminders.farm_id and farms.owner_id = (select auth.uid())));

drop policy if exists "offline_queue_owner_all" on public.offline_sync_queue;
create policy "offline_queue_owner_all"
on public.offline_sync_queue for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Optional demo seed to run after creating and logging in as one user.
-- Replace YOUR_USER_UUID with the user's auth.users.id.
--
-- insert into public.farms (owner_id, name) values ('YOUR_USER_UUID', 'Brianna Eggs') returning id;
-- Use that returned farm id to insert two coops and starter inventory.
