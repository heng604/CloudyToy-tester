-- Percent discounts are limited to 10%-50%.
alter table public.product_discounts drop constraint if exists product_discounts_percent_check;
alter table public.product_discounts add constraint product_discounts_percent_check check (percent >= 10 and percent <= 50);
notify pgrst, 'reload schema';
