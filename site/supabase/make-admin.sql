-- ═══════════════════════════════════════════════════════
--  ตั้งตัวเองเป็นแอดมิน (เปิดแดชบอร์ดได้)
-- ═══════════════════════════════════════════════════════
--
--  ทำก่อน: ต้องมีบัญชีอยู่แล้ว
--  Supabase → Authentication → Users → Add user
--    • Email / Password ของคุณ
--    • ✅ ติ๊ก "Auto Confirm User"  ← สำคัญ ไม่ต้องรอเมลยืนยัน
--
--  แล้วค่อยมารันไฟล์นี้
--  1) แก้อีเมลในบรรทัด target ให้เป็นของคุณ
--  2) กด Run
--
--  ถ้ายังไม่มีบัญชี คำสั่งนี้จะ "ขึ้นแดงพร้อมบอกเหตุผล"
--  ไม่ใช่ขึ้น Success เฉยๆ แบบที่ทำให้เข้าใจผิดได้

do $$
declare
  target  text := 'อีเมลของคุณ@example.com';   -- ⬅️ แก้ตรงนี้
  touched int;
begin
  update public.profiles p
     set role = 'admin', is_active = true
   where p.id = (select u.id from auth.users u where lower(u.email) = lower(trim(target)));

  get diagnostics touched = row_count;

  if touched = 0 then
    raise exception
      'ยังไม่มีบัญชี "%" ในระบบ — ไปสร้างที่ Authentication → Users → Add user (ติ๊ก Auto Confirm User) ก่อน แล้วรันไฟล์นี้ใหม่', target;
  end if;

  raise notice 'สำเร็จ — % เป็นแอดมินแล้ว', target;
end $$;

-- ผลลัพธ์จริง อ่านจากตารางนี้ (ต้องเห็น role = admin และ ยืนยันอีเมลแล้ว = true)
select u.email,
       p.role,
       p.is_active,
       (u.email_confirmed_at is not null) as ยืนยันอีเมลแล้ว
from public.profiles p
join auth.users u on u.id = p.id
order by (p.role = 'admin') desc, u.email;
