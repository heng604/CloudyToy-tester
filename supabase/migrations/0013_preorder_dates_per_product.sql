-- Each pre-order product has its own pre-order window: it opens on preorder_start and its deadline is preorder_end (deadline day included).
-- Both null = no dates. This replaces the single start date / deadline that used to be shared by every pre-order item (Promotions page).
alter table public.products add column if not exists preorder_start date;
alter table public.products add column if not exists preorder_end date;
notify pgrst, 'reload schema';
