-- Development-only data. Create a Supabase Auth user first, then replace the UUID below.
do $$
declare
  v_club uuid := '11111111-1111-4111-8111-111111111111';
  v_category_food uuid := '22222222-2222-4222-8222-222222222221';
  v_category_drinks uuid := '22222222-2222-4222-8222-222222222222';
begin
  insert into public.clubs(id,name,phone,email,address,currency,timezone)
  values(v_club,'Qeilvra Demo Club','+92 300 0000000','club@example.com','Lahore, Pakistan','PKR','Asia/Karachi') on conflict do nothing;

  insert into public.snooker_tables(club_id,name,table_number,game_rate,sort_order)
  select v_club,'Table ' || n,n,case when n <= 4 then 1200 else 1500 end,n from generate_series(1,8) n on conflict do nothing;

  insert into public.product_categories(id,club_id,name,sort_order) values
    (v_category_food,v_club,'Food & Snacks',1),(v_category_drinks,v_club,'Drinks',2) on conflict do nothing;

  insert into public.products(club_id,category_id,name,price,cost_price,sku,stock_quantity) values
    (v_club,v_category_drinks,'Tea',200,80,'TEA',60),(v_club,v_category_drinks,'Coffee',300,120,'COFFEE',40),
    (v_club,v_category_food,'Burger',650,350,'BURGER',25),(v_club,v_category_food,'Sandwich',500,250,'SANDWICH',25),
    (v_club,v_category_food,'Fries',350,150,'FRIES',30),(v_club,v_category_drinks,'Cold Drink',250,140,'COLD-DRINK',72),
    (v_club,v_category_drinks,'Water',100,50,'WATER',100) on conflict do nothing;
end $$;
