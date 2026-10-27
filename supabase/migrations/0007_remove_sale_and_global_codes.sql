-- Removed: Sale price and the store-wide Discounts page. Per-product discount (% + code) stays.
update public.products set sale_price = null where sale_price is not null;
drop function if exists public.consume_discount(text);
drop function if exists public.release_discount(text);
drop table if exists public.discount_codes;
notify pgrst, 'reload schema';
