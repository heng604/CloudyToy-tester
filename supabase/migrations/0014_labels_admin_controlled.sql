-- Labels are fully controlled by the admin: no automatic rule in the database, any label can be added or removed at any time.
-- (A NEW product is pre-ticked as "New Arrival" in the admin form; ticking another type replaces it. Remove this trigger if an earlier version created it.)
drop trigger if exists products_normalize_labels on public.products;
drop function if exists public.normalize_product_labels();
alter table public.products alter column labels set default '{}';
