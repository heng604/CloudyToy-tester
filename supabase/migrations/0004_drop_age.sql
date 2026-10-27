-- The "Age" field was removed from products.
alter table public.products drop column if exists age_range;
notify pgrst, 'reload schema';
