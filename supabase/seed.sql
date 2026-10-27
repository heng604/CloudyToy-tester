-- OPTIONAL demo catalog. Run once if you want sample products; skip it for a clean store.
insert into public.products(name, slug, sku, description, category, price, sale_price, stock, active) values
 ('Cloud Plush Bear','cloud-plush-bear','CT-TOY-001','Soft plush bear. Demo item.','Plush',18,15,12,true),
 ('Wooden Stacking Rings','wooden-stacking-rings','CT-TOY-002','Colourful stacking rings. Demo item.','Wooden',12,null,30,true),
 ('Mini Building Blocks (100 pcs)','mini-building-blocks','CT-TOY-003','Creative blocks set. Demo item.','Building',25,null,0,true),
 ('Sky Explorer Puzzle','sky-explorer-puzzle','CT-TOY-004','48-piece puzzle. Demo item.','Puzzles',14,null,8,true)
on conflict (sku) do nothing;
