-- Per-item discounts were removed. Only store-wide codes (10%-50% off the cart subtotal) remain.
drop table if exists public.product_discounts;
create table if not exists public.store_discounts(
  code text primary key check (code ~ '^[A-Z0-9_-]{3,30}$'),
  percent numeric(5,2) not null check (percent >= 10 and percent <= 50),
  created_at timestamptz default now()
);
notify pgrst, 'reload schema';
