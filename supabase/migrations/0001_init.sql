-- Phase 3 core schema + RLS. Apply with: supabase db push
create extension if not exists pgcrypto;
create table public.profiles(id uuid primary key references auth.users on delete cascade, display_name text, avatar_url text, phone text, default_shipping_address jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.admin_users(user_id uuid primary key references auth.users on delete cascade, role text not null default 'admin', created_at timestamptz default now());
create table public.categories(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, image_url text, active boolean default true, sort_order int default 0, created_at timestamptz default now());
create table public.products(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, sku text unique not null, description text, category_id uuid references public.categories, price numeric(10,2) not null check(price>=0), sale_price numeric(10,2) check(sale_price>=0), images jsonb not null default '[]', stock int not null default 0 check(stock>=0), age_range text, specifications jsonb default '{}', active boolean default false, featured boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
create index on public.products(category_id); create index on public.products(active);
create table public.orders(id uuid primary key default gen_random_uuid(), order_number text unique not null, user_id uuid not null references auth.users, customer_name text, customer_email text, customer_phone text, shipping_address jsonb, delivery_instructions text, subtotal numeric(10,2), discount numeric(10,2) default 0, shipping_fee numeric(10,2) default 0, total numeric(10,2), currency text default 'USD',
 payment_status text not null default 'PENDING' check(payment_status in('PENDING','PAID','FAILED','EXPIRED','REFUNDED')),
 fulfillment_status text not null default 'UNFULFILLED' check(fulfillment_status in('UNFULFILLED','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED')), created_at timestamptz default now(), updated_at timestamptz default now());
create table public.order_items(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders on delete cascade, product_id uuid references public.products on delete set null, product_name text not null, sku text, quantity int check(quantity>0), unit_price numeric(10,2), line_total numeric(10,2));
create table public.payments(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders, provider text, payment_reference text unique not null, provider_transaction_id text, amount numeric(10,2), currency text, status text default 'PENDING', verified_at timestamptz, expires_at timestamptz, metadata jsonb);
create table public.payment_events(id uuid primary key default gen_random_uuid(), provider_event_id text unique, payment_reference text, event_type text, processing_status text, received_at timestamptz default now(), processed_at timestamptz);
create table public.email_notifications(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders, recipient text, notification_type text, status text default 'PENDING', attempts int default 0, sent_at timestamptz, last_error text, created_at timestamptz default now(), unique(order_id,notification_type,recipient));
create table public.inventory_reservations(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders, product_id uuid references public.products, quantity int, status text default 'ACTIVE', expires_at timestamptz, created_at timestamptz default now());

create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()) $$;

alter table public.profiles enable row level security; alter table public.admin_users enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.payments enable row level security; alter table public.payment_events enable row level security; alter table public.email_notifications enable row level security; alter table public.inventory_reservations enable row level security;

create policy "own profile read" on public.profiles for select using(id=auth.uid());
create policy "own profile update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "own profile insert" on public.profiles for insert with check(id=auth.uid());
create policy "public active categories" on public.categories for select using(active);
create policy "public active products" on public.products for select using(active);
create policy "own orders" on public.orders for select using(user_id=auth.uid());
create policy "own order items" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy "own payments" on public.payments for select using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy "admin read orders" on public.orders for select using(public.is_admin());
-- No customer INSERT/UPDATE policies on orders, payments, products, stock: writes go through trusted server code (service role) only.
-- admin_users, payment_events, email_notifications, inventory_reservations: no policies = no client access.
