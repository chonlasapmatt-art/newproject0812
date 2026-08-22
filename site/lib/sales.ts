import type { StoredOrder } from './orders';

/**
 * What the shop earned, derived from the orders it already holds.
 *
 * Everything here is a pure function of the order list, so the dashboard
 * recomputes as orders arrive rather than storing a second copy of the truth
 * that could drift from it. No figure is stored; every one is derived.
 *
 * Cancelled orders are excluded throughout. An order the kitchen turned down
 * earned nothing, and counting it gives the shop a total that will not
 * reconcile against the till.
 */

export type SalesRange = 'today' | 'week' | 'month';

export const RANGE_DAYS: Record<SalesRange, number> = { today: 1, week: 7, month: 30 };

export const RANGE_LABEL: Record<SalesRange, string> = {
  today: 'วันนี้',
  week: '7 วัน',
  month: '30 วัน',
};

export type Bucket = {
  /** Start of the bucket, for labelling and keys. */
  at: Date;
  label: string;
  revenue: number;
  orders: number;
};

export type BestSeller = {
  sku: string;
  name: string;
  emoji: string;
  quantity: number;
  revenue: number;
};

export type Sales = {
  revenue: number;
  orderCount: number;
  averageBasket: number;
  /** Hourly while the range is today, daily otherwise. */
  buckets: Bucket[];
  bucketUnit: 'hour' | 'day';
  bestSellers: BestSeller[];
  byPayment: { cash: number; promptpay: number };
  byFulfilment: { pickup: number; delivery: number };
  /** Money the shop is still owed: placed, not cancelled, not yet paid. */
  awaiting: number;
};

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

/**
 * What one line actually brought in.
 *
 * The unit price alone understates it: add-ons are charged per unit, so a
 * ไข่ดาว on two plates is two ไข่ดาว. This mirrors `lineTotal` in lib/cart —
 * the same arithmetic the customer was shown at checkout.
 */
const lineRevenue = (line: StoredOrder['lines'][number]) =>
  (line.unitPrice + (line.addOns ?? []).reduce((sum, addOn) => sum + addOn.price, 0)) * line.quantity;

export function summariseSales(orders: StoredOrder[], range: SalesRange, now = new Date()): Sales {
  const days = RANGE_DAYS[range];
  const from = range === 'today' ? startOfDay(now) : startOfDay(new Date(now.getTime() - (days - 1) * 864e5));

  const live = orders.filter((order) => order.status !== 'cancelled' && new Date(order.createdAt) >= from);

  const revenue = live.reduce((sum, order) => sum + order.totals.total, 0);

  // Buckets are laid out first and filled second, so a quiet hour is a gap in
  // the chart rather than a missing column that shifts everything after it.
  const bucketUnit: 'hour' | 'day' = range === 'today' ? 'hour' : 'day';
  const buckets: Bucket[] = [];
  if (bucketUnit === 'hour') {
    for (let hour = 0; hour < 24; hour += 1) {
      const at = new Date(from);
      at.setHours(hour);
      buckets.push({ at, label: `${String(hour).padStart(2, '0')}:00`, revenue: 0, orders: 0 });
    }
  } else {
    for (let day = 0; day < days; day += 1) {
      const at = new Date(from.getTime() + day * 864e5);
      buckets.push({
        at,
        label: at.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
        revenue: 0,
        orders: 0,
      });
    }
  }

  for (const order of live) {
    const placed = new Date(order.createdAt);
    const index =
      bucketUnit === 'hour'
        ? placed.getHours()
        : Math.floor((startOfDay(placed).getTime() - from.getTime()) / 864e5);
    const bucket = buckets[index];
    if (!bucket) continue;
    bucket.revenue += order.totals.total;
    bucket.orders += 1;
  }

  const dishes = new Map<string, BestSeller>();
  for (const order of live) {
    for (const line of order.lines) {
      const entry = dishes.get(line.sku);
      const money = lineRevenue(line);
      if (entry) {
        entry.quantity += line.quantity;
        entry.revenue += money;
      } else {
        dishes.set(line.sku, {
          sku: line.sku,
          name: line.name,
          emoji: line.emoji,
          quantity: line.quantity,
          revenue: money,
        });
      }
    }
  }

  const paid = (order: StoredOrder) => order.paymentStatus === 'paid';

  return {
    revenue,
    orderCount: live.length,
    averageBasket: live.length ? Math.round(revenue / live.length) : 0,
    buckets,
    bucketUnit,
    bestSellers: [...dishes.values()].sort((a, b) => b.revenue - a.revenue),
    byPayment: {
      cash: live.filter((order) => order.payment === 'cash').reduce((sum, order) => sum + order.totals.total, 0),
      promptpay: live
        .filter((order) => order.payment === 'promptpay')
        .reduce((sum, order) => sum + order.totals.total, 0),
    },
    byFulfilment: {
      pickup: live.filter((order) => order.fulfilment === 'pickup').length,
      delivery: live.filter((order) => order.fulfilment === 'delivery').length,
    },
    awaiting: live.filter((order) => !paid(order)).reduce((sum, order) => sum + order.totals.total, 0),
  };
}

/** The busiest bucket, for scaling the chart and for naming a peak hour. */
export function peakOf(buckets: Bucket[]): Bucket | null {
  let best: Bucket | null = null;
  for (const bucket of buckets) {
    if (bucket.revenue > 0 && (!best || bucket.revenue > best.revenue)) best = bucket;
  }
  return best;
}
