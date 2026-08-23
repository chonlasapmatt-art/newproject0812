'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Ban, Check, ChefHat, Clock3, PackageCheck, Search, Truck } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState, type CSSProperties } from 'react';
import { rise } from '../lib/motion';
import { SHOP_PHONE } from '../lib/store-profile';
import { useStoreSettings } from '../lib/store-settings';
import {
  flowFor,
  ordersForAccount,
  useOrders,
  type OrderStatus,
  type StoredOrder,
} from '../lib/orders';
import { useSession } from '../lib/session';
import { LineButton } from './line-button';

/**
 * Where an order is, from the customer's side.
 *
 * The list is read live from the shared order store, so a status the kitchen
 * changes on the dashboard appears here without the customer refreshing — the
 * whole point of a tracking page is that it moves on its own.
 */

const STEP_COPY: Record<OrderStatus, { label: string; note: string; icon: typeof Clock3 }> = {
  pending: { label: 'รับคำสั่งซื้อแล้ว', note: 'กำลังตรวจสอบรายการ', icon: Clock3 },
  confirmed: { label: 'ร้านยืนยันออเดอร์', note: 'ครัวได้รับรายการแล้ว', icon: Check },
  preparing: { label: 'กำลังปรุง', note: 'ทำสดใหม่ให้คุณ', icon: ChefHat },
  ready: { label: 'พร้อมรับ / พร้อมส่ง', note: 'ใกล้ได้อิ่มใจแล้ว', icon: PackageCheck },
  out_for_delivery: { label: 'กำลังจัดส่ง', note: 'ไรเดอร์กำลังเดินทาง', icon: Truck },
  completed: { label: 'สำเร็จ', note: 'ขอบคุณที่อุดหนุนอิ่มใจ', icon: Check },
  cancelled: { label: 'ยกเลิกแล้ว', note: 'ออเดอร์นี้ถูกยกเลิก', icon: Ban },
};

/**
 * How each payment state reads to the customer.
 *
 * `paid` only ever comes from the bank answering through verify-slip, so the
 * confirmed wording is safe to state plainly; everything else says what is
 * still outstanding rather than implying the money arrived.
 */
const PAYMENT_STATES: Record<string, { label: string; tone: 'ok' | 'wait' | 'stop' | 'plain'; detail: string }> = {
  paid: { label: 'ชำระเงินแล้ว', tone: 'ok', detail: 'ตรวจยอดกับธนาคารเรียบร้อย' },
  pending_verification: { label: 'รอตรวจสอบสลิป', tone: 'wait', detail: 'ร้านจะยืนยันให้เร็วที่สุด' },
  rejected: { label: 'สลิปไม่ผ่านการตรวจ', tone: 'stop', detail: `กรุณาติดต่อร้านที่ ${SHOP_PHONE}` },
  unpaid: { label: 'ชำระตอนรับอาหาร', tone: 'plain', detail: 'เตรียมเงินสดให้พอดีจะรวดเร็วขึ้น' },
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

function Timeline({ order }: { order: StoredOrder }) {
  const flow = flowFor(order.fulfilment);

  if (order.status === 'cancelled') {
    const copy = STEP_COPY.cancelled;
    return (
      <ol className="timeline">
        <li className="done cancelled">
          <span><copy.icon /></span>
          <div><b>{copy.label}</b><small>{order.paymentNote ?? copy.note}</small></div>
        </li>
      </ol>
    );
  }

  const currentIndex = Math.max(0, flow.indexOf(order.status));

  return (
    <ol className="timeline">
      {flow.map((step, index) => {
        const copy = STEP_COPY[step];
        const Icon = copy.icon;
        const state = [index <= currentIndex ? 'done' : '', index === currentIndex ? 'now' : ''].filter(Boolean).join(' ');
        return (
          // --i staggers the connector so the line appears to run down the
          // list rather than all of it switching on at once.
          <li className={state} key={step} style={{ '--i': index } as CSSProperties}>
            <span><Icon /></span>
            <div><b>{copy.label}</b><small>{copy.note}</small></div>
            {index === currentIndex && <em>สถานะปัจจุบัน</em>}
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ order }: { order: StoredOrder }) {
  const state = PAYMENT_STATES[order.paymentStatus] ?? PAYMENT_STATES.unpaid;
  const eta = order.fulfilment === 'delivery' ? '30–45 นาที' : '20–30 นาที';

  return (
    <div className="order-tracking-card">
      <div className="order-overview">
        <div>
          <p>ORDER NUMBER</p>
          <h2>{order.orderNumber}</h2>
          <span>สั่งเมื่อ {timeOf(order.createdAt)}</span>
        </div>
        <div className="eta">
          <Clock3 />
          <div><small>เวลาโดยประมาณ</small><b>{eta}</b></div>
        </div>
      </div>

      <div className="order-meta">
        <span><small>ยอดรวม</small><b>฿{order.totals.total}</b></span>
        <span><small>วิธีรับอาหาร</small><b>{order.fulfilment === 'delivery' ? 'จัดส่ง' : 'รับที่ร้าน'}</b></span>
        <span><small>การชำระเงิน</small><b>{state.label}</b></span>
      </div>

      <div className={`payment-state ${state.tone}`}>
        <span className="payment-dot" aria-hidden />
        <div><b>{state.label}</b><small>{order.paymentNote ?? state.detail}</small></div>
        {order.paymentStatus !== 'unpaid' && order.payableAmount ? <strong>฿{order.payableAmount.toFixed(2)}</strong> : null}
      </div>

      <Timeline order={order} />

      <div className="order-items">
        <b>รายการของคุณ</b>
        {order.lines.map((line, index) => (
          <span key={`${line.name}-${index}`}>{line.quantity} × {line.name}</span>
        ))}
      </div>
    </div>
  );
}

export function TrackPage() {
  const params = useSearchParams();
  const session = useSession();
  const orders = useOrders();
  // Whatever the shop saved in the dashboard, falling back to what shipped.
  const settings = useStoreSettings();
  const shopPhone = settings.phone || SHOP_PHONE;

  const requested = params.get('order') ?? '';
  const created = params.get('created') === '1';
  const [orderNumber, setOrderNumber] = useState(requested);
  const [phone, setPhone] = useState('');
  const [query, setQuery] = useState<{ order: string; phone: string } | null>(
    requested ? { order: requested, phone: '' } : null,
  );

  // Derived from the live list rather than copied into state, so a status the
  // kitchen changes lands on this screen straight away.
  const order = useMemo(() => {
    if (!query) return null;
    const wanted = query.order.trim().toLowerCase();
    const digits = query.phone.replace(/\D/g, '');
    return (
      orders.find(
        (item) =>
          item.orderNumber.toLowerCase() === wanted &&
          (!digits || item.phone.replace(/\D/g, '') === digits),
      ) ?? null
    );
  }, [orders, query]);

  const mine = useMemo(
    () => ordersForAccount(orders, session.user?.email).slice(0, 6),
    [orders, session.user?.email],
  );

  return (
    <main className="track-page">
      <section className="page-hero compact">
        <p className="eyebrow">ORDER TRACKING</p>
        <h1>{created ? 'รับออเดอร์แล้วค่ะ' : 'ออเดอร์ถึงไหนแล้วนะ?'}</h1>
        <p>{created ? 'บันทึกเลขออเดอร์ไว้ แล้วติดตามความอร่อยได้จากหน้านี้' : 'กรอกเลขออเดอร์และเบอร์โทรที่ใช้สั่ง เพื่อดูสถานะล่าสุด'}</p>
      </section>

      <section className="tracking-shell">
        <div className="track-search">
          <label>
            เลขออเดอร์
            <input value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} placeholder="เช่น IJ260821-AB12" />
          </label>
          <label>
            เบอร์โทร
            <input value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" placeholder="เบอร์ที่ใช้สั่ง (ใช้เมื่อตรวจออเดอร์เดิม)" />
          </label>
          <button type="button" onClick={() => setQuery({ order: orderNumber, phone })}>
            <Search /> ตรวจสอบสถานะ
          </button>
        </div>

        {mine.length > 0 && (
          <div className="my-orders">
            <b>ออเดอร์ของคุณ</b>
            <div className="my-orders-list">
              {mine.map((item) => (
                <button
                  type="button"
                  key={item.orderNumber}
                  className={item.orderNumber === order?.orderNumber ? 'active' : ''}
                  onClick={() => {
                    setOrderNumber(item.orderNumber);
                    setPhone('');
                    setQuery({ order: item.orderNumber, phone: '' });
                  }}
                >
                  <b>{item.orderNumber}</b>
                  <small>{STEP_COPY[item.status].label} · ฿{item.totals.total}</small>
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {order ? (
            <motion.div key="order" {...rise}><OrderCard order={order} /><LineButton context={{ kind: 'order', orderNumber: order.orderNumber }} tone="loud" /></motion.div>
          ) : query ? (
            <motion.div className="track-empty" key="empty" {...rise}>
              <span>🧾</span>
              <h2>ยังไม่พบออเดอร์นี้</h2>
              <p>ตรวจเลขออเดอร์และเบอร์โทรอีกครั้ง หรือติดต่อร้านที่ {shopPhone}</p>
              {session.status !== 'signed-in' && (
                <Link prefetch={false} className="primary-button" href="/account">เข้าสู่ระบบเพื่อดูออเดอร์ของคุณ</Link>
              )}
              <LineButton context={{ kind: 'general' }} />
            </motion.div>
          ) : (
            <motion.div className="track-prompt" key="prompt" {...rise}>
              <span>🍳</span>
              <h2>พร้อมติดตามทุกขั้นตอน</h2>
              <p>สถานะจะอัปเดตตั้งแต่ร้านรับออเดอร์ กำลังปรุง จนถึงพร้อมรับหรือจัดส่ง</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
