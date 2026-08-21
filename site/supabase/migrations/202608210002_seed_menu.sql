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
