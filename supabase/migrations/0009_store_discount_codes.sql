-- Store-wide discount codes: admin creates a code + a % (10-50). Customers type it at checkout and get that % off the cart SUBTOTAL (delivery is never discounted).
create table if not exists public.store_discounts(
  code text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  percent numeric(5,2) not null check (percent >= 10 and percent <= 50),
  created_at timestamptz default now()
);
alter table public.store_discounts enable row level security;
drop policy if exists "admin read store discounts" on public.store_discounts;
create policy "admin read store discounts" on public.store_discounts for select using (public.is_admin());
alter publication supabase_realtime add table public.store_discounts;
notify pgrst, 'reload schema';
