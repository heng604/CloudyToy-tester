-- Remember when a product ran out of stock. The shop hides products that stayed out of stock for 2 days; adding stock clears it and the product shows again.
alter table public.products add column if not exists out_of_stock_at timestamptz;
create or replace function public.track_out_of_stock() returns trigger language plpgsql as $$
begin
  if new.stock <= 0 then
    if tg_op = 'INSERT' or old.stock > 0 or old.out_of_stock_at is null then new.out_of_stock_at := coalesce(new.out_of_stock_at, now()); end if;
  else new.out_of_stock_at := null; end if;
  return new;
end $$;
drop trigger if exists products_out_of_stock on public.products;
create trigger products_out_of_stock before insert or update of stock on public.products for each row execute function public.track_out_of_stock();
-- products that are already at 0 start counting from their last update
update public.products set out_of_stock_at = coalesce(updated_at, now()) where stock <= 0 and out_of_stock_at is null;
notify pgrst, 'reload schema';
