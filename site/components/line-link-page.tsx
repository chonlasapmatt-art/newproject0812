'use client';

import { Link2, MessageCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { beginLineAccountLink, validLineLinkToken } from '../lib/line-account';
import { useSession } from '../lib/session';

export function LineLinkPage() {
  const params = useSearchParams();
  const session = useSession();
  const linkToken = params.get('linkToken');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!validLineLinkToken(linkToken)) {
    return <main className="line-link-page"><section className="line-link-card error">
      <MessageCircle />
      <h1>ลิงก์นี้ใช้ไม่ได้แล้ว</h1>
      <p>กลับไปที่แชท LINE แล้วพิมพ์ <b>เชื่อมบัญชี</b> เพื่อขอลิงก์ใหม่ค่ะ</p>
    </section></main>;
  }

  const next = `/account/link-line/?linkToken=${encodeURIComponent(linkToken)}`;
  if (session.status !== 'signed-in') {
    return <main className="line-link-page"><section className="line-link-card">
      <Link2 />
      <p className="eyebrow">CONNECT LINE</p>
      <h1>เข้าสู่ระบบก่อนเชื่อม LINE</h1>
      <p>ระบบจะเชื่อม LINE นี้กับสมาชิกเว็บ เพื่อให้น้องอิ่มใจตอบสถานะออเดอร์ของคุณได้โดยไม่ต้องถามเบอร์โทรซ้ำ</p>
      <Link className="primary-button" href={`/account?next=${encodeURIComponent(next)}`}>เข้าสู่ระบบ / สมัครสมาชิก</Link>
      <small><ShieldCheck /> ลิงก์ยืนยันใช้ครั้งเดียวและหมดอายุภายใน 10 นาที</small>
    </section></main>;
  }

  const confirm = async () => {
    setBusy(true);
    setMessage('');
    try {
      const url = await beginLineAccountLink(linkToken);
      window.location.assign(url);
    } catch {
      setMessage('สร้างคำขอเชื่อมไม่สำเร็จ กรุณากลับไปขอลิงก์ใหม่ใน LINE');
      setBusy(false);
    }
  };

  return <main className="line-link-page"><section className="line-link-card">
    <Link2 />
    <p className="eyebrow">CONNECT LINE</p>
    <h1>เชื่อมบัญชีกับ LINE นี้?</h1>
    <p>สมาชิกเว็บ <b>{session.user?.email}</b> จะถูกเชื่อมกับ LINE ที่คุณกำลังใช้อยู่ และ LINE จะดูได้เฉพาะออเดอร์ของบัญชีนี้ค่ะ</p>
    <button className="primary-button" type="button" onClick={confirm} disabled={busy}>
      {busy ? 'กำลังพาไปยืนยัน…' : 'ยืนยันเชื่อมบัญชี'}
    </button>
    {message && <p className="form-message" role="status">{message}</p>}
    <small><ShieldCheck /> ระบบไม่ขอรหัสผ่าน LINE และไม่เปิดเผยออเดอร์ของสมาชิกคนอื่น</small>
  </section></main>;
}
