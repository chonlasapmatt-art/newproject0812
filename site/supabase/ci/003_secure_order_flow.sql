-- Trusted order, payment and realtime flow.
-- Safe to run on every deploy.

alter table public.payments
  add column if not exists payable_amount numeric(10,2)
    check (payable_amount is null or payable_amount >= 0),
  add column if not exists slip_reference text,
  add column if not exists verification jsonb,
  add column if not exists verification_attempted_at timestamptz,
  add column if not exists verification_reason text
    check (verification_reason is null or char_length(verification_reason) <= 300);

do $$
begin
  if not exists(select 1 from pg_type where typname='payment_verifier') then
    create type public.payment_verifier as enum ('provider','staff','automation');
  end if;
end $$;
alter table public.payments add column if not exists verified_via public.payment_verifier;

create unique index if not exists payments_slip_reference_key
  on public.payments (slip_reference)
  where slip_reference is not null;

create unique index if not exists menu_item_variants_natural_key
  on public.menu_item_variants(menu_item_id, group_name, name);

create unique index if not exists add_ons_name_key on public.add_ons(name);
insert into public.add_ons(name,price) values
  ('ไข่ดาว',15),('เพิ่มหมูสับ',25),('เพิ่มไข่',12),('เพิ่มชีส',20),
  ('เพิ่มเบคอน',25),('เพิ่มช็อต',20),('นมโอ๊ต',20)
on conflict(name) do update set price=excluded.price;

with allowed(sku,name) as (values
  ('FD-01','ไข่ดาว'),('FD-01','เพิ่มหมูสับ'),('FD-02','เพิ่มไข่'),
  ('FD-03','เพิ่มชีส'),('FD-03','เพิ่มเบคอน'),
  ('DR-C01','เพิ่มช็อต'),('DR-C02','เพิ่มช็อต'),('DR-C02','นมโอ๊ต'),
  ('DR-C03','เพิ่มช็อต'),('DR-C04','เพิ่มช็อต'),('DR-N02','นมโอ๊ต')
)
insert into public.menu_item_add_ons(menu_item_id,add_on_id)
select m.id,a.id from allowed x
join public.menu_items m on m.sku=x.sku
join public.add_ons a on a.name=x.name
on conflict(menu_item_id,add_on_id) do nothing;

-- The browser offers these choices. Keeping the same list in the database lets
-- the server validate them and price the +15 baht size without trusting the UI.
insert into public.menu_item_variants(menu_item_id, group_name, name, price_delta, is_default, sort_order)
select m.id, v.group_name, v.name, v.price_delta, v.is_default, v.sort_order
from public.menu_items m
cross join (values
  ('อุณหภูมิ','เย็น',0,true,1),
  ('อุณหภูมิ','ร้อน',0,false,2),
  ('ความหวาน','ปกติ',0,true,1),
  ('ความหวาน','หวานน้อย',0,false,2),
  ('ความหวาน','ไม่หวาน',0,false,3),
  ('ขนาด','ปกติ',0,true,1),
  ('ขนาด','ใหญ่ +15',15,false,2)
) as v(group_name,name,price_delta,is_default,sort_order)
where m.sku like 'DR-%'
on conflict(menu_item_id,group_name,name) do update
set price_delta=excluded.price_delta,
    is_default=excluded.is_default,
    sort_order=excluded.sort_order;

insert into public.menu_item_variants(menu_item_id, group_name, name, price_delta, is_default, sort_order)
select m.id, 'ระดับความเผ็ด', v.name, 0, v.is_default, v.sort_order
from public.menu_items m
cross join (values
  ('ไม่เผ็ด',false,1),('เผ็ดน้อย',false,2),('เผ็ดกลาง',true,3),('เผ็ดมาก',false,4)
) as v(name,is_default,sort_order)
where m.sku='FD-01'
on conflict(menu_item_id,group_name,name) do update
set is_default=excluded.is_default, sort_order=excluded.sort_order;

create or replace function public.create_order_secure(p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_order uuid;
  v_number text;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_delivery numeric := 0;
  v_total numeric := 0;
  v_payable numeric := 0;
  v_item jsonb;
  v_menu public.menu_items%rowtype;
  v_qty int;
  v_add_total numeric;
  v_variant_total numeric;
  v_requested_options int;
  v_valid_options int;
  v_valid_option_groups int;
  v_requested_addons int;
  v_valid_addons int;
  v_coupon public.coupons%rowtype;
  v_payment_method text;
  v_existing record;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if p_payload->>'idempotency_key' is null then raise exception 'idempotency key required'; end if;

  select o.id, o.order_number, o.user_id, o.subtotal, o.discount, o.delivery_fee,
         o.total, p.payable_amount
    into v_existing
    from public.orders o
    left join public.payments p on p.order_id=o.id
   where o.idempotency_key=(p_payload->>'idempotency_key')::uuid;
  if found then
    if v_existing.user_id is distinct from v_user then raise exception 'order ownership mismatch'; end if;
    return jsonb_build_object(
      'order_id',v_existing.id,'order_number',v_existing.order_number,
      'subtotal',v_existing.subtotal,'discount',v_existing.discount,
      'delivery_fee',v_existing.delivery_fee,'total',v_existing.total,
      'payable_amount',coalesce(v_existing.payable_amount,v_existing.total)
    );
  end if;

  -- A real customer can retry the same idempotency key above without cost,
  -- but cannot create an unbounded stream of new orders that drains stock.
  if (select count(*) from public.orders where user_id=v_user and created_at>now()-interval '1 minute')>=5 then
    raise exception 'too many orders; retry later';
  end if;
  if (select count(*) from public.orders where user_id=v_user and created_at>now()-interval '24 hours')>=30 then
    raise exception 'daily order limit reached';
  end if;

  if jsonb_array_length(coalesce(p_payload->'items','[]'::jsonb))=0 then raise exception 'cart empty'; end if;
  if jsonb_array_length(p_payload->'items')>50 then raise exception 'too many items'; end if;
  if coalesce(p_payload#>>'{customer,name}','')='' then raise exception 'customer required'; end if;
  if coalesce(p_payload#>>'{customer,phone}','') !~ '^0[0-9]{8,9}$' then raise exception 'invalid phone'; end if;

  v_payment_method := p_payload->>'payment_method';
  if v_payment_method not in ('cash','promptpay') then raise exception 'invalid payment method'; end if;
  if p_payload->>'fulfilment' not in ('pickup','delivery') then raise exception 'invalid fulfilment'; end if;
  if p_payload->>'fulfilment'='delivery'
     and char_length(trim(coalesce(p_payload->>'address','')))<10 then
    raise exception 'delivery address required';
  end if;

  v_number := 'IJ' || to_char(now(),'YYMMDD') || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,6));
  insert into public.orders(
    order_number,user_id,idempotency_key,customer_name,customer_phone,fulfilment,
    delivery_address,customer_note,status,subtotal,total
  ) values (
    v_number,v_user,(p_payload->>'idempotency_key')::uuid,
    left(p_payload#>>'{customer,name}',100),left(p_payload#>>'{customer,phone}',10),
    (p_payload->>'fulfilment')::public.fulfilment_type,
    case when p_payload->>'fulfilment'='delivery' then p_payload->'address' else null end,
    left(coalesce(p_payload->>'note',''),300),'pending',0,0
  ) returning id into v_order;

  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    select * into strict v_menu
      from public.menu_items
     where sku=v_item->>'sku' and is_available and stock>0
     for update;
    v_qty := least(greatest(coalesce((v_item->>'quantity')::int,1),1),20);
    if v_menu.stock<v_qty then raise exception 'insufficient stock'; end if;

    v_requested_options := jsonb_array_length(coalesce(v_item->'options','[]'::jsonb));
    select count(*),count(distinct group_name),coalesce(sum(price_delta),0)
      into v_valid_options,v_valid_option_groups,v_variant_total
      from public.menu_item_variants
     where menu_item_id=v_menu.id and is_available
       and name in (select jsonb_array_elements_text(coalesce(v_item->'options','[]'::jsonb)));
    if v_valid_options<>v_requested_options or v_valid_option_groups<>v_requested_options then
      raise exception 'invalid option';
    end if;

    v_requested_addons := jsonb_array_length(coalesce(v_item->'addOns','[]'::jsonb));
    select count(*),coalesce(sum(a.price),0)
      into v_valid_addons,v_add_total
      from public.add_ons a
      join public.menu_item_add_ons ma on ma.add_on_id=a.id
     where ma.menu_item_id=v_menu.id and a.is_available
       and a.name in (select jsonb_array_elements_text(coalesce(v_item->'addOns','[]'::jsonb)));
    if v_valid_addons<>v_requested_addons then raise exception 'invalid add-on'; end if;

    insert into public.order_items(
      order_id,menu_item_id,sku,name_snapshot,unit_price,quantity,selected_options,
      selected_add_ons,add_on_total,note,line_total
    ) values (
      v_order,v_menu.id,v_menu.sku,v_menu.name_th,v_menu.price+v_variant_total,v_qty,
      coalesce(v_item->'options','[]'::jsonb),coalesce(v_item->'addOns','[]'::jsonb),
      v_add_total,left(coalesce(v_item->>'note',''),160),
      (v_menu.price+v_variant_total+v_add_total)*v_qty
    );
    v_subtotal := v_subtotal+(v_menu.price+v_variant_total+v_add_total)*v_qty;
    update public.menu_items
       set stock=stock-v_qty,is_available=(stock-v_qty)>0,updated_at=now()
     where id=v_menu.id;
  end loop;

  if nullif(upper(coalesce(p_payload->>'coupon','')),'') is not null then
    select * into v_coupon from public.coupons
     where code=upper(p_payload->>'coupon') and is_active
       and now() between starts_at and ends_at and v_subtotal>=minimum_spend
       and (usage_limit is null or used_count<usage_limit)
     for update;
    if found then
      v_discount := case when v_coupon.discount_type='fixed' then v_coupon.discount_value
        else round(v_subtotal*v_coupon.discount_value/100,2) end;
      v_discount := least(v_discount,v_subtotal);
      update public.coupons set used_count=used_count+1 where id=v_coupon.id;
    end if;
  end if;

  if p_payload->>'fulfilment'='delivery' and v_subtotal<300 then v_delivery:=30; end if;
  v_total := v_subtotal-v_discount+v_delivery;
  v_payable := case when v_payment_method='promptpay'
    then v_total+((get_byte(decode(substr(md5(v_number),1,2),'hex'),0)%99)+1)::numeric/100
    else v_total end;

  update public.orders set subtotal=v_subtotal,discount=v_discount,delivery_fee=v_delivery,
    total=v_total,coupon_id=v_coupon.id,estimated_ready_at=now()+interval '30 minutes'
  where id=v_order;
  insert into public.order_status_history(order_id,status,note)
    values(v_order,'pending','Order created');
  insert into public.payments(order_id,method,status,amount,payable_amount)
    values(v_order,v_payment_method,
      case when v_payment_method='promptpay' then 'pending_verification'::public.payment_status
           else 'unpaid'::public.payment_status end,
      v_total,v_payable);

  return jsonb_build_object(
    'order_id',v_order,'order_number',v_number,'subtotal',v_subtotal,
    'discount',v_discount,'delivery_fee',v_delivery,'total',v_total,
    'payable_amount',v_payable
  );
end; $$;

revoke all on function public.create_order_secure(jsonb) from public, anon;
grant execute on function public.create_order_secure(jsonb) to authenticated, service_role;

create or replace function public.staff_set_order_status(
  p_order_number text, p_status public.order_status, p_note text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_before public.order_status;
begin
  if not public.is_staff() then raise exception 'staff required'; end if;
  select id,status into strict v_id,v_before from public.orders where order_number=p_order_number for update;
  update public.orders set status=p_status,updated_at=now() where id=v_id;
  insert into public.order_status_history(order_id,status,changed_by,note)
    values(v_id,p_status,auth.uid(),left(p_note,300));
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
    values(auth.uid(),'order.status_changed','order',p_order_number,
      jsonb_build_object('status',v_before),jsonb_build_object('status',p_status));
end; $$;

create or replace function public.staff_set_payment_status(
  p_order_number text, p_status public.payment_status, p_note text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_payment uuid; v_before public.payment_status;
begin
  if not public.is_staff() then raise exception 'staff required'; end if;
  select p.id,p.status into strict v_payment,v_before
    from public.payments p join public.orders o on o.id=p.order_id
   where o.order_number=p_order_number for update;
  update public.payments set status=p_status,verification_reason=left(p_note,300),
    verified_by=case when p_status='verified' then auth.uid() else verified_by end,
    verified_at=case when p_status='verified' then now() else verified_at end
  where id=v_payment;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
    values(auth.uid(),'payment.status_changed','order',p_order_number,
      jsonb_build_object('status',v_before),jsonb_build_object('status',p_status,'note',p_note));
end; $$;

revoke all on function public.staff_set_order_status(text,public.order_status,text) from public, anon;
revoke all on function public.staff_set_payment_status(text,public.payment_status,text) from public, anon;
grant execute on function public.staff_set_order_status(text,public.order_status,text) to authenticated;
grant execute on function public.staff_set_payment_status(text,public.payment_status,text) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='payments') then
      alter publication supabase_realtime add table public.payments;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='order_items') then
      alter publication supabase_realtime add table public.order_items;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='menu_items') then
      alter publication supabase_realtime add table public.menu_items;
    end if;
  end if;
end $$;

notify pgrst, 'reload schema';
