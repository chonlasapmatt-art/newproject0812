# ImJai Cafe & Kitchen — เว็บร้านอาหารอิ่มใจ

เว็บหน้าร้านรุ่นใหม่ของ **ImJai Cafe & Kitchen / อิ่มใจ** รองรับลูกค้าทั่วไป สมาชิก พนักงาน และผู้ดูแลระบบ โดยเก็บเมนูและข้อมูลร้านจากระบบเดิมไว้ครบ 16 รายการ

## สิ่งที่ใช้งานได้ในเวอร์ชันนี้

- หน้าแรก Responsive โทนครีม กาแฟ เขียวธรรมชาติ และส้มอุ่น
- เมนู 16 รายการจาก `data/Products.csv` เดิม ค้นหา กรอง และเรียงลำดับได้
- ตัวเลือกความหวาน อุณหภูมิ ขนาด ระดับเผ็ด Add-on หมายเหตุ และสินค้าหมด
- ตะกร้า Guest ใน `localStorage` เพิ่ม/ลด/ลบ คำนวณ Add-on คูปอง ค่าจัดส่ง และยอดขั้นต่ำ
- Checkout แบบรับที่ร้านหรือจัดส่ง พร้อมเงินสดหรือ PromptPay/อัปโหลดสลิป
- สร้างเลขออเดอร์แบบไม่ซ้ำและป้องกันกดซ้ำด้วย idempotency key
- ติดตามออเดอร์พร้อม Timeline และสถานะการตรวจชำระเงิน
- สมัคร เข้าสู่ระบบ ลืมรหัสผ่าน และ Session ผ่าน Supabase Auth เมื่อเชื่อม Project จริง
- รวมตะกร้า Guest หลัง Login ผ่านฟังก์ชัน `merge_guest_cart`
- หน้า `/admin` ตรวจ Role จาก Backend; ผู้ใช้ทั่วไปไม่เห็นข้อมูลหลังร้าน
- AI Assistant แบบปลอดภัยสำหรับคำถามพื้นฐาน และ Edge Function สำหรับต่อ OpenAI จริง
- SQL migrations, RLS, Storage policies, seed menu, Edge Functions, Unit tests และ Playwright
- SEO metadata, Open Graph, Restaurant structured data, `sitemap.xml`, `robots.txt`

> หมายเหตุ: หน้าเว็บออนไลน์ทำงานในโหมด Guest ได้ทันที ส่วนสมาชิก ฐานข้อมูล Realtime อัปโหลดสลิป Admin และ AI จริงต้องเชื่อม Supabase ของร้านตามขั้นตอนด้านล่าง

## โครงสร้างสำคัญ

```text
app/                  เส้นทางหน้าเว็บ
components/           หน้าร้านและส่วนโต้ตอบ
lib/                  ข้อมูลเมนู การคำนวณ และ Supabase client
stores/               Zustand cart store
supabase/migrations/  Schema, RLS, RPC และ seed data
supabase/functions/   create-order และ ai-assistant
tests/                Unit/security tests
e2e/                  Playwright critical paths
public/og.png         ภาพพรีวิวเวลาแชร์ลิงก์
menu-image-prompts.json  Prompt สำหรับภาพเมนูจริง 16 รายการ
```

## ตัวแปร Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วแก้เฉพาะค่าของ Project ตัวเอง

| ตัวแปร | ใช้ที่ | เปิดเผยใน Browser ได้หรือไม่ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | ได้ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Frontend | ได้ (ต้องใช้ RLS) |
| `NEXT_PUBLIC_SITE_URL` | Metadata/CORS | ได้ |
| `NEXT_PUBLIC_ADMIN_PREVIEW_MODE` | Local preview เท่านั้น | ได้ แต่ Production ต้อง `false` |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | ห้าม |
| `OPENAI_API_KEY` | `ai-assistant` Edge Function | ห้าม |
| `OPENAI_MODEL` | Edge Function | ห้ามเปิดเผยโดยไม่จำเป็น |
| `CORS_ALLOWED_ORIGINS` | Edge Functions | ไม่ใช่ Secret |
| `PROMPTPAY_ID` | Edge Function/Private setting | ห้ามใส่จริงใน Repository |

## รันบนเครื่อง

ต้องใช้ Node.js 22.13 ขึ้นไป

```bash
npm install
cp .env.example .env.local
npm run dev
```

เปิด `http://localhost:3000`

## ตั้งค่า Supabase

1. สร้าง Supabase Project ใหม่และเก็บ URL กับ public anon key
2. ติดตั้ง Supabase CLI แล้ว Login
3. เชื่อม Project และรัน migrations

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

4. ที่ Authentication > URL Configuration ใส่ Site URL และ Redirect URLs ของ Production
5. เปิด Email confirmation ตามนโยบายร้าน
6. ตั้งค่า Secret สำหรับ Edge Functions โดยไม่ใส่ค่าไว้ใน Frontend

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... CORS_ALLOWED_ORIGINS=https://YOUR_DOMAIN PROMPTPAY_ID=...
supabase functions deploy create-order
supabase functions deploy ai-assistant
```

7. ให้ Admin คนแรกผ่าน SQL Editor โดยทำครั้งเดียวจากระบบหลังบ้าน

```sql
update public.profiles set role = 'admin' where id = 'AUTH_USER_UUID';
```

Role ไม่สามารถแก้จาก Frontend ได้ และ RLS ป้องกันการแก้ `role`/`is_active` ของตนเอง

## การจัดการรูป

- Bucket `menu-images` อ่านสาธารณะ แต่เขียนได้เฉพาะ staff/admin
- Bucket `payment-slips` เป็น Private จำกัดไฟล์ JPG/PNG/WebP ไม่เกิน 5MB
- `menu-image-prompts.json` เก็บ Prompt และชื่อไฟล์ภาษาอังกฤษครบ 16 รายการ
- ตอนนี้หน้าเว็บใช้ภาพประกอบ Placeholder ที่เปลี่ยนเป็น WebP จริงได้โดยไม่กระทบข้อมูลเมนู

## Tests

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

เส้นทาง E2E ที่เตรียมไว้ครอบคลุม Guest เพิ่มสินค้า และป้องกันผู้ใช้ทั่วไปเข้าหน้า Admin สามารถเพิ่มบัญชีทดสอบ Supabase เพื่อครอบคลุม Auth/Realtime เต็มรูปแบบหลังเชื่อม Backend จริง

## Deploy ด้วย GitHub Pages

Workflow ที่ Repository root จะ Build แบบ Static Export โดยใช้ base path:

```text
/restaurant-im-jai-ai-agent/
```

ตั้งค่า Repository > Settings > Pages > Source เป็น **GitHub Actions** แล้ว Push ไป branch `main` หรือ branch ที่ระบุใน Workflow

## Deploy Backend

Supabase ดูแล PostgreSQL, Auth, Storage, Realtime และ Edge Functions ส่วนเว็บ Frontend ไม่เก็บ Service Role Key, OpenAI Key หรือ PromptPay จริง

## จุดที่เจ้าของร้านต้องใส่ข้อมูลจริง

1. Supabase URL / anon key และ Project ref
2. PromptPay ID/QR ของร้านใน Private setting หรือ Edge Function secret
3. OpenAI API key ใน Supabase Edge Function เท่านั้น
4. Domain จริงและ CORS allowlist
5. บัญชี admin/staff ชุดแรก
6. ภาพเมนู WebP/PNG จริงจาก Prompt ที่เตรียมไว้
7. LINE OA URL, Social links และข้อมูลโทรศัพท์/ที่อยู่ หากค่าปัจจุบันเป็น Placeholder

## หลักความปลอดภัยสำคัญ

- Backend คำนวณราคาจากฐานข้อมูลใหม่ทุกครั้ง ห้ามเชื่อยอดจาก Frontend
- Order RPC ทำงานใน Transaction และรับ idempotency key
- ผู้ใช้ดูเฉพาะข้อมูลของตัวเอง ส่วน staff/admin ตรวจด้วย RLS ทุก API
- สลิปอยู่ใน Private bucket และยังเป็น `pending_verification` จนพนักงานยืนยัน
- AI ไม่มีสิทธิ์แก้ราคา ยืนยันชำระเงิน หรือสร้างออเดอร์สุดท้ายแทนลูกค้า
- Error ตอบแบบทั่วไปและไม่ส่งรายละเอียดระบบหรือ Secret กลับ Browser
