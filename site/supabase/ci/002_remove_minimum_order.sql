-- Ordering with no floor.
--
-- The shop asked to drop the ฿100 minimum entirely — sell whatever a customer
-- wants, one pastry included. The check lived in two places: the checkout
-- page, which only stopped the button, and this function, which is what
-- would have actually rejected the order once create-order started reaching
-- the database. Removing it from the page alone would have looked fixed and
-- then failed on the first small order.
--
-- `create or replace` on the whole function, because Postgres has no way to
-- drop a single line out of one — this is the complete body from
-- migrations/202608210001_initial.sql with the one line removed.

create or replace function public.create_order_secure(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_order uuid; v_number text; v_subtotal numeric := 0; v_discount numeric := 0; v_delivery numeric := 0; v_item jsonb; v_menu public.menu_items%rowtype; v_qty int; v_add_total numeric; v_coupon public.coupons%rowtype;
begin
  if p_payload->>'idempotency_key' is null then raise exception 'idempotency key required'; end if;
  select id, order_number into v_order, v_number from public.orders where idempotency_key = (p_payload->>'idempotency_key')::uuid;
  if v_order is not null then return jsonb_build_object('order_id',v_order,'order_number',v_number); end if;
  if jsonb_array_length(coalesce(p_payload->'items','[]')) = 0 then raise exception 'cart empty'; end if;
  v_number := 'IJ' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,6));
  insert into public.orders(order_number,user_id,idempotency_key,customer_name,customer_phone,fulfilment,delivery_address,customer_note,status,subtotal,total)
  values(v_number,auth.uid(),(p_payload->>'idempotency_key')::uuid,left(p_payload#>>'{customer,name}',100),left(p_payload#>>'{customer,phone}',10),(p_payload->>'fulfilment')::public.fulfilment_type,p_payload->'address',left(p_payload->>'note',300),'pending',0,0) returning id into v_order;
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into strict v_menu from public.menu_items where sku = v_item->>'sku' and is_available and stock > 0 for update;
    v_qty := least(greatest((v_item->>'quantity')::int,1),20);
    if v_menu.stock < v_qty then raise exception 'insufficient stock'; end if;
    select coalesce(sum(a.price),0) into v_add_total from public.add_ons a join public.menu_item_add_ons ma on ma.add_on_id=a.id where ma.menu_item_id=v_menu.id and a.is_available and a.name in (select jsonb_array_elements_text(coalesce(v_item->'addOns','[]')));
    insert into public.order_items(order_id,menu_item_id,sku,name_snapshot,unit_price,quantity,selected_options,selected_add_ons,add_on_total,note,line_total)
    values(v_order,v_menu.id,v_menu.sku,v_menu.name_th,v_menu.price,v_qty,coalesce(v_item->'options','[]'),coalesce(v_item->'addOns','[]'),v_add_total,left(v_item->>'note',160),(v_menu.price+v_add_total)*v_qty);
    v_subtotal := v_subtotal + (v_menu.price+v_add_total)*v_qty;
    update public.menu_items set stock=stock-v_qty,is_available=(stock-v_qty)>0,updated_at=now() where id=v_menu.id;
  end loop;
  if nullif(upper(p_payload->>'coupon'),'') is not null then
    select * into v_coupon from public.coupons where code=upper(p_payload->>'coupon') and is_active and now() between starts_at and ends_at and v_subtotal>=minimum_spend and (usage_limit is null or used_count<usage_limit) for update;
    if found then v_discount := case when v_coupon.discount_type='fixed' then v_coupon.discount_value else round(v_subtotal*v_coupon.discount_value/100,2) end; update public.coupons set used_count=used_count+1 where id=v_coupon.id; end if;
  end if;
  if p_payload->>'fulfilment'='delivery' and v_subtotal<300 then v_delivery:=30; end if;
  update public.orders set subtotal=v_subtotal,discount=v_discount,delivery_fee=v_delivery,total=v_subtotal-v_discount+v_delivery,coupon_id=v_coupon.id,estimated_ready_at=now()+interval '30 minutes' where id=v_order;
  insert into public.order_status_history(order_id,status,note) values(v_order,'pending','Order created');
  insert into public.payments(order_id,method,status,amount) values(v_order,p_payload->>'payment_method',case when p_payload->>'payment_method'='promptpay' then 'pending_verification'::public.payment_status else 'unpaid'::public.payment_status end,v_subtotal-v_discount+v_delivery);
  return jsonb_build_object('order_id',v_order,'order_number',v_number,'total',v_subtotal-v_discount+v_delivery);
end; $$;
