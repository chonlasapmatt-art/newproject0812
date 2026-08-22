'use client';

import { Banknote, QrCode, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  RANGE_LABEL,
  peakOf,
  summariseSales,
  type SalesRange,
} from '../lib/sales';
import type { StoredOrder } from '../lib/orders';

/**
 * Sales, as they happen.
 *
 * Every figure is derived from the live order list, so placing an order in one
 * tab moves this screen in the other — there is no stored total to fall out of
 * step with the orders it came from.
 *
 * On the charts: each is one series, so each is one colour rather than a ramp
 * that would spend the only free channel restating the bar length. Fills are
 * the darker steps of the shop's own orange and sage, which clear 3:1 against
 * the card behind them; the lighter brand tones do not. Only the peak carries
 * a printed number — a value on every column is noise, and the rest are one
 * hover away.
 */

const RANGES: SalesRange[] = ['today', 'week', 'month'];

const baht = (value: number) => `฿${Math.round(value).toLocaleString('th-TH')}`;

/**
 * Which columns get a written label.
 *
 * Twenty-four hours or thirty days will not fit legibly side by side, so the
 * axis is thinned to roughly six marks and the rest are read by hovering.
 */
function labelEvery(count: number) {
  return Math.max(1, Math.round(count / 6));
}

function RevenueChart({ sales }: { sales: ReturnType<typeof summariseSales> }) {
  const peak = peakOf(sales.buckets);
  const ceiling = peak?.revenue ?? 0;
  const step = labelEvery(sales.buckets.length);

  if (!ceiling) {
    return <p className="admin-empty">ยังไม่มียอดขายในช่วงนี้</p>;
  }

  return (
    <figure className="sales-chart">
      <div className="sales-bars" role="img" aria-label={`ยอดขายราย${sales.bucketUnit === 'hour' ? 'ชั่วโมง' : 'วัน'} รวม ${baht(sales.revenue)}`}>
        {sales.buckets.map((bucket, index) => {
          const share = bucket.revenue / ceiling;
          return (
            <div className="sales-bar" key={bucket.at.toISOString()}>
              <div className="sales-bar-track">
                {/* A bar of zero height would still show its rounded cap, which
                    reads as a tiny sale rather than none, so it is left out. */}
                {bucket.revenue > 0 && (
                  <span className="sales-bar-fill" style={{ height: `${Math.max(share * 100, 3)}%` }} />
                )}
                <span className="sales-tip" role="tooltip">
                  <b>{bucket.label}</b>
                  {bucket.revenue ? `${baht(bucket.revenue)} · ${bucket.orders} ออเดอร์` : 'ไม่มีออเดอร์'}
                </span>
              </div>
              <small className={index % step === 0 ? '' : 'is-quiet'}>{bucket.label}</small>
            </div>
          );
        })}
      </div>
      <figcaption>
        {peak
          ? `ช่วงที่ขายดีที่สุดคือ ${peak.label} — ${baht(peak.revenue)} จาก ${peak.orders} ออเดอร์`
          : 'ยังไม่มียอดขายในช่วงนี้'}
      </figcaption>
    </figure>
  );
}

function BestSellers({ sales }: { sales: ReturnType<typeof summariseSales> }) {
  const top = sales.bestSellers.slice(0, 6);
  const ceiling = top[0]?.revenue ?? 0;

  if (!top.length) return <p className="admin-empty">ยังไม่มีเมนูที่ขายได้ในช่วงนี้</p>;

  return (
    <ol className="sales-ranking">
      {top.map((dish) => (
        <li key={dish.sku}>
          <span className="sales-rank-art">{dish.emoji}</span>
          <div>
            <b>{dish.name}</b>
            <span className="sales-rank-track">
              <span className="sales-rank-fill" style={{ width: `${Math.max((dish.revenue / ceiling) * 100, 4)}%` }} />
            </span>
          </div>
          <em>
            <b>{baht(dish.revenue)}</b>
            <small>{dish.quantity} ที่</small>
          </em>
        </li>
      ))}
    </ol>
  );
}

export function AdminSales({ orders }: { orders: StoredOrder[] }) {
  const [range, setRange] = useState<SalesRange>('today');
  const sales = useMemo(() => summariseSales(orders, range), [orders, range]);

  return (
    <>
      <div className="admin-filters">
        <div className="admin-chips">
          {RANGES.map((entry) => (
            <button type="button" key={entry} className={range === entry ? 'active' : ''} onClick={() => setRange(entry)}>
              {RANGE_LABEL[entry]}
            </button>
          ))}
        </div>
        <p className="admin-hint">ตัวเลขคำนวณจากออเดอร์จริง อัปเดตทันทีที่มีออเดอร์เข้ามา · ออเดอร์ที่ยกเลิกไม่ถูกนับ</p>
      </div>

      <div className="metric-grid">
        <article>
          <span><TrendingUp /></span>
          <div>
            <small>ยอดขาย {RANGE_LABEL[range]}</small>
            <h2>{baht(sales.revenue)}</h2>
            <p>{sales.orderCount} ออเดอร์</p>
          </div>
        </article>
        <article>
          <span><ShoppingBag /></span>
          <div>
            <small>เฉลี่ยต่อบิล</small>
            <h2>{baht(sales.averageBasket)}</h2>
            <p>รับที่ร้าน {sales.byFulfilment.pickup} · จัดส่ง {sales.byFulfilment.delivery}</p>
          </div>
        </article>
        <article>
          <span><Banknote /></span>
          <div>
            <small>เงินสด</small>
            <h2>{baht(sales.byPayment.cash)}</h2>
            <p>เก็บตอนรับอาหาร</p>
          </div>
        </article>
        <article>
          <span><QrCode /></span>
          <div>
            <small>พร้อมเพย์</small>
            <h2>{baht(sales.byPayment.promptpay)}</h2>
            <p>โอนเข้าบัญชีร้าน</p>
          </div>
        </article>
      </div>

      {sales.awaiting > 0 && (
        <p className="admin-banner">
          <Wallet size={15} /> ยังรอรับเงินอีก {baht(sales.awaiting)} — ออเดอร์ที่ยังไม่ได้ชำระหรือรอตรวจสลิป
        </p>
      )}

      <div className="admin-panels sales-panels">
        <article>
          <div className="panel-title">
            <div>
              <h2>ยอดขายราย{sales.bucketUnit === 'hour' ? 'ชั่วโมง' : 'วัน'}</h2>
              <p>ชี้ที่แท่งเพื่อดูตัวเลขของช่วงนั้น</p>
            </div>
          </div>
          <RevenueChart sales={sales} />
        </article>

        <article>
          <div className="panel-title"><div><h2>เมนูขายดี</h2><p>เรียงตามยอดขาย</p></div></div>
          <BestSellers sales={sales} />
        </article>
      </div>
    </>
  );
}
