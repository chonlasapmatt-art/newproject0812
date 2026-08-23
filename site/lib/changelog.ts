/**
 * What has changed on the site, and what is still to come.
 *
 * The shop asked to see this from the dashboard rather than from a chat
 * window, which is the right instinct: they are the one answering customers
 * when something looks different, and they should not have to ask us what
 * moved. So this file is the record, and it is part of the deploy — a change
 * that ships without a line here is a change the shop finds out about from a
 * customer.
 *
 * Newest first. Keep entries in the shop's language and in terms of what they
 * would notice, not in terms of the code that did it.
 */

export type ChangeKind = 'feature' | 'fix' | 'security' | 'design';

export type Change = {
  /** ISO date, the day it went live. */
  date: string;
  kind: ChangeKind;
  title: string;
  /** What the shop would actually notice. */
  detail: string;
  /** Where on the site to look. */
  where: string;
};

export const KIND_LABEL: Record<ChangeKind, string> = {
  feature: 'ของใหม่',
  fix: 'แก้ปัญหา',
  security: 'ความปลอดภัย',
  design: 'หน้าตา',
};

export const SHIPPED: Change[] = [
  {
    date: '2026-08-22',
    kind: 'fix',
    title: 'ตัวหนังสือหัวข้อไม่โดนตัดอีกแล้ว',
    detail:
      'หัวข้อภาษาไทยเคยโดนกรอบครอบจนสระและวรรณยุกต์ขาดหาย ตอนนี้เอากรอบออกหมดแล้ว ไม่ว่าจะโหลดช้า เน็ตไม่ดี หรือปิดแอนิเมชัน ตัวหนังสือก็ครบเสมอ และมีระบบตรวจอัตโนมัติคอยจับไว้ทุกครั้งที่ deploy',
    where: 'ทุกหน้า',
  },
  {
    date: '2026-08-22',
    kind: 'security',
    title: 'ล็อกอินค้างจากโหมดพรีวิวถูกล้างแล้ว',
    detail:
      'ก่อนหน้านี้การล็อกอินสมัยยังไม่มีฐานข้อมูลค้างอยู่ในเบราว์เซอร์ ทำให้เว็บขึ้นชื่อคุณทั้งที่ฐานข้อมูลไม่รู้จัก ตอนนี้พอเชื่อม Supabase แล้วของเก่าจะถูกทิ้งทันที',
    where: 'หน้าบัญชี',
  },
  {
    date: '2026-08-22',
    kind: 'security',
    title: 'สิทธิ์แอดมินมาจากฐานข้อมูลจริง',
    detail:
      'ใครเป็นแอดมินตัดสินจากตาราง profiles ใน Supabase ไม่ใช่จากค่าที่ฝังมากับเว็บ เบราว์เซอร์เลื่อนขั้นตัวเองไม่ได้ เพราะคอลัมน์ role ถูกถอนสิทธิ์เขียนไว้',
    where: 'แดชบอร์ด',
  },
  {
    date: '2026-08-22',
    kind: 'feature',
    title: 'หน้ายอดขาย อ่านจากออเดอร์จริง',
    detail: 'ยอดขายวันนี้ สัปดาห์นี้ เดือนนี้ เมนูขายดี และช่วงเวลาที่คนสั่งเยอะที่สุด อัปเดตทันทีที่มีออเดอร์เข้า',
    where: 'แดชบอร์ด → ยอดขาย',
  },
  {
    date: '2026-08-22',
    kind: 'feature',
    title: 'เลือกโทนสีเว็บได้ กันแสบตา',
    detail: 'มี 4 แบบ — ตามเครื่อง สว่าง นวลตา และมืด เลือกแล้วจำไว้ข้ามหน้าและข้ามการเปิดใหม่',
    where: 'ปุ่มจอบนหัวเว็บ',
  },
  {
    date: '2026-08-22',
    kind: 'security',
    title: 'แดชบอร์ดมีกุญแจของตัวเอง',
    detail: 'ส่งลิงก์เว็บให้ใครก็เข้าแดชบอร์ดไม่ได้ ต้องมีทั้งบัญชีที่เป็นแอดมินและกุญแจ',
    where: 'แดชบอร์ด',
  },
  {
    date: '2026-08-22',
    kind: 'fix',
    title: 'หน้าต่างซ้อนกลับมาลอยถูกที่',
    detail: 'ตะกร้า เมนูบัญชี กล่องรายละเอียดอาหาร และหน้าจอเปิดเว็บ เคยแสดงผิดตำแหน่ง ตอนนี้ลอยทับถูกต้องแล้ว',
    where: 'ทุกหน้า',
  },
  {
    date: '2026-08-21',
    kind: 'feature',
    title: 'แดชบอร์ดสั่งงานร้านได้จริง',
    detail: 'รับออเดอร์ เปลี่ยนสถานะ แก้ราคา ปิดเมนูที่ของหมด และตั้งโปรโมชัน ทุกอย่างมีผลกับหน้าลูกค้าทันที',
    where: 'แดชบอร์ด',
  },
  {
    date: '2026-08-21',
    kind: 'feature',
    title: 'น้องอิ่มใจตอบคำถามได้เอง',
    detail: 'ถามราคา ส่วนผสม เมนูแนะนำตามงบ อาหารเจ หรือของแพ้ได้ ตอบจากเมนูจริงของร้าน',
    where: 'ปุ่มถามน้องอิ่มใจ',
  },
  {
    date: '2026-08-21',
    kind: 'feature',
    title: 'สมัครสมาชิก ตะกร้า และติดตามออเดอร์',
    detail: 'ลูกค้ามีบัญชีของตัวเอง เก็บตะกร้าไว้ได้ ชำระด้วยพร้อมเพย์พร้อมแนบสลิป และดูสถานะออเดอร์ได้',
    where: 'หน้าเมนู ตะกร้า และติดตามออเดอร์',
  },
];

export type Stage = 'next' | 'later';

export type Planned = {
  title: string;
  detail: string;
  stage: Stage;
  /** What we need from the shop before this can start. */
  needs?: string;
};

export const STAGE_LABEL: Record<Stage, string> = {
  next: 'คิวถัดไป',
  later: 'วางแผนไว้',
};

export const ROADMAP: Planned[] = [
  {
    title: 'ปุ่มทัก LINE OA ตรงจุดที่ลูกค้าติดปัญหา',
    detail: 'วางปุ่มไว้ที่หน้าชำระเงิน หน้าติดตามออเดอร์ และหน้าติดต่อเรา กดแล้วเปิดแชตร้านได้เลย ไม่ต้องหาเบอร์',
    stage: 'next',
    needs: 'LINE OA ID ของร้าน',
  },
  {
    title: 'ส่งออเดอร์ใหม่และผลตรวจสลิปเข้า n8n',
    detail: 'ทุกออเดอร์ที่เข้ามาและทุกสลิปที่ตรวจแล้ว ยิงเข้า n8n ให้อัตโนมัติ เอาไปต่อกับอะไรก็ได้',
    stage: 'next',
    needs: 'Production webhook URL ของ n8n',
  },
  {
    title: 'ตรวจสลิปอัตโนมัติด้วย SlipOK',
    detail: 'อ่านสลิปที่ลูกค้าแนบ เทียบยอดกับออเดอร์ แล้วยืนยันให้เอง ไม่ต้องนั่งไล่ดูทีละใบ',
    stage: 'next',
    needs: 'SlipOK API key และ branch id (ใส่เป็น Secret ใน Supabase)',
  },
  {
    title: 'รีวิวจากลูกค้าจริง',
    detail: 'ตอนนี้รีวิวหน้าแรกเป็นตัวอย่างไว้ดูหน้าตาก่อน ของจริงจะให้ลูกค้าที่สั่งแล้วเขียนได้ และร้านกดอนุมัติก่อนขึ้นหน้าเว็บ',
    stage: 'later',
  },
  {
    title: 'ข้อมูลลูกค้าและที่อยู่เก็บลงฐานข้อมูล',
    detail: 'ที่อยู่จัดส่ง ประวัติการสั่ง และเมนูโปรด ตามไปทุกเครื่องที่ลูกค้าล็อกอิน ไม่ใช่แค่เครื่องเดียว',
    stage: 'later',
  },
  {
    title: 'ออเดอร์ซิงก์ข้ามอุปกรณ์',
    detail: 'เปิดแดชบอร์ดจากมือถือหรือแท็บเล็ตเครื่องไหนก็เห็นออเดอร์ชุดเดียวกัน แบบเรียลไทม์',
    stage: 'later',
  },
  {
    title: 'แจ้งเตือนออเดอร์ใหม่เข้ามือถือ',
    detail: 'มีออเดอร์เข้าแล้วเด้งเตือนทันที ไม่ต้องเฝ้าหน้าจอ',
    stage: 'later',
  },
];
