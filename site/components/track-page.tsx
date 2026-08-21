'use client';

import { Check, ChefHat, Clock3, PackageCheck, Search, Truck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const steps = [
  { id: 'pending', label: 'รับคำสั่งซื้อแล้ว', note: 'กำลังตรวจสอบรายการ', icon: Clock3 },
  { id: 'confirmed', label: 'ร้านยืนยันออเดอร์', note: 'ครัวได้รับรายการแล้ว', icon: Check },
  { id: 'preparing', label: 'กำลังปรุง', note: 'ทำสดใหม่ให้คุณ', icon: ChefHat },
  { id: 'ready', label: 'พร้อมรับ / พร้อมส่ง', note: 'ใกล้ได้อิ่มใจแล้ว', icon: PackageCheck },
  { id: 'out_for_delivery', label: 'กำลังจัดส่ง', note: 'ไรเดอร์กำลังเดินทาง', icon: Truck },
  { id: 'completed', label: 'สำเร็จ', note: 'ขอบคุณที่อุดหนุนอิ่มใจ', icon: Check },
];

type StoredOrder = { orderNumber: string; phone: string; status: string; createdAt: string; paymentStatus: string; totals: { total: number }; fulfilment: string; lines: { name: string; quantity: number }[] };

export function TrackPage() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get('order') ?? '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<StoredOrder | null>(null);
  const [searched, setSearched] = useState(false);
  const created = params.get('created') === '1';

  useEffect(() => {
    const id = params.get('order');
    if (!id) return;
    const timer = window.setTimeout(() => {
      const orders = JSON.parse(localStorage.getItem('imjai-orders') ?? '[]') as StoredOrder[];
      const found = orders.find((item) => item.orderNumber === id) ?? null;
      setOrder(found); setSearched(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [params]);

  const search = () => {
    const orders = JSON.parse(localStorage.getItem('imjai-orders') ?? '[]') as StoredOrder[];
    const found = orders.find((item) => item.orderNumber.toLowerCase() === orderNumber.trim().toLowerCase() && (!phone || item.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''))) ?? null;
    setOrder(found); setSearched(true);
  };
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === (order?.status ?? 'pending')));

  return <main className="track-page"><section className="page-hero compact"><p className="eyebrow">ORDER TRACKING</p><h1>{created ? 'รับออเดอร์แล้วค่ะ' : 'ออเดอร์ถึงไหนแล้วนะ?'}</h1><p>{created ? 'บันทึกเลขออเดอร์ไว้ แล้วติดตามความอร่อยได้จากหน้านี้' : 'กรอกเลขออเดอร์และเบอร์โทรที่ใช้สั่ง เพื่อดูสถานะล่าสุด'}</p></section>
    <section className="tracking-shell"><div className="track-search"><label>เลขออเดอร์<input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="เช่น IJ260821-AB12" /></label><label>เบอร์โทร<input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="เบอร์ที่ใช้สั่ง (ใช้เมื่อตรวจออเดอร์เดิม)" /></label><button onClick={search}><Search /> ตรวจสอบสถานะ</button></div>
      {order ? <div className="order-tracking-card"><div className="order-overview"><div><p>ORDER NUMBER</p><h2>{order.orderNumber}</h2><span>สั่งเมื่อ {new Date(order.createdAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}</span></div><div className="eta"><Clock3 /><div><small>เวลาโดยประมาณ</small><b>20–30 นาที</b></div></div></div><div className="order-meta"><span><small>ยอดรวม</small><b>฿{order.totals.total}</b></span><span><small>วิธีรับอาหาร</small><b>{order.fulfilment === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'}</b></span><span><small>การชำระเงิน</small><b>{order.paymentStatus === 'pending_verification' ? 'รอตรวจสอบ' : 'ชำระตอนรับอาหาร'}</b></span></div><ol className="timeline">{steps.map((step, index) => { const Icon = step.icon; const done = index <= currentIndex; return <li className={done ? 'done' : ''} key={step.id}><span><Icon /></span><div><b>{step.label}</b><small>{step.note}</small></div>{index === currentIndex && <em>สถานะปัจจุบัน</em>}</li>; })}</ol><div className="order-items"><b>รายการของคุณ</b>{order.lines.map((line, index) => <span key={`${line.name}-${index}`}>{line.quantity} × {line.name}</span>)}</div></div> : searched ? <div className="track-empty"><span>🧾</span><h2>ยังไม่พบออเดอร์นี้</h2><p>ตรวจเลขออเดอร์และเบอร์โทรอีกครั้ง หรือติดต่อร้าน 02-123-4567</p></div> : <div className="track-prompt"><span>🍳</span><h2>พร้อมติดตามทุกขั้นตอน</h2><p>สถานะจะอัปเดตตั้งแต่ร้านรับออเดอร์ กำลังปรุง จนถึงพร้อมรับหรือจัดส่ง</p></div>}
    </section>
  </main>;
}
