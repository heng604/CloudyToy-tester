-- SETUP: paste all of this into Supabase Dashboard > SQL Editor > Run. SAFE TO RUN AGAIN at any time (every step is idempotent).
-- Phase 3 core schema + RLS. Apply with: supabase db push
create extension if not exists pgcrypto;
create table if not exists public.profiles(id uuid primary key references auth.users on delete cascade, display_name text, avatar_url text, phone text, default_shipping_address jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.admin_users(user_id uuid primary key references auth.users on delete cascade, role text not null default 'admin', created_at timestamptz default now());
create table if not exists public.categories(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, image_url text, active boolean default true, sort_order int default 0, created_at timestamptz default now());
create table if not exists public.products(id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, sku text unique not null, description text, category_id uuid references public.categories, price numeric(10,2) not null check(price>=0), sale_price numeric(10,2) check(sale_price>=0), images jsonb not null default '[]', stock int not null default 0 check(stock>=0), age_range text, specifications jsonb default '{}', active boolean default false, featured boolean default false, created_at timestamptz default now(), updated_at timestamptz default now());
create index if not exists products_category_id_idx on public.products(category_id); create index if not exists products_active_idx on public.products(active);
create table if not exists public.orders(id uuid primary key default gen_random_uuid(), order_number text unique not null, user_id uuid not null references auth.users, customer_name text, customer_email text, customer_phone text, shipping_address jsonb, delivery_instructions text, subtotal numeric(10,2), discount numeric(10,2) default 0, shipping_fee numeric(10,2) default 0, total numeric(10,2), currency text default 'USD',
 payment_status text not null default 'PENDING' check(payment_status in('PENDING','PAID','FAILED','EXPIRED','REFUNDED')),
 fulfillment_status text not null default 'UNFULFILLED' check(fulfillment_status in('UNFULFILLED','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED')), created_at timestamptz default now(), updated_at timestamptz default now());
create table if not exists public.order_items(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders on delete cascade, product_id uuid references public.products on delete set null, product_name text not null, sku text, quantity int check(quantity>0), unit_price numeric(10,2), line_total numeric(10,2));
create table if not exists public.payments(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders, provider text, payment_reference text unique not null, provider_transaction_id text, amount numeric(10,2), currency text, status text default 'PENDING', verified_at timestamptz, expires_at timestamptz, metadata jsonb);
create table if not exists public.payment_events(id uuid primary key default gen_random_uuid(), provider_event_id text unique, payment_reference text, event_type text, processing_status text, received_at timestamptz default now(), processed_at timestamptz);
create table if not exists public.email_notifications(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders, recipient text, notification_type text, status text default 'PENDING', attempts int default 0, sent_at timestamptz, last_error text, created_at timestamptz default now(), unique(order_id,notification_type,recipient));
create table if not exists public.inventory_reservations(id uuid primary key default gen_random_uuid(), order_id uuid references public.orders, product_id uuid references public.products, quantity int, status text default 'ACTIVE', expires_at timestamptz, created_at timestamptz default now());

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admin_users where user_id=auth.uid()) $$;

alter table public.profiles enable row level security; alter table public.admin_users enable row level security; alter table public.categories enable row level security; alter table public.products enable row level security; alter table public.orders enable row level security; alter table public.order_items enable row level security; alter table public.payments enable row level security; alter table public.payment_events enable row level security; alter table public.email_notifications enable row level security; alter table public.inventory_reservations enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles for select using(id=auth.uid());
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles for insert with check(id=auth.uid());
drop policy if exists "public active categories" on public.categories;
create policy "public active categories" on public.categories for select using(active);
drop policy if exists "public active products" on public.products;
create policy "public active products" on public.products for select using(active);
drop policy if exists "own orders" on public.orders;
create policy "own orders" on public.orders for select using(user_id=auth.uid());
drop policy if exists "own order items" on public.order_items;
create policy "own order items" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
drop policy if exists "own payments" on public.payments;
create policy "own payments" on public.payments for select using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders" on public.orders for select using(public.is_admin());
-- No customer INSERT/UPDATE policies on orders, payments, products, stock: writes go through trusted server code (service role) only.
-- admin_users, payment_events, email_notifications, inventory_reservations: no policies = no client access.

-- Phase 4b: permanent storage + realtime for admin data (replaces the local .data/*.json files).
-- Apply with: supabase db push   (or paste into Supabase Dashboard > SQL Editor)

-- ---- products: keep a plain-text category + readable defaults
alter table public.products add column if not exists category text not null default '';
alter table public.products alter column active set default true;

-- ---- orders: guest checkout (no login needed) + full order snapshot
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists data jsonb;
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_email_idx on public.orders(customer_email);

-- ---- site settings (shipping fees, social links)
create table if not exists public.site_settings(key text primary key, value jsonb not null default '{}', updated_at timestamptz default now());
alter table public.site_settings enable row level security;
drop policy if exists "public read settings" on public.site_settings;
drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings for select using (true);

-- ---- admin = admin_users row OR the verified admin Google account
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid())
      or (lower(coalesce(auth.jwt()->>'email','')) in ('toyscloudy@gmail.com','seangheng2006@gmail.com')
          and coalesce((auth.jwt()->'user_metadata'->>'email_verified')::boolean, false))
$$;
drop policy if exists "admin read all products" on public.products;
drop policy if exists "admin read all products" on public.products;
create policy "admin read all products" on public.products for select using (public.is_admin());

-- ---- atomic stock changes (no overselling, no lost updates)
create or replace function public.decrement_stock(items jsonb) returns void language plpgsql security definer set search_path=public as $$
declare i jsonb; n int;
begin
  for i in select * from jsonb_array_elements(items) loop
    update public.products set stock = stock - (i->>'qty')::int, updated_at = now()
      where id = (i->>'productId')::uuid and stock >= (i->>'qty')::int;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'INSUFFICIENT_STOCK'; end if;
  end loop;
end $$;
create or replace function public.restore_stock(items jsonb) returns void language plpgsql security definer set search_path=public as $$
declare i jsonb;
begin
  for i in select * from jsonb_array_elements(items) loop
    update public.products set stock = stock + (i->>'qty')::int, updated_at = now() where id = (i->>'productId')::uuid;
  end loop;
end $$;
revoke all on function public.decrement_stock(jsonb), public.restore_stock(jsonb) from public, anon, authenticated;
grant execute on function public.decrement_stock(jsonb), public.restore_stock(jsonb) to service_role;

-- ---- product image storage (public read; writes only by server with service role)
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;

-- ---- realtime: admin dashboard and storefront update instantly

-- refresh the API schema cache so new tables are visible immediately
notify pgrst, 'reload schema';

-- The "Age" field was removed from products.
alter table public.products drop column if exists age_range;
notify pgrst, 'reload schema';

-- ---- Discounts: ONLY store-wide codes (10%-50% off the cart subtotal). Admin creates the codes; customers type them at checkout.
update public.products set sale_price = null where sale_price is not null;
drop function if exists public.consume_discount(text);
drop function if exists public.release_discount(text);
drop table if exists public.discount_codes;
drop table if exists public.product_discounts; -- per-item discounts were removed
create table if not exists public.store_discounts(
  code text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  percent numeric(5,2) not null check (percent >= 10 and percent <= 50),
  created_at timestamptz default now()
);
alter table public.store_discounts enable row level security;
drop policy if exists "admin read store discounts" on public.store_discounts;
create policy "admin read store discounts" on public.store_discounts for select using (public.is_admin());

-- ---- realtime (skips tables that are already published, so re-running never fails)
do $$ declare t text; begin
  foreach t in array array['products','orders','site_settings','store_discounts'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
-- Remember when a product ran out of stock. The shop hides products that stayed out of stock for 2 days; adding stock clears it and the product shows again.
alter table public.products add column if not exists out_of_stock_at timestamptz;
create or replace function public.track_out_of_stock() returns trigger language plpgsql as $$
begin
  if new.stock <= 0 then
    if tg_op = 'INSERT' or old.stock > 0 or old.out_of_stock_at is null then new.out_of_stock_at := coalesce(new.out_of_stock_at, now()); end if;
  else new.out_of_stock_at := null; end if;
  return new;
end $$;
drop trigger if exists products_out_of_stock on public.products;
create trigger products_out_of_stock before insert or update of stock on public.products for each row execute function public.track_out_of_stock();
-- products that are already at 0 start counting from their last update
update public.products set out_of_stock_at = coalesce(updated_at, now()) where stock <= 0 and out_of_stock_at is null;
notify pgrst, 'reload schema';

-- Product details used by the new admin product form: Khmer name, brand, unit, variants and labels (New Arrival / Restock / Limited Edition / Pre-Order Item).
alter table public.products add column if not exists name_km text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists uom text;
alter table public.products add column if not exists variants text;
alter table public.products add column if not exists labels text[] not null default '{}';
-- Admin staff accounts (Admin Permissions page). The two owner emails in shared/admin.ts always keep access and cannot be removed here.
-- RLS is on with no policy: only the server (service-role key) can read or write this table.
create table if not exists public.staff_members(
  email text primary key,
  name text not null default '',
  role text not null default 'admin' check (role in ('owner','admin','editor')),
  active boolean not null default true,
  last_active_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.staff_members enable row level security;
notify pgrst, 'reload schema';

-- Per-product pre-order dates (start date and deadline for each pre-order item).
alter table public.products add column if not exists preorder_start date;
alter table public.products add column if not exists preorder_end date;
notify pgrst, 'reload schema';

-- Labels are fully controlled by the admin: no automatic rule in the database, any label can be added or removed at any time.
-- (A NEW product is pre-ticked as "New Arrival" in the admin form; ticking another type replaces it. Remove this trigger if an earlier version created it.)
drop trigger if exists products_normalize_labels on public.products;
drop function if exists public.normalize_product_labels();
alter table public.products alter column labels set default '{}';

-- Every new sign-up (email + password, or Google) gets a row in public.profiles automatically, with the name and phone typed on the sign-up form.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name, phone)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)), nullif(new.raw_user_meta_data->>'phone', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- one-time: give every account that already exists its profile row
insert into public.profiles(id, display_name)
select u.id, coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ---- performance indexes (same as migrations/0016_performance_indexes.sql)
create index if not exists orders_status_created_idx on public.orders(payment_status, created_at desc);
create index if not exists orders_pending_bakong_idx on public.orders(created_at desc) where payment_status = 'PENDING' and (data->>'method') = 'BAKONG';
create index if not exists orders_account_email_idx on public.orders((data->>'accountEmail'));
create index if not exists products_active_created_idx on public.products(active, created_at desc);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_slug_pattern_idx on public.products(slug text_pattern_ops);
analyze public.orders; analyze public.products;
