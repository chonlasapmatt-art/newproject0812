-- ImJai Cafe & Kitchen — ตั้งค่าฐานข้อมูลครั้งเดียวจบ
-- รวมจาก supabase/migrations/ ทั้ง 3 ไฟล์ เมื่อ 2026-08-22
--
-- วิธีใช้
--   1. เปิด Supabase → โปรเจกต์ของคุณ → เมนูซ้าย SQL Editor
--   2. กด New query
--   3. คัดลอกไฟล์นี้ทั้งหมด วางลงไป
--   4. กด Run (หรือ Ctrl+Enter)
--   5. ถ้าขึ้น Success. No rows returned = เรียบร้อย
--
-- ปลอดภัยที่จะรันซ้ำ: ทุกคำสั่งเขียนแบบ if not exists / or replace
-- ไฟล์นี้สร้างเอง อย่าแก้ด้วยมือ — แก้ที่ supabase/migrations/ แล้วสร้างใหม่


-- ═══════════════════════════════════════════════════════
-- 202608210001_initial.sql
-- ═══════════════════════════════════════════════════════

-- ImJai Cafe & Kitchen — initial production schema
-- Run with Supabase CLI. No real secret or payment identifier is stored here.
create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'staff', 'admin');
create type public.order_status as enum ('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled');
create type public.payment_status as enum ('unpaid','pending_verification','verified','rejected','refunded');
create type public.fulfilment_type as enum ('pickup','delivery');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 100),
  phone text check (phone is null or phone ~ '^0[0-9]{8,9}$'),
  avatar_path text,
  role public.app_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'บ้าน', recipient_name text not null, phone text not null,
  address_line text not null, district text, province text, postal_code text, note text,
  is_default boolean not null default false, created_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name_th text not null,
  name_en text, sort_order integer not null default 0, is_active boolean not null default true
);
create table public.menu_items (
  id uuid primary key default gen_random_uuid(), sku text unique not null, category_id uuid not null references public.categories(id),
  name_th text not null, name_en text, description_th text not null default '', ingredients text not null default '',
  price numeric(10,2) not null check(price >= 0), stock integer not null default 0 check(stock >= 0),
  is_available boolean not null default true, is_featured boolean not null default false, is_chef_choice boolean not null default false,
  spice_level smallint not null default 0 check(spice_level between 0 and 4), image_path text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.menu_item_variants (
  id uuid primary key default gen_random_uuid(), menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  group_name text not null, name text not null, price_delta numeric(10,2) not null default 0,
  is_default boolean not null default false, is_available boolean not null default true, sort_order integer not null default 0
);
create table public.add_ons (
  id uuid primary key default gen_random_uuid(), name text not null, price numeric(10,2) not null check(price >= 0), is_available boolean not null default true
);
create table public.menu_item_add_ons (
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  add_on_id uuid references public.add_ons(id) on delete cascade,
  primary key(menu_item_id, add_on_id)
);
create table public.allergens (id uuid primary key default gen_random_uuid(), slug text unique not null, name_th text not null, name_en text);
create table public.menu_item_allergens (
  menu_item_id uuid references public.menu_items(id) on delete cascade,
  allergen_id uuid references public.allergens(id) on delete cascade,
  primary key(menu_item_id, allergen_id)
);
create table public.carts (
  id uuid primary key default gen_random_uuid(), user_id uuid unique not null references public.profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);
create table public.cart_items (
  id uuid primary key default gen_random_uuid(), cart_id uuid not null references public.carts(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id), quantity integer not null check(quantity between 1 and 20),
  selected_options jsonb not null default '[]', selected_add_ons jsonb not null default '[]', note text check(char_length(note) <= 160),
  created_at timestamptz not null default now()
);
create table public.promotions (
  id uuid primary key default gen_random_uuid(), name text not null, description text not null default '',
  discount_type text not null check(discount_type in ('fixed','percent')), discount_value numeric(10,2) not null check(discount_value >= 0),
  starts_at timestamptz not null, ends_at timestamptz not null, is_active boolean not null default true
);
create table public.coupons (
  id uuid primary key default gen_random_uuid(), code text unique not null check(code = upper(code)),
  discount_type text not null check(discount_type in ('fixed','percent')), discount_value numeric(10,2) not null check(discount_value >= 0),
  minimum_spend numeric(10,2) not null default 0, usage_limit integer, used_count integer not null default 0,
  starts_at timestamptz not null, ends_at timestamptz not null, is_active boolean not null default true
);
create table public.orders (
  id uuid primary key default gen_random_uuid(), order_number text unique not null,
  user_id uuid references public.profiles(id) on delete set null, idempotency_key uuid unique not null,
  customer_name text not null, customer_phone text not null, fulfilment public.fulfilment_type not null,
  delivery_address jsonb, customer_note text check(char_length(customer_note) <= 300),
  status public.order_status not null default 'pending', subtotal numeric(10,2) not null check(subtotal >= 0),
  discount numeric(10,2) not null default 0 check(discount >= 0), delivery_fee numeric(10,2) not null default 0 check(delivery_fee >= 0),
  total numeric(10,2) not null check(total >= 0), coupon_id uuid references public.coupons(id),
  estimated_ready_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_phone_number_idx on public.orders(customer_phone, order_number);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id), sku text not null, name_snapshot text not null,
  unit_price numeric(10,2) not null, quantity integer not null check(quantity between 1 and 20),
  selected_options jsonb not null default '[]', selected_add_ons jsonb not null default '[]', add_on_total numeric(10,2) not null default 0,
  note text check(char_length(note) <= 160), line_total numeric(10,2) not null
);
create table public.order_status_history (
  id bigint generated always as identity primary key, order_id uuid not null references public.orders(id) on delete cascade,
  status public.order_status not null, changed_by uuid references public.profiles(id), note text, created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid unique not null references public.orders(id) on delete cascade,
  method text not null check(method in ('cash','promptpay')), status public.payment_status not null default 'unpaid',
  amount numeric(10,2) not null check(amount >= 0), slip_path text, verified_by uuid references public.profiles(id), verified_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.store_settings (
  key text primary key, value jsonb not null, is_public boolean not null default false, updated_at timestamptz not null default now()
);
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles(id) on delete cascade,
  anonymous_session_hash text, handed_to_staff boolean not null default false, created_at timestamptz not null default now(), expires_at timestamptz not null default now() + interval '30 days'
);
create table public.ai_messages (
  id bigint generated always as identity primary key, conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check(role in ('user','assistant')), content text not null check(char_length(content) <= 2000),
  redacted boolean not null default false, created_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key, actor_id uuid references public.profiles(id), action text not null,
  entity_type text not null, entity_id text, before_data jsonb, after_data jsonb,
  ip_hash text, created_at timestamptz not null default now()
);

create or replace function public.current_role() returns public.app_role language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid() and is_active), 'customer'::public.app_role);
$$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.current_role() in ('staff','admin');
$$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles(id, full_name, role) values(new.id, nullif(new.raw_user_meta_data->>'full_name',''), 'customer'); return new; end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Guest cart merge is tied to auth.uid(); clients cannot target another account.
create or replace function public.merge_guest_cart(p_items jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare v_cart uuid; v_item jsonb; v_menu uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.carts(user_id) values(auth.uid()) on conflict(user_id) do update set updated_at = now() returning id into v_cart;
  for v_item in select * from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) loop
    select id into v_menu from public.menu_items where sku = v_item->>'sku' and is_available;
    if v_menu is not null then
      insert into public.cart_items(cart_id,menu_item_id,quantity,selected_options,selected_add_ons,note)
      values(v_cart,v_menu,least(greatest(coalesce((v_item->>'quantity')::int,1),1),20),coalesce(v_item->'options','[]'),coalesce(v_item->'add_ons','[]'),left(v_item->>'note',160));
    end if;
  end loop;
  return v_cart;
end; $$;

-- Transactional order creation. All prices are read from trusted DB rows.
create or replace function public.create_order_secure(p_payload jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
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
  if v_subtotal < 100 then raise exception 'minimum order not met'; end if;
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

alter table public.profiles enable row level security; alter table public.addresses enable row level security;
alter table public.categories enable row level security; alter table public.menu_items enable row level security;
alter table public.menu_item_variants enable row level security; alter table public.add_ons enable row level security;
alter table public.menu_item_add_ons enable row level security; alter table public.allergens enable row level security;
alter table public.menu_item_allergens enable row level security; alter table public.carts enable row level security;
alter table public.cart_items enable row level security; alter table public.orders enable row level security;
alter table public.order_items enable row level security; alter table public.order_status_history enable row level security;
alter table public.payments enable row level security; alter table public.promotions enable row level security;
alter table public.coupons enable row level security; alter table public.store_settings enable row level security;
alter table public.ai_conversations enable row level security; alter table public.ai_messages enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_self_read on public.profiles for select using(id=auth.uid() or public.is_staff());
create policy profiles_self_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
revoke update(role,is_active) on public.profiles from authenticated;
create policy addresses_owner_all on public.addresses for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy public_categories_read on public.categories for select using(is_active or public.is_staff());
create policy public_menu_read on public.menu_items for select using(true);
create policy public_variants_read on public.menu_item_variants for select using(is_available or public.is_staff());
create policy public_addons_read on public.add_ons for select using(is_available or public.is_staff());
create policy public_menu_addons_read on public.menu_item_add_ons for select using(true);
create policy public_allergens_read on public.allergens for select using(true);
create policy public_menu_allergens_read on public.menu_item_allergens for select using(true);
create policy staff_categories_write on public.categories for all using(public.is_staff()) with check(public.is_staff());
create policy staff_menu_write on public.menu_items for all using(public.is_staff()) with check(public.is_staff());
create policy staff_variants_write on public.menu_item_variants for all using(public.is_staff()) with check(public.is_staff());
create policy staff_addons_write on public.add_ons for all using(public.is_staff()) with check(public.is_staff());
create policy carts_owner_all on public.carts for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy cart_items_owner_all on public.cart_items for all using(exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid())) with check(exists(select 1 from public.carts c where c.id=cart_id and c.user_id=auth.uid()));
create policy orders_owner_read on public.orders for select using(user_id=auth.uid() or public.is_staff());
create policy order_items_owner_read on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff())));
create policy order_history_owner_read on public.order_status_history for select using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff())));
create policy payments_owner_read on public.payments for select using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_staff())));
create policy promotions_public_read on public.promotions for select using(is_active or public.is_staff());
create policy coupons_staff_only on public.coupons for all using(public.is_staff()) with check(public.is_staff());
create policy settings_public_read on public.store_settings for select using(is_public or public.is_staff());
create policy staff_orders_update on public.orders for update using(public.is_staff()) with check(public.is_staff());
create policy staff_payments_update on public.payments for update using(public.is_staff()) with check(public.is_staff());
create policy staff_promotions_write on public.promotions for all using(public.is_staff()) with check(public.is_staff());
create policy staff_settings_write on public.store_settings for all using(public.is_staff()) with check(public.is_staff());
create policy ai_conversation_owner on public.ai_conversations for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy ai_messages_owner on public.ai_messages for select using(exists(select 1 from public.ai_conversations c where c.id=conversation_id and c.user_id=auth.uid()));
create policy audit_staff_read on public.audit_logs for select using(public.current_role()='admin');

-- Storage: private slips; public menu images. Admin/staff writes only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('menu-images','menu-images',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('payment-slips','payment-slips',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
create policy menu_images_public_read on storage.objects for select using(bucket_id='menu-images');
create policy menu_images_staff_write on storage.objects for all using(bucket_id='menu-images' and public.is_staff()) with check(bucket_id='menu-images' and public.is_staff());
create policy slip_owner_upload on storage.objects for insert with check(bucket_id='payment-slips' and auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text);
create policy slip_staff_read on storage.objects for select using(bucket_id='payment-slips' and public.is_staff());

insert into public.categories(slug,name_th,name_en,sort_order) values ('coffee','กาแฟ','Coffee',1),('non-coffee','เครื่องดื่ม','Non-coffee',2),('food','อาหาร','Food',3),('dessert','เบเกอรี่','Bakery',4) on conflict(slug) do nothing;
insert into public.store_settings(key,value,is_public) values
 ('opening_hours','{"text":"ทุกวัน 07:00–20:00 น.","kitchen_last_order":"19:30"}',true),
 ('delivery','{"fee":30,"free_at":300,"radius_km":5}',true),
 ('promptpay','{"configured":false,"label":"PLACEHOLDER — set in Supabase only"}',false)
on conflict(key) do nothing;

-- ═══════════════════════════════════════════════════════
-- 202608210002_seed_menu.sql
-- ═══════════════════════════════════════════════════════

-- Seed data copied from the existing ImJai Products.csv; no unrelated demo menu.
with rows(sku,category,name_th,description_th,ingredients,price,stock,is_available,is_featured,is_chef_choice,spice_level) as (values
 ('FD-01','food','ข้าวผัดกะเพราหมูสับ ไข่ดาว','เผ็ดกลาง ใส่ไข่ดาว 1 ฟอง เลือกไม่ใส่ผงชูรสได้','ข้าวหอมมะลิ หมูสับ ใบกะเพรา พริก กระเทียม ไข่ไก่',79,18,true,true,true,2),
 ('FD-02','food','ข้าวไข่เจียวหมูสับ','ไข่เจียวนุ่มสไตล์ญี่ปุ่น เสิร์ฟพร้อมข้าวสวยและน้ำจิ้มซีฟู้ด','ข้าวหอมมะลิ ไข่ไก่ หมูสับ ต้นหอม',65,22,true,false,false,0),
 ('FD-03','food','สปาเก็ตตี้คาโบนาร่า','ครีมชีสเบคอน ใส่พาร์เมซานชีส','เส้นสปาเก็ตตี้ เบคอน ครีม พาร์เมซาน ไข่',99,12,true,true,false,0),
 ('FD-04','food','แซนวิชแฮมชีส','ขนมปังโฮลวีต แฮม เชดดาร์ชีส ผักสด','ขนมปัง แฮม ชีส ผักกาด มะเขือเทศ',69,14,true,false,false,0),
 ('FD-05','food','ต้มยำกุ้ง','ต้มยำน้ำข้นรสจัด ใส่กุ้งสด 4 ตัว','กุ้ง ตะไคร้ ข่า ใบมะกรูด เห็ด นมข้นจืด',120,0,false,false,false,4),
 ('DS-01','dessert','เค้กช็อกโกแลต','เนื้อเข้มข้น หน้าเคลือบกานาช','ช็อกโกแลต แป้ง ไข่ เนย ครีม',89,8,true,true,false,0),
 ('DS-02','dessert','ครัวซองต์เนยสด','อบสดทุกเช้า','แป้งสาลี เนย นม ยีสต์',55,10,true,true,true,0),
 ('DS-03','dessert','ชีสเค้กเรดเวลเวท','เนื้อนุ่มครีมชีส','ครีมชีส แป้ง ไข่ โกโก้',95,6,true,false,false,0),
 ('DR-C01','coffee','อเมริกาโน่','เอสเพรสโซ + น้ำร้อน/น้ำแข็ง','เมล็ดกาแฟอาราบิก้า น้ำ',60,40,true,false,false,0),
 ('DR-C02','coffee','ลาเต้','เอสเพรสโซ + นมสด','เอสเพรสโซ นมสด',70,32,true,true,true,0),
 ('DR-C03','coffee','คาปูชิโน่','เอสเพรสโซ + นมสด + ฟองนม','เอสเพรสโซ นมสด',70,30,true,false,false,0),
 ('DR-C04','coffee','มอคค่าเย็น','เอสเพรสโซ + นม + ช็อกโกแลต','เอสเพรสโซ นมสด ช็อกโกแลต',80,24,true,false,false,0),
 ('DR-N01','non-coffee','ชาไทยเย็น','ชาไทย + นมข้น + นมสด','ชาไทย นมข้น นมสด',65,30,true,false,false,0),
 ('DR-N02','non-coffee','มัทฉะลาเต้','มัทฉะเกรดพรีเมียม + นมสด','มัทฉะ นมสด',85,18,true,true,false,0),
 ('DR-N03','non-coffee','น้ำผึ้งมะนาวโซดา','น้ำผึ้ง + มะนาว + โซดา','น้ำผึ้ง มะนาว โซดา',60,28,true,false,false,0),
 ('DR-N04','non-coffee','สมูทตี้สตรอว์เบอร์รี','สตรอว์เบอร์รี + โยเกิร์ต','สตรอว์เบอร์รี โยเกิร์ต นม',90,16,true,false,false,0)
)
insert into public.menu_items(sku,category_id,name_th,description_th,ingredients,price,stock,is_available,is_featured,is_chef_choice,spice_level)
select r.sku,c.id,r.name_th,r.description_th,r.ingredients,r.price,r.stock,r.is_available,r.is_featured,r.is_chef_choice,r.spice_level from rows r join public.categories c on c.slug=r.category
on conflict(sku) do update set category_id=excluded.category_id,name_th=excluded.name_th,description_th=excluded.description_th,ingredients=excluded.ingredients,price=excluded.price,stock=excluded.stock,is_available=excluded.is_available,is_featured=excluded.is_featured,is_chef_choice=excluded.is_chef_choice,spice_level=excluded.spice_level;

insert into public.allergens(slug,name_th,name_en) values ('egg','ไข่','Egg'),('milk','นม','Milk'),('gluten','กลูเตน','Gluten'),('soy','ถั่วเหลือง','Soy'),('shellfish','กุ้งและสัตว์น้ำเปลือกแข็ง','Shellfish') on conflict(slug) do nothing;
insert into public.add_ons(name,price) values ('ไข่ดาว',15),('เพิ่มหมูสับ',25),('เพิ่มชีส',20),('เพิ่มเบคอน',25),('เพิ่มช็อต',20),('นมโอ๊ต',20);
insert into public.coupons(code,discount_type,discount_value,minimum_spend,usage_limit,starts_at,ends_at) values ('IMJAI15','fixed',15,200,null,'2026-01-01','2026-08-31 23:59:59+07') on conflict(code) do nothing;
insert into public.promotions(name,description,discount_type,discount_value,starts_at,ends_at) values ('Coffee & Bakery Pairing','ซื้อกาแฟหรือชา 1 แก้ว + เบเกอรี่ 1 ชิ้น ลด 15 บาท','fixed',15,'2026-01-01','2026-08-31 23:59:59+07');

-- ═══════════════════════════════════════════════════════
-- 202608210003_slip_verification.sql
-- ═══════════════════════════════════════════════════════

-- Slip verification.
--
-- Records what a payment provider said about a transfer, and makes reusing a
-- slip impossible rather than merely unlikely. The unique constraint is the
-- load-bearing part: the shop verifies slips from more than one place (this
-- site and an n8n flow), and a database constraint is the only guard that
-- holds when two of them run at once.

-- The exact figure the QR asked for, satang suffix included. payments.amount
-- holds the order total; this is what the customer was actually told to send,
-- and what an incoming transfer has to match.
alter table public.payments
  add column if not exists payable_amount numeric(10, 2)
    check (payable_amount is null or payable_amount >= 0);

-- Reference read from the QR printed on the customer's slip, normalised
-- upper-case. Unique across every payment: one slip settles one order, ever.
alter table public.payments
  add column if not exists slip_reference text;

-- Partial, so the many rows with no slip yet do not collide on null.
create unique index if not exists payments_slip_reference_key
  on public.payments (slip_reference)
  where slip_reference is not null;

-- Which system reached the verdict, so a disputed order can be traced back to
-- the site, the n8n flow, or a staff member clearing it by hand.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_verifier') then
    create type public.payment_verifier as enum ('provider', 'staff', 'automation');
  end if;
end
$$;

alter table public.payments
  add column if not exists verified_via public.payment_verifier;

-- Provider answer, kept verbatim. Useful when a customer disputes a rejection
-- and the provider's own record is the only account of what happened.
alter table public.payments
  add column if not exists verification jsonb;

-- Plain-language outcome shown to staff in the admin list.
alter table public.payments
  add column if not exists verification_reason text
    check (verification_reason is null or char_length(verification_reason) <= 300);

comment on column public.payments.payable_amount is
  'Amount encoded in the PromptPay QR, including the per-order satang suffix.';
comment on column public.payments.slip_reference is
  'Normalised reference from the slip QR. Unique: a slip can settle one order only.';
comment on column public.payments.verified_via is
  'Which system confirmed or rejected the transfer.';

-- Staff read verification detail through the existing payments policies; this
-- only widens what they may write, and never lets a customer self-approve.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_staff_verify'
  ) then
    create policy payments_staff_verify on public.payments
      for update to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end
$$;

-- ═══════════════════════════════════════════════════════
-- ขั้นสุดท้าย: ตั้งตัวเองเป็นแอดมิน
-- ═══════════════════════════════════════════════════════
--
-- ทำ "หลังจาก" สมัครสมาชิกบนหน้าเว็บด้วยอีเมลของคุณแล้วเท่านั้น
-- เพราะบัญชีต้องมีอยู่ก่อน คำสั่งนี้ถึงจะหาเจอ
--
-- เอาเครื่องหมาย -- ข้างหน้าออก แล้วเปลี่ยนอีเมลเป็นของคุณ จากนั้นกด Run
--
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'อีเมลของคุณ');
--
-- ตรวจว่าสำเร็จไหม:
-- select u.email, p.role from public.profiles p join auth.users u on u.id = p.id;
