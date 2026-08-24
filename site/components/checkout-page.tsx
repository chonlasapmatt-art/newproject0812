'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, ChevronLeft, MapPin, QrCode, ShieldCheck, Store, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useSyncExternalStore, type AnimationEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { cartTotals, lineTotal } from '../lib/cart';
import { STORE } from '../lib/catalog';
import { checkoutErrorMessage, lineHintOrderNumber } from '../lib/checkout-errors';
import { decodeSlipImage } from '../lib/decode-slip-image';
import { getOrderRef, getServerOrderRef, renewOrderRef, subscribeOrderRef } from '../lib/order-ref';
import { LineButton } from './line-button';
import { notify } from '../lib/n8n';
import { addOrder, type StoredOrder } from '../lib/orders';
import { rise } from '../lib/motion';
import { buildPromptPayPayload, describeAmount } from '../lib/promptpay';
import { useCan, useSession } from '../lib/session';
import { slipReference } from '../lib/slip-verify';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { PromptPayCard } from './promptpay-card';
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

type ServerQuote = {
  orderId: string;
  orderNumber: string;
  totals: StoredOrder['totals'];
  payableAmount: number;
  values: CheckoutValues;
  lines: StoredOrder['lines'];
};

/**
 * Where checkout sits in the whole order journey — purely an orientation
 * marker, not a routed wizard. The four form cards below stay a single page
 * on purpose: splitting them into real steps would mean re-deriving the
 * submit and idempotency logic per step, for a form short enough that nobody
 * asked for that. "ตะกร้า" is already behind the customer by the time they
 * land here, and this page itself covers both delivery choice and payment.
 */
function CheckoutProgress() {
  const steps: { label: string; state: 'done' | 'current' | 'upcoming' }[] = [
    { label: 'ตะกร้า', state: 'done' },
    { label: 'วิธีรับสินค้า', state: 'current' },
    { label: 'ชำระเงิน', state: 'current' },
    { label: 'สำเร็จ', state: 'upcoming' },
  ];
  return (
    <ol className="checkout-progress" aria-label="ขั้นตอนการสั่งซื้อ">
      {steps.map((step) => (
        <li className={step.state} key={step.label}>
          <span>{step.state === 'done' && <CheckCircle2 size={13} />}</span>
          <b>{step.label}</b>
        </li>
      ))}
    </ol>
  );
}

export function CheckoutPage() {
  const router = useRouter();
  // Browsing and filling a basket stay open to everyone; an account is asked
  // for once, here, where it starts paying for itself in order history.
  const { canOrder } = useCan();
  const session = useSession();
  const { lines, coupon, setCoupon, clear } = useCartStore();
  const [submitting, setSubmitting] = useState(false);
  const [slip, setSlip] = useState<File | null>(null);
  const [uploadedSlipPath, setUploadedSlipPath] = useState<string | null>(null);
  const [serverQuote, setServerQuote] = useState<ServerQuote | null>(null);
  // Result of reading the QR on the uploaded slip. The reference travels with
  // the order so the server can reject a slip already spent on another one.
  const [slipScan, setSlipScan] = useState<
    { state: 'scanning' } | { state: 'read'; reference: string } | { state: 'unreadable' } | null
  >(null);

  const onSlipChange = async (file: File | null) => {
    setUploadedSlipPath(null);
    const accepted =
      file && file.size <= 5_000_000 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
    if (!accepted) {
      setSlip(null);
      setSlipScan(null);
      return;
    }
    setSlip(file);
    setSlipScan({ state: 'scanning' });
    const { payload } = await decodeSlipImage(file);
    const reference = slipReference(payload);
    setSlipScan(reference ? { state: 'read', reference } : { state: 'unreadable' });
  };
  const { register, handleSubmit, control, setFocus, formState: { errors } } = useForm<CheckoutValues>({ resolver: zodResolver(schema), defaultValues: { fulfilment: 'pickup', payment: 'cash', coupon } });
  const fulfilment = useWatch({ control, name: 'fulfilment' });
  const payment = useWatch({ control, name: 'payment' });
  const watchedCoupon = useWatch({ control, name: 'coupon' }) ?? '';
  const totals = useMemo(() => cartTotals(lines, fulfilment === 'delivery', watchedCoupon), [lines, fulfilment, watchedCoupon]);

  // Null while server-rendering, stable thereafter — see lib/order-ref.
  const orderRef = useSyncExternalStore(subscribeOrderRef, getOrderRef, getServerOrderRef);

  const promptPayId = process.env.NEXT_PUBLIC_PROMPTPAY_ID ?? '';
  const promptPayName = process.env.NEXT_PUBLIC_PROMPTPAY_NAME ?? STORE.name;

  // Production QR figures come back from the server after it has priced and
  // recorded the order. The local calculation remains only for preview builds
  // with no database, so the demo flow still works without pretending it is a
  // bank-authoritative total.
  const charge = useMemo(() => {
    if (payment !== 'promptpay') return null;
    const amounts = serverQuote
      ? { baseTotal: serverQuote.totals.total, payable: serverQuote.payableAmount, surcharge: serverQuote.payableAmount - serverQuote.totals.total, display: serverQuote.payableAmount.toFixed(2) }
      : !isSupabaseConfigured && orderRef && totals.total > 0
        ? describeAmount(totals.total, orderRef.orderNumber)
        : null;
    if (!amounts) return null;
    try {
      return { ...amounts, payload: buildPromptPayPayload(promptPayId, amounts.payable) };
    } catch {
      return null; // PromptPay id missing or malformed — fall back to the notice below
    }
  }, [orderRef, payment, totals.total, promptPayId, serverQuote]);

  /**
   * Which card holds each field, so a rejected submit can point at it.
   *
   * The four sections scroll past a phone screen one at a time, and an error
   * message two sections above the button is one nobody sees. The card shakes
   * to say where the problem is and the field takes focus, which scrolls it
   * into view and puts the caret where the fix goes.
   */
  const CARD_OF: Record<string, number> = { name: 1, phone: 1, address: 2, payment: 3 };
  const [refusedCard, setRefusedCard] = useState<number | null>(null);

  const onInvalid = (issues: Record<string, unknown>) => {
    const firstField = Object.keys(issues)[0];
    setRefusedCard(CARD_OF[firstField] ?? 1);
    if (firstField in CARD_OF) setFocus(firstField as keyof CheckoutValues);
  };

  // The shake clears itself when it ends rather than on a timer, so the CSS
  // owns the duration and there is no second copy of it here to drift.
  // Only the card's own animation counts; children animate too and bubble.
  const cardProps = (index: number) => ({
    className: `form-card${refusedCard === index ? ' is-refused' : ''}`,
    onAnimationEnd: (event: AnimationEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) setRefusedCard(null);
    },
  });

  const onSubmit = async (values: CheckoutValues) => {
    if (!lines.length) return;
    if (!canOrder) return;
    if (!orderRef) return;
    const needsSlipNow = values.payment === 'promptpay' && (Boolean(serverQuote) || !isSupabaseConfigured);
    if (needsSlipNow && !slip) return;
    setSubmitting(true);
    try {
      let quote = serverQuote;
      if (isSupabaseConfigured) {
        if (!supabase || !session.user?.id) throw new Error('authentication_required');
        if (!quote) {
          const quotedLines = lines.map((line) => ({
            ...line,
            options: [...(line.options ?? [])],
            addOns: (line.addOns ?? []).map((addOn) => ({ ...addOn })),
          }));
          const { data, error } = await supabase.functions.invoke('create-order', {
            body: {
              idempotencyKey: orderRef.idempotencyKey,
              customer: { name: values.name, phone: values.phone },
              fulfilment: values.fulfilment,
              address: values.address,
              note: values.note,
              paymentMethod: values.payment,
              coupon: values.coupon,
              items: quotedLines.map((line) => ({
                sku: line.sku,
                quantity: line.quantity,
                options: line.options,
                addOns: line.addOns?.map((item) => item.name),
                note: line.note,
              })),
            },
          });
          if (error || !data?.orderNumber) throw error ?? new Error('invalid_order_quote');
          quote = {
            orderId: String(data.orderId ?? ''),
            orderNumber: String(data.orderNumber),
            totals: {
              subtotal: Number(data.subtotal),
              discount: Number(data.discount),
              deliveryFee: Number(data.deliveryFee),
              total: Number(data.total),
            },
            payableAmount: Number(data.payableAmount),
            values: { ...values },
            lines: quotedLines,
          };
          if (values.payment === 'promptpay') {
            setServerQuote(quote);
            setSubmitting(false);
            showToast(`ล็อกยอด ฿${quote.payableAmount.toFixed(2)} แล้ว กรุณาสแกน QR และแนบสลิป`, 'success', 5000);
            return;
          }
        }
      } else {
        quote = {
          orderId: '',
          orderNumber: orderRef.orderNumber,
          totals,
          payableAmount: charge?.payable ?? totals.total,
          values: { ...values },
          lines,
        };
      }

      if (!quote) throw new Error('missing_order_quote');
      const draft: StoredOrder = {
        databaseId: quote.orderId || undefined,
        orderNumber: quote.orderNumber,
        idempotencyKey: orderRef.idempotencyKey,
        ...quote.values,
        lines: quote.lines,
        totals: quote.totals,
        payableAmount: quote.payableAmount,
        slipReference: slipScan?.state === 'read' ? slipScan.reference : null,
        slipPath: null,
        paymentNote: null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        paymentStatus: quote.values.payment === 'promptpay' ? 'pending_verification' : 'unpaid',
        accountEmail: session.user?.email ?? null,
        ownerId: session.user?.id ?? null,
        synced: isSupabaseConfigured,
      };

      if (isSupabaseConfigured && supabase && quote.values.payment === 'promptpay' && slip) {
        const extension = slip.type === 'image/png' ? 'png' : slip.type === 'image/webp' ? 'webp' : 'jpg';
        let slipPath = uploadedSlipPath;
        if (!slipPath) {
          slipPath = `${session.user!.id}/${quote.orderId}/${crypto.randomUUID()}.${extension}`;
          const uploaded = await supabase.storage.from('payment-slips').upload(slipPath, slip, {
            contentType: slip.type,
            cacheControl: '3600',
            upsert: false,
          });
          if (uploaded.error) throw uploaded.error;
          setUploadedSlipPath(slipPath);
        }
        draft.slipPath = slipPath;
        const verified = await supabase.functions.invoke('verify-slip', {
          body: {
            orderNumber: draft.orderNumber,
            slipReference: slipScan?.state === 'read' ? slipScan.reference : '',
            slipPath,
          },
        });
        if (verified.error) throw verified.error;
        const verdict = verified.data as { status?: string; reason?: string } | null;
        if (verdict?.status === 'confirmed') draft.paymentStatus = 'paid';
        else if (verdict?.status === 'rejected') draft.paymentStatus = 'rejected';
        draft.paymentNote = verdict?.reason ?? 'พนักงานจะตรวจสอบสลิปให้';
      }

      addOrder(draft);
      // The shop watches n8n, so this is how they learn someone is waiting.
      // It must not be able to hold up the redirect or fail the order.
      void notify('order.placed', draft);
      setCoupon(quote.values.coupon ?? ''); clear(); renewOrderRef();
      router.push(`/track?order=${encodeURIComponent(draft.orderNumber)}&created=1`);
    } catch (error) {
      console.error('checkout failed', error);
      setSubmitting(false);
      showToast(await checkoutErrorMessage(error), 'error', 6000);
    }
  };

  const shownTotals = serverQuote?.totals ?? totals;
  const waitingForServerQr = isSupabaseConfigured && payment === 'promptpay' && !serverQuote;
  const waitingForSlip = payment === 'promptpay' && !waitingForServerQr && !slip;
  const submitLabel = waitingForServerQr
    ? `สร้าง QR และล็อกยอด · ฿${totals.total}`
    : `ยืนยันออเดอร์ · ฿${payment === 'promptpay' && serverQuote ? serverQuote.payableAmount.toFixed(2) : shownTotals.total}`;

  if (!lines.length) return <main className="checkout-empty"><span>🧺</span><h1>ตะกร้ายังว่างอยู่</h1><p>เลือกเมนูที่อยากทานก่อน แล้วค่อยกลับมายืนยันออเดอร์นะคะ</p><Link prefetch={false} className="primary-button" href="/menu">กลับไปเลือกเมนู</Link></main>;
  return <main className="checkout-page"><div className="checkout-heading"><Link prefetch={false} href="/menu"><ChevronLeft /> กลับไปเลือกเมนู</Link><p className="eyebrow">SECURE CHECKOUT</p><h1>ยืนยันความอร่อย</h1><p>ตรวจรายการและเลือกวิธีรับอาหารก่อนส่งออเดอร์</p></div>
    <CheckoutProgress />
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="checkout-layout">
      <div className="checkout-form-stack">
        <section {...cardProps(1)}><div className="form-card-title"><span>1</span><div><h2>ข้อมูลผู้สั่ง</h2><p>ใช้สำหรับติดต่อเรื่องออเดอร์นี้เท่านั้น</p></div></div><div className="field-grid"><label>ชื่อผู้สั่ง<input {...register('name')} readOnly={Boolean(serverQuote)} autoComplete="name" placeholder="ชื่อ–นามสกุล" />{errors.name && <small>{errors.name.message}</small>}</label><label>เบอร์โทร<input {...register('phone')} readOnly={Boolean(serverQuote)} inputMode="tel" autoComplete="tel" placeholder="08X-XXX-XXXX" />{errors.phone && <small>{errors.phone.message}</small>}</label></div></section>
        <section {...cardProps(2)}><div className="form-card-title"><span>2</span><div><h2>เลือกรับอาหาร</h2><p>รับที่ร้านได้เร็วที่สุด หรือให้เราไปส่ง</p></div></div><div className="choice-grid"><label className={fulfilment === 'pickup' ? 'selected' : ''}><input type="radio" value="pickup" aria-disabled={Boolean(serverQuote)} onClick={(event) => { if (serverQuote) event.preventDefault(); }} onKeyDown={(event) => { if (serverQuote) event.preventDefault(); }} {...register('fulfilment')} /><Store /><b>รับที่ร้าน</b><small>พร้อมรับประมาณ 20–30 นาที</small></label><label className={fulfilment === 'delivery' ? 'selected' : ''}><input type="radio" value="delivery" aria-disabled={Boolean(serverQuote)} onClick={(event) => { if (serverQuote) event.preventDefault(); }} onKeyDown={(event) => { if (serverQuote) event.preventDefault(); }} {...register('fulfilment')} /><Truck /><b>จัดส่ง</b><small>ประมาณ 30–45 นาที</small></label></div><AnimatePresence>{fulfilment === 'delivery' && <motion.label className="full-field" {...rise}><span><MapPin size={16} /> ที่อยู่จัดส่ง</span><textarea {...register('address')} readOnly={Boolean(serverQuote)} rows={3} placeholder="บ้านเลขที่ อาคาร ชั้น ถนน แขวง เขต และจุดสังเกต" />{errors.address && <small>{errors.address.message}</small>}</motion.label>}</AnimatePresence></section>
        <section {...cardProps(3)}><div className="form-card-title"><span>3</span><div><h2>วิธีชำระเงิน</h2><p>ร้านจะยืนยันการชำระเงินหลังตรวจสอบแล้ว</p></div></div><div className="payment-options"><label className={payment === 'cash' ? 'selected' : ''}><input type="radio" value="cash" aria-disabled={Boolean(serverQuote)} onClick={(event) => { if (serverQuote) event.preventDefault(); }} onKeyDown={(event) => { if (serverQuote) event.preventDefault(); }} {...register('payment')} /><span>💵</span><div><b>เงินสดตอนรับอาหาร</b><small>ชำระเมื่อรับที่ร้านหรือปลายทาง</small></div></label><label className={payment === 'promptpay' ? 'selected' : ''}><input type="radio" value="promptpay" aria-disabled={Boolean(serverQuote)} onClick={(event) => { if (serverQuote) event.preventDefault(); }} onKeyDown={(event) => { if (serverQuote) event.preventDefault(); }} {...register('payment')} /><QrCode /><div><b>พร้อมเพย์ QR</b><small>อัปโหลดสลิปเพื่อรอตรวจสอบ</small></div></label></div><AnimatePresence>{payment === 'promptpay' && <motion.div className="promptpay-panel" {...rise}>{charge ? <PromptPayCard payload={charge.payload} amountDisplay={charge.display} accountName={promptPayName} orderNumber={serverQuote?.orderNumber ?? orderRef?.orderNumber} /> : <div className="qr-placeholder"><QrCode /><span>QR ร้านค้า</span><small>{promptPayId ? 'กรอกข้อมูลแล้วกด “สร้าง QR และล็อกยอด”' : 'ยังไม่ได้ตั้งค่า PROMPTPAY_ID'}</small></div>}<div><b>{charge ? 'สแกน QR แล้วอัปโหลดสลิปเพื่อยืนยันอัตโนมัติ' : 'ระบบจะตรวจราคาและสร้าง QR จากยอดของ Server'}</b><p>ยอดชำระ {charge ? `฿${charge.display}` : `รอยืนยันจาก Server`}</p><label className="slip-upload">อัปโหลดสลิป (JPG, PNG หรือ WebP ไม่เกิน 5MB)<input type="file" disabled={!charge} accept="image/jpeg,image/png,image/webp" onChange={(event) => { void onSlipChange(event.target.files?.[0] ?? null); }} /></label>{slip && <small className="valid-file"><CheckCircle2 /> {slip.name}</small>}{slipScan?.state === 'scanning' && <small className="slip-status">กำลังอ่าน QR บนสลิป…</small>}{slipScan?.state === 'read' && <small className="slip-status ok">อ่าน QR บนสลิปได้แล้ว ระบบจะตรวจยอดกับธนาคารอัตโนมัติ</small>}{slipScan?.state === 'unreadable' && <small className="slip-status warn">อ่าน QR บนสลิปไม่ได้ แต่ระบบจะเก็บรูปไว้ให้พนักงานตรวจ</small>}</div></motion.div>}</AnimatePresence></section>
        <section {...cardProps(4)}><div className="form-card-title"><span>4</span><div><h2>หมายเหตุ</h2><p>รายละเอียดเพิ่มเติมสำหรับร้านหรือคนส่ง</p></div></div><label className="full-field"><textarea {...register('note')} readOnly={Boolean(serverQuote)} rows={3} placeholder="เช่น โทรก่อนถึง ฝากไว้ที่ล็อบบี้" /></label></section>
      </div>
      <aside className="order-summary"><h2>สรุปออเดอร์</h2><div className="summary-lines">{lines.map((line) => <div key={line.id}><span className="summary-emoji">{line.emoji}</span><div><b>{line.name}</b><small>{line.quantity} × ฿{line.unitPrice}{line.options?.length ? ` · ${line.options.join(', ')}` : ''}</small></div><strong>฿{lineTotal(line)}</strong></div>)}</div><label className="summary-coupon">คูปอง<input {...register('coupon')} readOnly={Boolean(serverQuote)} placeholder="IMJAI15" /></label><dl><div><dt>ยอดสินค้า</dt><dd>฿{shownTotals.subtotal}</dd></div><div><dt>ส่วนลด</dt><dd>-฿{shownTotals.discount}</dd></div><div><dt>ค่าจัดส่ง</dt><dd>{shownTotals.deliveryFee ? `฿${shownTotals.deliveryFee}` : 'ฟรี'}</dd></div><div className="summary-total"><dt>ยอดรวมสุทธิ</dt><dd>฿{shownTotals.total}</dd></div></dl>{waitingForSlip && <p className="order-warning">กรุณาอัปโหลดสลิปก่อนยืนยันออเดอร์</p>}{serverQuote && <p className="secure-note"><ShieldCheck /> ล็อกยอดจาก Server แล้ว · {serverQuote.orderNumber}</p>}{!canOrder && <Link prefetch={false} className="signin-gate" href="/account"><b>เข้าสู่ระบบก่อนสั่งซื้อ</b><small>ใช้เวลาไม่ถึงนาที แล้วคุณจะติดตามออเดอร์และดูประวัติย้อนหลังได้</small></Link>}<button className="place-order" disabled={!canOrder || submitting || waitingForSlip}>{submitting ? 'กำลังดำเนินการ…' : canOrder ? submitLabel : 'เข้าสู่ระบบเพื่อสั่งซื้อ'}</button><p className="secure-note"><ShieldCheck /> ราคาและสิทธิ์ส่วนลดตรวจจากระบบร้าน การชำระเงินจะแสดง “รอตรวจสอบ” จนกว่าจะยืนยัน</p><LineButton context={{ kind: 'payment', orderNumber: lineHintOrderNumber(serverQuote?.orderNumber, orderRef?.orderNumber, isSupabaseConfigured) }} /></aside>
    </form>
  </main>;
}
