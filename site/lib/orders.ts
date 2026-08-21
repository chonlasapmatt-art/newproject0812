'use client';

import { useSyncExternalStore } from 'react';
import type { CartLine } from './cart';

/**
 * Every order the shop knows about.
 *
 * Three screens need the same list and must never disagree: the customer
 * tracking a delivery, the kitchen moving it along, and the dashboard counting
 * the day's takings. So the list lives outside React — one array, one writer —
 * and each screen subscribes to it.
 *
 * Storage is localStorage until Supabase is connected. That is a real limit
 * worth naming: orders live in the browser that placed them, so staff see what
 * this device has seen. The shape below is the shape the `orders` table will
 * have, so moving the reads to Supabase later is a change of source, not of
 * screens.
 */

export const ORDERS_KEY = 'imjai-orders';

/** How far along the kitchen is. The tracking timeline renders these in order. */
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

/** Whether the money has actually arrived. Only the bank moves this to `paid`. */
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'rejected';

export type OrderTotals = {
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
};

export type StoredOrder = {
  orderNumber: string;
  idempotencyKey: string;
  name: string;
  phone: string;
  fulfilment: 'pickup' | 'delivery';
  address?: string;
  note?: string;
  payment: 'cash' | 'promptpay';
  coupon?: string;
  lines: CartLine[];
  totals: OrderTotals;
  /** What the QR asked for, satang suffix included. */
  payableAmount: number;
  slipReference: string | null;
  paymentNote: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt?: string;
  /** Who placed it, when an account was signed in. Blank for preview orders. */
  accountEmail?: string | null;
};

export const ORDER_FLOW: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'ออเดอร์ใหม่',
  confirmed: 'ยืนยันแล้ว',
  preparing: 'กำลังปรุง',
  ready: 'พร้อมรับ / พร้อมส่ง',
  out_for_delivery: 'กำลังจัดส่ง',
  completed: 'สำเร็จ',
  cancelled: 'ยกเลิก',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'ชำระปลายทาง',
  pending_verification: 'รอตรวจสลิป',
  paid: 'ชำระแล้ว',
  rejected: 'สลิปไม่ผ่าน',
};

/**
 * Delivery skips nothing, pickup skips the rider.
 *
 * A pickup order that shows "กำลังจัดส่ง" tells the customer to wait at home
 * for food sitting on the counter, so the step is dropped rather than greyed.
 */
export function flowFor(fulfilment: StoredOrder['fulfilment']): OrderStatus[] {
  return fulfilment === 'delivery' ? ORDER_FLOW : ORDER_FLOW.filter((step) => step !== 'out_for_delivery');
}

let cache: StoredOrder[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/**
 * Anything read back from storage was written by an older build, or by hand.
 * Fill in what a screen would otherwise crash on rather than trusting it.
 */
function normalise(raw: unknown): StoredOrder | null {
  if (!raw || typeof raw !== 'object') return null;
  const order = raw as Partial<StoredOrder>;
  if (!order.orderNumber) return null;
  return {
    orderNumber: order.orderNumber,
    idempotencyKey: order.idempotencyKey ?? order.orderNumber,
    name: order.name ?? 'ลูกค้า',
    phone: order.phone ?? '',
    fulfilment: order.fulfilment === 'delivery' ? 'delivery' : 'pickup',
    address: order.address,
    note: order.note,
    payment: order.payment === 'promptpay' ? 'promptpay' : 'cash',
    coupon: order.coupon,
    lines: Array.isArray(order.lines) ? order.lines : [],
    totals: order.totals ?? { subtotal: 0, discount: 0, deliveryFee: 0, total: 0 },
    payableAmount: order.payableAmount ?? order.totals?.total ?? 0,
    slipReference: order.slipReference ?? null,
    paymentNote: order.paymentNote ?? null,
    status: (order.status as OrderStatus) ?? 'pending',
    paymentStatus: (order.paymentStatus as PaymentStatus) ?? 'unpaid',
    createdAt: order.createdAt ?? new Date().toISOString(),
    updatedAt: order.updatedAt,
    accountEmail: order.accountEmail ?? null,
  };
}

function read(): StoredOrder[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDERS_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(normalise).filter((order): order is StoredOrder => order !== null);
  } catch {
    return [];
  }
}

function write(orders: StoredOrder[]) {
  cache = orders;
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // Storage full or blocked. The list still works for this page.
  }
  announce();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);

  if (!loaded) {
    loaded = true;
    cache = read();
    // A second tab — the kitchen screen next to the till — writing an order
    // should show up here without a refresh.
    window.addEventListener('storage', (event) => {
      if (event.key && event.key !== ORDERS_KEY) return;
      cache = read();
      announce();
    });
  }

  return () => {
    listeners.delete(onChange);
  };
}

const snapshot = () => cache;
const EMPTY: StoredOrder[] = [];
const serverSnapshot = () => EMPTY;

/** Live list, newest first. Empty while server-rendering. */
export function useOrders(): StoredOrder[] {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Read once, outside React — for a lookup that should not subscribe. */
export function readOrders(): StoredOrder[] {
  if (!loaded) return read();
  return cache;
}

export function findOrder(orderNumber: string): StoredOrder | null {
  const wanted = orderNumber.trim().toLowerCase();
  return readOrders().find((order) => order.orderNumber.toLowerCase() === wanted) ?? null;
}

/**
 * Record a new order.
 *
 * Keyed on the idempotency key, so a double submit — or a retry after a flaky
 * network — updates the existing row instead of billing twice.
 */
export function addOrder(order: StoredOrder) {
  const rest = readOrders().filter((item) => item.idempotencyKey !== order.idempotencyKey);
  write([order, ...rest].slice(0, 60));
}

function patch(orderNumber: string, changes: Partial<StoredOrder>) {
  const now = new Date().toISOString();
  write(
    readOrders().map((order) =>
      order.orderNumber === orderNumber ? { ...order, ...changes, updatedAt: now } : order,
    ),
  );
}

export function setOrderStatus(orderNumber: string, status: OrderStatus) {
  patch(orderNumber, { status });
}

/**
 * Staff decision on a transfer.
 *
 * The note is what the customer reads on the tracking page, so a rejection
 * always carries a reason — "สลิปไม่ผ่าน" with no explanation just generates
 * a phone call.
 */
export function setPaymentStatus(orderNumber: string, paymentStatus: PaymentStatus, paymentNote?: string) {
  patch(orderNumber, { paymentStatus, paymentNote: paymentNote ?? null });
}

export function cancelOrder(orderNumber: string, reason = 'ร้านยกเลิกออเดอร์นี้') {
  patch(orderNumber, { status: 'cancelled', paymentNote: reason });
}

/** Orders belonging to one signed-in customer, newest first. */
export function ordersForAccount(orders: StoredOrder[], email: string | null | undefined) {
  if (!email) return [];
  const wanted = email.trim().toLowerCase();
  return orders.filter((order) => (order.accountEmail ?? '').toLowerCase() === wanted);
}

const isSameDay = (iso: string, day: Date) => {
  const date = new Date(iso);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
};

/**
 * The numbers on the dashboard tiles.
 *
 * Revenue counts only orders that were not cancelled: an order the kitchen
 * turned down never earned anything, and showing it as takings makes the
 * day's total a number nobody can reconcile against the till.
 */
export function summarise(orders: StoredOrder[], today = new Date()) {
  const live = orders.filter((order) => order.status !== 'cancelled');
  const todays = live.filter((order) => isSameDay(order.createdAt, today));
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdays = live.filter((order) => isSameDay(order.createdAt, yesterday));

  const sum = (list: StoredOrder[]) => list.reduce((total, order) => total + order.totals.total, 0);
  const revenue = sum(todays);
  const previous = sum(yesterdays);

  return {
    revenue,
    orderCount: todays.length,
    newOrders: todays.filter((order) => order.status === 'pending').length,
    preparing: live.filter((order) => order.status === 'preparing' || order.status === 'confirmed').length,
    awaitingPayment: live.filter((order) => order.paymentStatus === 'pending_verification').length,
    averageBasket: todays.length ? Math.round(revenue / todays.length) : 0,
    /** Null rather than 0% when there is nothing to compare against. */
    changeVsYesterday: previous > 0 ? Math.round(((revenue - previous) / previous) * 100) : null,
  };
}
