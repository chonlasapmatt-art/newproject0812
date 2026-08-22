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

### เพิ่มเข้ามาภายหลัง

- **น้องอิ่มใจตอบจากข้อมูลจริง** (`lib/imjai-brain.ts`) — เมนูสด สต็อกสด ข้อมูลร้าน และออเดอร์
  ของคนที่ถามเท่านั้น แต่งเมนูเองไม่ได้ บอกราคาที่ไม่มีในเมนูไม่ได้ และเปิดออเดอร์คนอื่นไม่ได้
- **แดชบอร์ดที่ใช้เดินร้านได้จริง** — ตัวเลขมาจากออเดอร์จริง เปลี่ยนสถานะแล้วลูกค้าเห็นทันที
  กดยืนยัน/ปฏิเสธสลิปได้ แก้ราคาและสต็อกแล้วหน้าเว็บเปลี่ยนทันที
- **ประตูบัญชีตอนกดลงตะกร้า** (`lib/add-to-cart.ts`) — คนที่ยังไม่ล็อกอินถูกพาไปสมัคร
  แล้วพากลับมาที่เดิมพร้อมของที่กดค้างไว้ และมีปุ่มออกจากระบบในเมนูบัญชี
- **ระบบ motion กลาง** (`lib/motion.ts`) — easing กับ duration ชุดเดียวทั้งเว็บ
  ทุกอย่างปิดตัวเองเมื่อผู้ใช้ตั้ง `prefers-reduced-motion`

### ไฟล์ที่ควรรู้จักก่อนแก้

| ไฟล์ | ทำอะไร |
|---|---|
| `lib/catalog.ts` | เมนูตั้งต้น 16 รายการ ราคา ส่วนประกอบ สารก่อภูมิแพ้ |
| `lib/store-profile.ts` | ข้อมูลร้านทุกอย่างที่หน้าเว็บพูดถึง — แก้ที่นี่ที่เดียวเปลี่ยนทุกหน้า |
| `lib/orders.ts` | ออเดอร์ทั้งหมด สถานะ และตัวเลขสรุปของแดชบอร์ด |
| `lib/menu-admin.ts` | การแก้ราคา/สต็อกจากหลังร้าน ทับลงบน `catalog.ts` |
| `lib/imjai-brain.ts` | สมองของน้องอิ่มใจ — เพิ่มคำถามที่ตอบได้ที่นี่ |
| `lib/promptpay.ts` | สร้าง payload QR ตามมาตรฐาน EMVCo (แก้ระวัง มี test คุมอยู่) |
| `app/globals.css` | สไตล์ทั้งเว็บไฟล์เดียว |

> หมายเหตุ: หน้าเว็บออนไลน์ทำงานในโหมด Guest ได้ทันที ส่วนสมาชิก ฐานข้อมูล Realtime อัปโหลดสลิป Admin และ AI จริงต้องเชื่อม Supabase ของร้านตามขั้นตอนด้านล่าง

## โครงสร้างสำคัญ

```text
app/                  เส้นทางหน้าเว็บ (แต่ละโฟลเดอร์คือ 1 หน้า)
components/           หน้าร้านและส่วนโต้ตอบทั้งหมด
lib/                  ข้อมูล ตรรกะ และ state ที่อยู่นอก React
stores/               Zustand cart store
supabase/migrations/  Schema, RLS, RPC และ seed data
supabase/functions/   create-order, verify-slip และ ai-assistant
tests/                Unit tests (รันด้วย vitest)
e2e/                  Playwright — รันกับไฟล์ที่ export จริง
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

## การชำระเงินด้วยพร้อมเพย์

QR ที่หน้าชำระเงินสร้างสดต่อออเดอร์ ไม่ใช่รูปนิ่ง โดยฝัง **ยอดเงินจริง** ไว้ในตัว QR
ตามมาตรฐาน EMVCo ของธนาคารแห่งประเทศไทย ลูกค้าจึงโอนผิดยอดไม่ได้

แต่ละออเดอร์ได้ **เศษสตางค์เฉพาะตัว** (เช่น ฿237.04) ที่คำนวณจากเลขออเดอร์ ทำให้จับคู่
เงินโอนกับออเดอร์ได้แม่นยำ แม้ลูกค้าสองคนสั่งของเหมือนกันเป๊ะ เศษที่เพิ่มไม่เกิน 1 บาท
และคงเดิมเสมอถ้าลูกค้ากดซ้ำ

ตั้งค่า `NEXT_PUBLIC_PROMPTPAY_ID` เป็นเบอร์พร้อมเพย์ของร้าน ค่านี้ **เปิดเผยได้โดยตั้งใจ**
เพราะมันอยู่ในตัว QR ทุกใบที่เว็บสร้างอยู่แล้ว และเป็นแค่ปลายทางรับเงิน ถอนอะไรไม่ได้

### การตรวจสลิป 2 ชั้น

| ชั้น | ทำอะไร | ยืนยันเงินเข้าได้ไหม |
|---|---|---|
| ในเบราว์เซอร์ | อ่าน QR บนสลิปที่ลูกค้าอัปโหลด จับสลิปที่อ่านไม่ออก | ไม่ได้ |
| `verify-slip` Edge Function | ถาม provider ว่าเลขอ้างอิงนี้โอนจริงกี่บาท เข้าบัญชีไหน | ได้ |

ชั้นแรกเป็นแค่ตัวกรอง **ไม่มีทางคืนค่าว่า "ชำระแล้ว"** ด้วยตัวเอง เพราะ QR บนสลิปเก็บแค่
เลขอ้างอิงไว้เอาไปเช็ค ไม่ได้เก็บยอดเงิน การยืนยันจริงต้องผ่าน provider เท่านั้น

ยอดต้องตรงถึงระดับสตางค์ เพราะเศษสตางค์คือสิ่งที่ผูกเงินโอนเข้ากับออเดอร์ ต่างแม้สตางค์เดียว
ถือว่าเป็นคนละรายการ

### ใช้ API key ร่วมกับ n8n

key เดียวกันเรียกได้จากทั้ง n8n และเว็บ แต่มีผลตามมา 2 ข้อที่ออกแบบรองรับไว้แล้ว:

1. **โควตาแชร์กัน** — free tier นับรวมทั้งสองทาง
2. **ใครตรวจทีหลังจะได้ผลว่า "สลิปซ้ำ"** — `verify-slip` ถือว่ากรณีนี้คือ "ระบบอื่นตรวจไปแล้ว"
   ไม่ใช่ error แล้วส่งต่อให้พนักงานยืนยันขั้นสุดท้าย

ตัวกันซ้ำที่แน่นอนที่สุดคือ unique index บน `payments.slip_reference` ในฐานข้อมูล —
สลิปหนึ่งใบปิดได้ออเดอร์เดียวเท่านั้น ต่อให้ทั้งสองระบบทำงานพร้อมกัน

> `SLIPOK_API_URL` คือ endpoint สำหรับ **ส่งสลิปไปตรวจ** คนละตัวกับ `/api/line/webhook/<id>`
> ที่ LINE กับ n8n ยิงเข้า (branch id เดียวกัน แต่คนละหน้าที่)

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

`.github/workflows/deploy-pages.yml` จะรัน lint → unit tests → build → E2E บนไฟล์ที่ export
จริง แล้วค่อย push ผลลัพธ์ขึ้น branch `gh-pages` — การ push นั้นคือการ deploy

base path ไม่ได้เขียนตายในโค้ด แต่อ่านจากชื่อ repository ผ่าน `PAGES_BASE_PATH`
เปลี่ยนชื่อ repo หรือ fork ไปแล้วลิงก์ยังถูกเสมอ

ตัวแปรที่ตั้งได้ที่ **Settings → Secrets and variables → Actions → Variables**

| Variable | ผลถ้าไม่ตั้ง |
|---|---|
| `NEXT_PUBLIC_ADMIN_EMAILS` | เว็บที่ deploy จะไม่มีแอดมินเลย (ตั้งใจ — อีเมลไม่ควรอยู่ใน repo สาธารณะ) |
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | ทำงานโหมดพรีวิว เก็บข้อมูลในเบราว์เซอร์ |
| `NEXT_PUBLIC_PROMPTPAY_ID` / `..._NAME` | ใช้ค่า default ที่ระบุใน workflow |

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
