# Test Report — ImJai Cafe & Kitchen

วันที่ทดสอบ: 21 สิงหาคม 2569

| รายการ | ผล |
|---|---|
| Unit: คำนวณราคา Add-on | ผ่าน |
| Unit: ค่าจัดส่ง / ฟรีค่าจัดส่ง | ผ่าน |
| Unit: Coupon IMJAI15 และยอดขั้นต่ำ | ผ่าน |
| Security: ไม่มี Service Role / OpenAI key ใน Browser source | ผ่าน |
| Security: ไม่มีการแก้ Role จากหน้า Admin | ผ่าน |
| Production build (Sites/Vinext) | ผ่าน |
| Route smoke test `/`, `/menu`, `/checkout`, `/track`, `/account`, `/admin` | ผ่าน (HTTP 200) |
| E2E: Guest เพิ่มสินค้า (Desktop + Mobile) | ผ่าน |
| E2E: Anonymous เข้า Admin ไม่ได้ (Desktop + Mobile) | ผ่าน |
| Auth/Realtime/Storage integration | รอเชื่อม Supabase Project จริง |

ผล Unit tests: 2 test files, 6 tests ผ่านทั้งหมด

ผล E2E tests: 4 tests ผ่านทั้งหมดบน Chromium (Desktop Chrome และ Mobile viewport)
