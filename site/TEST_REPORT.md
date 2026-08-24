# Test Report — ImJai Cafe & Kitchen

วันที่ทดสอบ: 24 สิงหาคม 2569

| รายการ | ผล |
|---|---|
| Unit: คำนวณราคา Add-on | ผ่าน |
| Unit: ค่าจัดส่ง / ฟรีค่าจัดส่ง | ผ่าน |
| Unit: Coupon IMJAI15 และยอดขั้นต่ำ | ผ่าน |
| Security: ไม่มี Service Role / OpenAI key ใน Browser source | ผ่าน |
| Security: ไม่มีการแก้ Role จากหน้า Admin | ผ่าน |
| Security: Edge Functions บังคับ JWT และตรวจเจ้าของออเดอร์ | ผ่าน |
| Security: ราคา/ส่วนลด/ยอด QR คำนวณและล็อกจาก Server | ผ่าน |
| Security: กันสลิปซ้ำและกันคำขอตรวจสลิปชนกัน | ผ่าน |
| Security: LINE Account Linking ใช้ nonce แบบ hash/ครั้งเดียว/หมดอายุ และ Edge bridge ตรวจ shared secret | ผ่าน |
| Production static build (Next.js/GitHub Pages) | ผ่าน |
| Static routes รวม `/account/link-line` | ผ่าน (13 หน้า prerender สำเร็จ) |
| E2E: Guest เพิ่มสินค้า (Desktop + Mobile) | ผ่าน |
| E2E: Anonymous เข้า Admin ไม่ได้ (Desktop + Mobile) | ผ่าน |
| E2E: UI/Responsive/Accessibility/Checkout preview | ผ่าน 96 รายการ |
| E2E: หน้าเชื่อม LINE ลิงก์ผิด/ลิงก์ถูกแต่ยังไม่ล็อกอิน | ผ่าน 4 รายการ (Desktop + Mobile) |
| Auth/Realtime/Private Storage กับ Project จริง | รอ deploy โค้ดชุดนี้แล้วทดสอบ Live |

ผล Unit tests: 13 test files, 119 tests ผ่านทั้งหมด

ผล E2E เดิม: 96 tests ผ่านทั้งหมด และ E2E หน้าเชื่อม LINE ใหม่ 4 tests ผ่านทั้งหมด
บน Chromium (Desktop Chrome และ Mobile viewport)

หมายเหตุ: รายงานนี้ยืนยันโค้ดและไฟล์ Production build บนเครื่องพัฒนา ยังไม่ได้ยืนยันว่า
SQL/Edge Functions ชุดใหม่ทำงานบน Project จริงจนกว่าจะได้รับอนุมัติ Push และ Publish
