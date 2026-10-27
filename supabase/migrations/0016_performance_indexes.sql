-- 0016: indexes for the queries the API runs most. Safe to run again.
-- Admin order lists: "everything except FAILED / EXPIRED, newest first"
create index if not exists orders_status_created_idx on public.orders(payment_status, created_at desc);
-- Bakong watcher + stale sweep: "pending Bakong orders" (tiny partial index, only the rows that matter)
create index if not exists orders_pending_bakong_idx on public.orders(created_at desc) where payment_status = 'PENDING' and (data->>'method') = 'BAKONG';
-- "My orders" for signed-in customers (matches data->>'accountEmail')
create index if not exists orders_account_email_idx on public.orders((data->>'accountEmail'));
-- Storefront + checkout product reads: active products newest first, and category counts / renames
create index if not exists products_active_created_idx on public.products(active, created_at desc);
create index if not exists products_category_idx on public.products(category);
-- Slug uniqueness check when creating a product (slug LIKE 'name%')
create index if not exists products_slug_pattern_idx on public.products(slug text_pattern_ops);
analyze public.orders; analyze public.products;
