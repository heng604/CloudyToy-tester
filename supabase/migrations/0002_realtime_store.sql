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
create policy "public read settings" on public.site_settings for select using (true);

-- ---- admin = admin_users row OR the verified admin Google account
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where user_id=auth.uid())
      or (lower(coalesce(auth.jwt()->>'email','')) in ('toyscloudy@gmail.com','seangheng2006@gmail.com')
          and coalesce((auth.jwt()->'user_metadata'->>'email_verified')::boolean, false))
$$;
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
alter publication supabase_realtime add table public.products, public.orders, public.site_settings;

-- refresh the API schema cache so new tables are visible immediately
notify pgrst, 'reload schema';
