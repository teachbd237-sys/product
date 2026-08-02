-- ============================================================
-- PluginHub — Supabase Database Schema
-- এই পুরো ফাইলটি Supabase Dashboard > SQL Editor-এ Paste করে Run করুন।
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- Table: products ----------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  image_url text,
  short_description text,
  full_description text,
  price numeric not null default 0,
  version text default '1.0.0',
  compatible_software text,
  features text,             -- newline দিয়ে আলাদা করা feature লিস্ট
  file_path text,             -- Supabase Storage 'product-files' bucket-এর ভিতরের path (কখনো public না)
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

-- ---------- Table: orders ----------
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  order_code text unique not null,
  product_id uuid references products(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  transaction_id text not null,
  screenshot_path text not null,   -- Supabase Storage 'payment-proofs' bucket-এর path
  price_at_purchase numeric not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- Table: settings (key-value, যেমন bkash_number) ----------
create table if not exists settings (
  key text primary key,
  value text
);

insert into settings (key, value) values ('bkash_number', 'YOUR_BKASH_NUMBER')
  on conflict (key) do nothing;

-- ---------- Table: admins (কারা Admin Panel Access করতে পারবে) ----------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- ---------- updated_at auto-update trigger for orders ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
before update on orders
for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table products enable row level security;
alter table orders enable row level security;
alter table settings enable row level security;
alter table admins enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$ language sql stable security definer;

-- ---------- products policies ----------
-- সবাই Active Product দেখতে পারবে
create policy "Public can view active products"
on products for select
using (status = 'active' or is_admin());

-- শুধু Admin Product Add/Edit/Delete করতে পারবে
create policy "Admin can insert products"
on products for insert
with check (is_admin());

create policy "Admin can update products"
on products for update
using (is_admin());

create policy "Admin can delete products"
on products for delete
using (is_admin());

-- ---------- orders policies ----------
-- যে কেউ Order তৈরি করতে পারবে (Checkout Form Submit)
create policy "Anyone can create an order"
on orders for insert
with check (true);

-- Order টেবিলে সরাসরি Public Select বন্ধ — শুধু Admin দেখতে পারবে।
-- Customer-রা Order Status দেখবে Netlify Function-এর মাধ্যমে (Service Role ব্যবহার করে,
-- তাই RLS-কে বাইপাস করে এবং Email যাচাই করেই তথ্য দেয়)।
create policy "Admin can view all orders"
on orders for select
using (is_admin());

create policy "Admin can update orders"
on orders for update
using (is_admin());

-- ---------- settings policies ----------
-- Public bKash Number পড়তে পারবে (Checkout Page-এ দেখানোর জন্য)
create policy "Public can read settings"
on settings for select
using (true);

create policy "Admin can update settings"
on settings for all
using (is_admin())
with check (is_admin());

-- ---------- admins policies ----------
create policy "Admin can view admins list"
on admins for select
using (is_admin());

-- Note: নতুন Admin যোগ করা Supabase Dashboard থেকে ম্যানুয়ালি করাই নিরাপদ,
-- তাই admins টেবিলে Insert Policy ইচ্ছাকৃতভাবে দেওয়া হয়নি।

-- ============================================================
-- এরপর অবশ্যই নিচের কাজগুলো করুন:
-- 1. Authentication > Users থেকে নিজের Admin Email/Password দিয়ে একটি User তৈরি করুন
-- 2. Table Editor > admins টেবিলে গিয়ে সেই User-এর id (UUID) বসিয়ে একটি row Insert করুন
-- 3. Storage-এ নিচের ৩টি Bucket তৈরি করুন (storage-setup.sql দেখুন)
-- ============================================================
