-- Per-product discount: admin sets a % and a code on a product. Customers get that % off ONLY by typing the code at checkout;
-- without the code they pay the normal price. Kept in its own table so codes are never readable from the public products API.
create table if not exists public.product_discounts(
  product_id uuid primary key references public.products(id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9_-]{3,30}$'),
  percent numeric(5,2) not null check (percent >= 10 and percent <= 50),
  created_at timestamptz default now()
);
create index if not exists product_discounts_code_idx on public.product_discounts(code);
alter table public.product_discounts enable row level security;
drop policy if exists "admin read product discounts" on public.product_discounts;
create policy "admin read product discounts" on public.product_discounts for select using (public.is_admin());
alter publication supabase_realtime add table public.product_discounts;
notify pgrst, 'reload schema';
