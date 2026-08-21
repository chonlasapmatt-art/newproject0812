'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, ChevronLeft, MapPin, QrCode, ShieldCheck, Store, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { cartTotals, lineTotal } from '../lib/cart';
import { STORE } from '../lib/catalog';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useCartStore } from '../stores/cart-store';

const schema = z.object({
  name: z.string().trim().min(2, 'กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร').max(100),
  phone: z.string().trim().regex(/^0[0-9]{8,9}$/, 'กรุณากรอกเบอร์โทรให้ถูกต้อง'),
  fulfilment: z.enum(['pickup', 'delivery']),
  address: z.string().trim().max(300).optional(),
  note: z.string().trim().max(300).optional(),
  payment: z.enum(['cash', 'promptpay']),
  coupon: z.string().trim().max(30).optional(),
}).superRefine((value, context) => {
  if (value.fulfilment === 'delivery' && (!value.address || value.address.length < 10)) context.addIssue({ code: 'custom', path: ['address'], message: 'กรุณากรอกที่อยู่จัดส่งโดยละเอียด' });
});

type CheckoutValues = z.infer<typeof schema>;

export function CheckoutPage() {
  const router = useRouter();
  const { lines, coupon, setCoupon, clear } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const { register, handleSubmit, control, formState: { errors } } = useForm<CheckoutValues>({ resolver: zodResolver(schema), defaultValues: { fulfilment: 'pickup', payment: 'cash', coupon } });
  const fulfilment = useWatch({ control, name: 'fulfilment' });
  const payment = useWatch({ control, name: 'payment' });
  const watchedCoupon = useWatch({ control, name: 'coupon' }) ?? '';
  const totals = useMemo(() => cartTotals(lines, fulfilment === 'delivery', watchedCoupon), [lines, fulfilment, watchedCoupon]);

  const onSubmit = async (values: CheckoutValues) => {
    if (!lines.length || totals.subtotal < STORE.minimumOrder) return;
    if (values.payment === 'promptpay' && !slip) return;
    setSubmitting(true);
    const idempotencyKey = crypto.randomUUID();
    const orderNumber = `IJ${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${idempotencyKey.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
    const draft = { orderNumber, idempotencyKey, ...values, lines, totals, status: 'pending', createdAt: new Date().toISOString(), paymentStatus: values.payment === 'promptpay' ? 'pending_verification' : 'unpaid' };
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.functions.invoke('create-order', { body: { idempotencyKey, customer: { name: values.name, phone: values.phone }, fulfilment: values.fulfilment, address: values.address, note: values.note, paymentMethod: values.payment, coupon: values.coupon, items: lines.map((line) => ({ sku: line.sku, quantity: line.quantity, options: line.options, addOns: line.addOns?.map((item) => item.name), note: line.note })) } });
        if (error) throw error;
        draft.orderNumber = data.orderNumber;
      }
      const orders = JSON.parse(localStorage.getItem('imjai-orders') ?? '[]');
      localStorage.setItem('imjai-orders', JSON.stringify([draft, ...orders].slice(0, 20)));
      setCoupon(values.coupon ?? ''); clear();
      router.push(`/track?order=${encodeURIComponent(draft.orderNumber)}&created=1`);
    } catch {
      setSubmitting(false);
      alert('ยังส่งออเดอร์ไม่ได้ กรุณาลองอีกครั้งหรือติดต่อร้านที่ 02-123-4567');
    }
  };

  if (!lines.length) return <main className="checkout-empty"><span>🧺</span><h1>ตะกร้ายังว่างอยู่</h1><p>เลือกเมนูที่อยากทานก่อน แล้วค่อยกลับมายืนยันออเดอร์นะคะ</p><Link prefetch={false} className="primary-button" href="/menu">กลับไปเลือกเมนู</Link></main>;
  return <main className="checkout-page"><div className="checkout-heading"><Link prefetch={false} href="/menu"><ChevronLeft /> กลับไปเลือกเมนู</Link><p className="eyebrow">SECURE CHECKOUT</p><h1>ยืนยันความอร่อย</h1><p>ตรวจรายการและเลือกวิธีรับอาหารก่อนส่งออเดอร์</p></div>
    <form onSubmit={handleSubmit(onSubmit)} className="checkout-layout">
      <div className="checkout-form-stack">
        <section className="form-card"><div className="form-card-title"><span>1</span><div><h2>ข้อมูลผู้สั่ง</h2><p>ใช้สำหรับติดต่อเรื่องออเดอร์นี้เท่านั้น</p></div></div><div className="field-grid"><label>ชื่อผู้สั่ง<input {...register('name')} autoComplete="name" placeholder="ชื่อ–นามสกุล" />{errors.name && <small>{errors.name.message}</small>}</label><label>เบอร์โทร<input {...register('phone')} inputMode="tel" autoComplete="tel" placeholder="08X-XXX-XXXX" />{errors.phone && <small>{errors.phone.message}</small>}</label></div></section>
        <section className="form-card"><div className="form-card-title"><span>2</span><div><h2>เลือกรับอาหาร</h2><p>รับที่ร้านได้เร็วที่สุด หรือให้เราไปส่ง</p></div></div><div className="choice-grid"><label className={fulfilment === 'pickup' ? 'selected' : ''}><input type="radio" value="pickup" {...register('fulfilment')} /><Store /><b>รับที่ร้าน</b><small>พร้อมรับประมาณ 20–30 นาที</small></label><label className={fulfilment === 'delivery' ? 'selected' : ''}><input type="radio" value="delivery" {...register('fulfilment')} /><Truck /><b>จัดส่ง</b><small>ประมาณ 30–45 นาที</small></label></div>{fulfilment === 'delivery' && <label className="full-field"><span><MapPin size={16} /> ที่อยู่จัดส่ง</span><textarea {...register('address')} rows={3} placeholder="บ้านเลขที่ อาคาร ชั้น ถนน แขวง เขต และจุดสังเกต" />{errors.address && <small>{errors.address.message}</small>}</label>}</section>
        <section className="form-card"><div className="form-card-title"><span>3</span><div><h2>วิธีชำระเงิน</h2><p>ร้านจะยืนยันการชำระเงินหลังตรวจสอบแล้ว</p></div></div><div className="payment-options"><label className={payment === 'cash' ? 'selected' : ''}><input type="radio" value="cash" {...register('payment')} /><span>💵</span><div><b>เงินสดตอนรับอาหาร</b><small>ชำระเมื่อรับที่ร้านหรือปลายทาง</small></div></label><label className={payment === 'promptpay' ? 'selected' : ''}><input type="radio" value="promptpay" {...register('payment')} /><QrCode /><div><b>พร้อมเพย์ QR</b><small>อัปโหลดสลิปเพื่อรอตรวจสอบ</small></div></label></div>{payment === 'promptpay' && <div className="promptpay-panel"><div className="qr-placeholder"><QrCode /><span>QR ร้านค้า</span><small>PLACEHOLDER</small></div><div><b>สแกนหลังร้านใส่ข้อมูล PromptPay จริง</b><p>ยอดชำระ {`฿${totals.total}`}</p><label className="slip-upload">อัปโหลดสลิป (JPG, PNG หรือ WebP ไม่เกิน 5MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && file.size <= 5_000_000 && ['image/jpeg','image/png','image/webp'].includes(file.type)) setSlip(file); else setSlip(null); }} /></label>{slip && <small className="valid-file"><CheckCircle2 /> {slip.name}</small>}</div></div>}</section>
        <section className="form-card"><div className="form-card-title"><span>4</span><div><h2>หมายเหตุ</h2><p>รายละเอียดเพิ่มเติมสำหรับร้านหรือคนส่ง</p></div></div><label className="full-field"><textarea {...register('note')} rows={3} placeholder="เช่น โทรก่อนถึง ฝากไว้ที่ล็อบบี้" /></label></section>
      </div>
      <aside className="order-summary"><h2>สรุปออเดอร์</h2><div className="summary-lines">{lines.map((line) => <div key={line.id}><span className="summary-emoji">{line.emoji}</span><div><b>{line.name}</b><small>{line.quantity} × ฿{line.unitPrice}{line.options?.length ? ` · ${line.options.join(', ')}` : ''}</small></div><strong>฿{lineTotal(line)}</strong></div>)}</div><label className="summary-coupon">คูปอง<input {...register('coupon')} placeholder="IMJAI15" /></label><dl><div><dt>ยอดสินค้า</dt><dd>฿{totals.subtotal}</dd></div><div><dt>ส่วนลด</dt><dd>-฿{totals.discount}</dd></div><div><dt>ค่าจัดส่ง</dt><dd>{totals.deliveryFee ? `฿${totals.deliveryFee}` : 'ฟรี'}</dd></div><div className="summary-total"><dt>ยอดรวมสุทธิ</dt><dd>฿{totals.total}</dd></div></dl>{totals.subtotal < STORE.minimumOrder && <p className="order-warning">ยอดสั่งซื้อขั้นต่ำ ฿{STORE.minimumOrder} กรุณาเพิ่มอีก ฿{STORE.minimumOrder - totals.subtotal}</p>}{payment === 'promptpay' && !slip && <p className="order-warning">กรุณาอัปโหลดสลิปก่อนส่งออเดอร์</p>}<button className="place-order" disabled={submitting || totals.subtotal < STORE.minimumOrder || (payment === 'promptpay' && !slip)}>{submitting ? 'กำลังส่งออเดอร์…' : `ยืนยันออเดอร์ · ฿${totals.total}`}</button><p className="secure-note"><ShieldCheck /> ราคาและสิทธิ์ส่วนลดจะตรวจซ้ำที่ระบบร้าน การชำระเงินจะแสดง “รอตรวจสอบ” จนกว่าพนักงานยืนยัน</p></aside>
    </form>
  </main>;
}
