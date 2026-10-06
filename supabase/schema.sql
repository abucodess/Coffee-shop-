-- Supabase Schema for FUWA Japanese Fluffy Desserts POS
-- Run this in your Supabase SQL Editor

-- ============================================================
-- 0. PROFILES TABLE (Role-based access control)
-- ============================================================
-- Maps auth.users → public.profiles with a role column.
-- The initial admin account is created manually from the
-- Supabase Dashboard; set their role to 'admin' below.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('admin', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure is_active column exists if table was created previously
alter table public.profiles add column if not exists is_active boolean not null default true;

-- Index for quick role and status lookups
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_active on public.profiles(is_active);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- ============================================================
-- Helper: check if current user is admin (SECURITY DEFINER)
-- Bypasses RLS to avoid recursive policy checks on profiles
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      select role = 'admin' and is_active = true
      from public.profiles
      where id = auth.uid()
    ),
    false
  );
$$;

-- ============================================================
-- Helper: check if current user has active status (SECURITY DEFINER)
-- ============================================================
create or replace function public.is_active_user()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (
      select is_active = true
      from public.profiles
      where id = auth.uid()
    ),
    false
  );
$$;

-- Profiles RLS policies
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can manage all profiles" on public.profiles;

-- 1. Every authenticated user can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- 2. Admins can read ALL profiles (for the user management page)
create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- 3. Users can update their own display name (not role or status)
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4. Admins can manage all profiles (create, update roles, toggle active status)
create policy "Admins can manage all profiles"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Auto-create profile on new user signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'staff'),
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case when public.profiles.full_name = '' then excluded.full_name else public.profiles.full_name end,
    updated_at = now();
  return new;
end;
$$;

-- Drop existing trigger if present, then recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- 1. Categories table
-- ============================================================
create table if not exists public.categories (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default categories
insert into public.categories (id, name)
values
  ('espresso', 'Espresso'),
  ('cold', 'Cold'),
  ('pastry', 'Pastry'),
  ('bowls', 'Bowls')
on conflict (id) do update set name = excluded.name;

-- ============================================================
-- 2. Products table
-- ============================================================
create table if not exists public.products (
  id text primary key,
  name text not null,
  description text default '',
  price numeric(10, 2) not null check (price >= 0),
  category_id text not null references public.categories(id) on update cascade on delete restrict,
  color text not null default 'lemon',
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed default products with Rupee (₹) pricing
insert into public.products (id, name, description, price, category_id, color, is_available)
values
  ('flat-white', 'Flat White', 'Double ristretto', 220.00, 'espresso', 'lemon', true),
  ('honey-oat-latte', 'Honey Oat Latte', 'Barista favorite', 260.00, 'espresso', 'coral', true),
  ('cappuccino', 'Cappuccino', 'Classic foam', 200.00, 'espresso', 'paper', true),
  ('espresso', 'Double Espresso', 'Two shots', 150.00, 'espresso', 'clay', true),
  ('cortado', 'Cortado', 'Equal parts', 210.00, 'espresso', 'paper', false),
  ('iced-matcha', 'Iced Matcha', 'Ceremonial grade', 280.00, 'cold', 'mint-soft', true),
  ('cold-brew-tonic', 'Cold Brew Tonic', 'Citrus peel', 260.00, 'cold', 'lilac', true),
  ('iced-latte', 'Iced Latte', 'Over ice', 220.00, 'cold', 'sky', true),
  ('cardamom-bun', 'Cardamom Bun', 'Baked this morning', 180.00, 'pastry', 'clay', true),
  ('butter-croissant', 'Butter Croissant', 'Flaky, warm', 160.00, 'pastry', 'lemon', true),
  ('morning-bun', 'Morning Bun', 'Cinnamon sugar', 170.00, 'pastry', 'coral', true),
  ('acai-bowl', 'Açaí Bowl', 'Granola & banana', 340.00, 'bowls', 'sky', true),
  ('yogurt-bowl', 'Yogurt Bowl', 'Honey & seeds', 290.00, 'bowls', 'mint-soft', true)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  category_id = excluded.category_id,
  color = excluded.color,
  is_available = excluded.is_available,
  updated_at = now();

-- ============================================================
-- 3. Order number generator
-- ============================================================
create sequence if not exists public.order_number_seq start 100;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  next_val := nextval('public.order_number_seq');
  return 'A-' || lpad(next_val::text, 3, '0');
end;
$$;

-- ============================================================
-- 4. Orders table
-- ============================================================
create table if not exists public.orders (
  id text primary key,
  order_number text not null unique default public.generate_order_number(),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  tax numeric(10, 2) not null check (tax >= 0),
  total numeric(10, 2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'upi')),
  status text not null default 'paid' check (status in ('paid', 'cancelled')),
  cashier text not null default 'Cashier',
  customer_name text default '',
  customer_phone text default '',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('cash', 'card', 'upi'));
alter table public.orders add column if not exists cashier text default 'Cashier';
alter table public.orders add column if not exists customer_name text default '';
alter table public.orders add column if not exists customer_phone text default '';

-- ============================================================
-- 5. Order items table
-- ============================================================
create table if not exists public.order_items (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  total numeric(10, 2) not null check (total >= 0)
);

create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_customer_phone on public.orders(customer_phone);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);

-- ============================================================
-- Enable Row Level Security (RLS)
-- ============================================================
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- ============================================================
-- 6. Row Level Security (RLS) Policies
-- ============================================================
-- No anonymous access allowed.
-- Only authenticated users with active accounts can interact.

-- Categories: Read for all authenticated, manage for admins only
drop policy if exists "Allow public read on categories" on public.categories;
drop policy if exists "Allow public insert/update on categories" on public.categories;
drop policy if exists "Allow authenticated and anon read categories" on public.categories;
drop policy if exists "Allow authenticated and anon manage categories" on public.categories;
drop policy if exists "Allow authenticated read categories" on public.categories;
drop policy if exists "Allow authenticated manage categories" on public.categories;
drop policy if exists "Allow admin manage categories" on public.categories;

create policy "Allow authenticated read categories"
  on public.categories for select
  to authenticated
  using (true);

create policy "Allow admin manage categories"
  on public.categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Products: Read for authenticated; staff can toggle availability, admin can manage all
drop policy if exists "Allow public read on products" on public.products;
drop policy if exists "Allow public all on products" on public.products;
drop policy if exists "Allow authenticated and anon read products" on public.products;
drop policy if exists "Allow authenticated and anon manage products" on public.products;
drop policy if exists "Allow authenticated read products" on public.products;
drop policy if exists "Allow authenticated manage products" on public.products;
drop policy if exists "Allow admin manage products" on public.products;
drop policy if exists "Allow authenticated update product availability" on public.products;

create policy "Allow authenticated read products"
  on public.products for select
  to authenticated
  using (true);

create policy "Allow admin manage products"
  on public.products for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Orders: Authenticated can read, insert, update
drop policy if exists "Allow public read on orders" on public.orders;
drop policy if exists "Allow public insert on orders" on public.orders;
drop policy if exists "Allow public update on orders" on public.orders;
drop policy if exists "Allow authenticated and anon read orders" on public.orders;
drop policy if exists "Allow authenticated and anon insert orders" on public.orders;
drop policy if exists "Allow authenticated and anon update orders" on public.orders;
drop policy if exists "Allow authenticated read orders" on public.orders;
drop policy if exists "Allow authenticated insert orders" on public.orders;
drop policy if exists "Allow authenticated update orders" on public.orders;

create policy "Allow authenticated read orders"
  on public.orders for select
  to authenticated
  using (public.is_active_user());

create policy "Allow authenticated insert orders"
  on public.orders for insert
  to authenticated
  with check (public.is_active_user());

create policy "Allow authenticated update orders"
  on public.orders for update
  to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

-- Order items: Only active authenticated users can read and insert
drop policy if exists "Allow public read on order_items" on public.order_items;
drop policy if exists "Allow public insert on order_items" on public.order_items;
drop policy if exists "Allow authenticated and anon read order_items" on public.order_items;
drop policy if exists "Allow authenticated and anon insert order_items" on public.order_items;
drop policy if exists "Allow authenticated read order_items" on public.order_items;
drop policy if exists "Allow authenticated insert order_items" on public.order_items;

create policy "Allow authenticated read order_items"
  on public.order_items for select
  to authenticated
  using (public.is_active_user());

create policy "Allow authenticated insert order_items"
  on public.order_items for insert
  to authenticated
  with check (public.is_active_user());

-- ============================================================
-- 7. Supabase Realtime Publication
-- ============================================================
-- Enables live synchronization so menu, order, and staff status
-- changes appear instantly across all cashier/staff screens without manual refresh.
alter publication supabase_realtime add table public.categories;
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.profiles;

-- ============================================================
-- INITIAL ADMIN SETUP INSTRUCTIONS
-- ============================================================
-- 1. Go to your Supabase Dashboard:
--    Authentication → Users → "Add user" → "Create user"
--    Enter admin email and secure password.
--    Keep "Auto Confirm User?" checked.
--
-- 2. Go to the SQL Editor and promote this user to admin:
--
--    UPDATE public.profiles
--    SET role = 'admin', is_active = true
--    WHERE email = 'your-admin-email@fuwadesserts.com';
--
-- 3. You can now log in at /login with this admin account
--    and manage staff from /admin/users.
