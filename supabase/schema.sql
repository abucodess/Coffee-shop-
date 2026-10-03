-- Supabase Schema for Mocha Counter POS
-- Run this in your Supabase SQL Editor

-- 1. Create categories table
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

-- 2. Create products table
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

-- 3. Create sequence and order number generator function
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

-- 4. Create orders table
create table if not exists public.orders (
  id text primary key,
  order_number text not null unique default public.generate_order_number(),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  tax numeric(10, 2) not null check (tax >= 0),
  total numeric(10, 2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'upi')),
  status text not null default 'paid' check (status in ('paid', 'cancelled')),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

-- Ensure payment_method constraint includes 'upi' if table already exists
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check check (payment_method in ('cash', 'card', 'upi'));

-- 5. Create order_items table (stores snapshot of product details)
create table if not exists public.order_items (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  total numeric(10, 2) not null check (total >= 0)
);

-- Create indexes for performance
create index if not exists idx_products_category on public.products(category_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);

-- Enable Row Level Security (RLS)
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Create policies for public/anon access
-- Categories: Read-only for anon, editable by service or public if needed
drop policy if exists "Allow public read on categories" on public.categories;
create policy "Allow public read on categories" on public.categories for select using (true);

drop policy if exists "Allow public insert/update on categories" on public.categories;
create policy "Allow public insert/update on categories" on public.categories for all using (true) with check (true);

-- Products: Read, Insert, Update, Delete for POS client
drop policy if exists "Allow public read on products" on public.products;
create policy "Allow public read on products" on public.products for select using (true);

drop policy if exists "Allow public all on products" on public.products;
create policy "Allow public all on products" on public.products for all using (true) with check (true);

-- Orders: Read, Insert, Update (for cancellation)
drop policy if exists "Allow public read on orders" on public.orders;
create policy "Allow public read on orders" on public.orders for select using (true);

drop policy if exists "Allow public insert on orders" on public.orders;
create policy "Allow public insert on orders" on public.orders for insert with check (true);

drop policy if exists "Allow public update on orders" on public.orders;
create policy "Allow public update on orders" on public.orders for update using (true) with check (true);

-- Order items: Read, Insert
drop policy if exists "Allow public read on order_items" on public.order_items;
create policy "Allow public read on order_items" on public.order_items for select using (true);

drop policy if exists "Allow public insert on order_items" on public.order_items;
create policy "Allow public insert on order_items" on public.order_items for insert with check (true);
