'use client';

import { useSyncExternalStore } from 'react';
import type { CartLine } from './cart';
import { MENU_ITEMS } from './catalog';
import { isSupabaseConfigured, supabase } from './supabase';

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
  /** Database primary key. Missing only for preview orders from older builds. */
  databaseId?: string;
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
  /** Supabase owner id, used to scope staff accounts' personal order list. */
  ownerId?: string | null;
  /** Private Storage object path; staff request a short-lived URL to view it. */
  slipPath?: string | null;
  /**
   * True once the server has its own copy.
   *
   * False means this order exists only in the browser that placed it — the
   * kitchen still has it through n8n, but no other device can see it. Absent
   * on orders stored before this was recorded.
   */
  synced?: boolean;
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
  unpaid: 'ยังไม่จ่าย',
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
let databaseStarted = false;
const listeners = new Set<() => void>();

type DatabaseOrder = Record<string, unknown> & {
  order_items?: Record<string, unknown>[] | null;
  payments?: Record<string, unknown>[] | Record<string, unknown> | null;
};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const addressText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  return String(row.address ?? row.address_line ?? '').trim() || undefined;
};

const paymentRow = (value: DatabaseOrder['payments']): Record<string, unknown> | null =>
  Array.isArray(value) ? value[0] ?? null : value ?? null;

function fromDatabase(row: DatabaseOrder): StoredOrder {
  const payment = paymentRow(row.payments);
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  const lines: CartLine[] = items.map((item, index) => {
    const sku = String(item.sku ?? '');
    const selectedAddOns = asStrings(item.selected_add_ons);
    const addOnTotal = Number(item.add_on_total ?? 0);
    const addOnPrice = selectedAddOns.length ? addOnTotal / selectedAddOns.length : 0;
    return {
      id: String(item.id ?? `${row.id ?? row.order_number}-${index}`),
      sku,
      name: String(item.name_snapshot ?? sku),
      unitPrice: Number(item.unit_price ?? 0),
      quantity: Number(item.quantity ?? 1),
      options: asStrings(item.selected_options),
      addOns: selectedAddOns.map((name) => ({ name, price: addOnPrice })),
      note: String(item.note ?? '') || undefined,
      emoji: MENU_ITEMS.find((entry) => entry.sku === sku)?.emoji ?? '🍽️',
    };
  });
  const rawPaymentStatus = String(payment?.status ?? 'unpaid');
  const paymentStatus: PaymentStatus =
    rawPaymentStatus === 'verified' || rawPaymentStatus === 'paid'
      ? 'paid'
      : rawPaymentStatus === 'rejected'
        ? 'rejected'
        : rawPaymentStatus === 'pending_verification'
          ? 'pending_verification'
          : 'unpaid';
  return {
    databaseId: String(row.id ?? '') || undefined,
    orderNumber: String(row.order_number ?? ''),
    idempotencyKey: String(row.idempotency_key ?? row.order_number ?? ''),
    name: String(row.customer_name ?? 'ลูกค้า'),
    phone: String(row.customer_phone ?? ''),
    fulfilment: row.fulfilment === 'delivery' ? 'delivery' : 'pickup',
    address: addressText(row.delivery_address),
    note: String(row.customer_note ?? '') || undefined,
    payment: payment?.method === 'promptpay' ? 'promptpay' : 'cash',
    lines,
    totals: {
      subtotal: Number(row.subtotal ?? 0),
      discount: Number(row.discount ?? 0),
      deliveryFee: Number(row.delivery_fee ?? 0),
      total: Number(row.total ?? 0),
    },
    payableAmount: Number(payment?.payable_amount ?? payment?.amount ?? row.total ?? 0),
    slipReference: String(payment?.slip_reference ?? '') || null,
    slipPath: String(payment?.slip_path ?? '') || null,
    paymentNote: String(payment?.verification_reason ?? '') || null,
    status: String(row.status ?? 'pending') as OrderStatus,
    paymentStatus,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? '') || undefined,
    accountEmail: null,
    ownerId: String(row.user_id ?? '') || null,
    synced: true,
  };
}

export async function refreshOrders(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,order_number,user_id,idempotency_key,customer_name,customer_phone,
      fulfilment,delivery_address,customer_note,status,subtotal,discount,
      delivery_fee,total,created_at,updated_at,
      order_items(id,sku,name_snapshot,unit_price,quantity,selected_options,selected_add_ons,add_on_total,note,line_total),
      payments(method,status,amount,payable_amount,slip_path,slip_reference,verification_reason)
    `)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  cache = ((data ?? []) as DatabaseOrder[]).map(fromDatabase);
  announce();
}

/** Staff-only, short-lived link to a private slip image. */
export async function signedSlipUrl(path: string): Promise<string> {
  if (!supabase || !path) throw new Error('missing_slip');
  const { data, error } = await supabase.storage.from('payment-slips').createSignedUrl(path, 90);
  if (error || !data?.signedUrl) throw error ?? new Error('unable_to_sign_slip');
  return data.signedUrl;
}

function startDatabase() {
  if (databaseStarted || !isSupabaseConfigured || !supabase) return;
  databaseStarted = true;
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) void refreshOrders().catch(() => undefined);
  });
  supabase.auth.onAuthStateChange((_event, next) => {
    if (next) void refreshOrders().catch(() => undefined);
    else { cache = []; announce(); }
  });
  supabase
    .channel('imjai-orders-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void refreshOrders().catch(() => undefined))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => void refreshOrders().catch(() => undefined))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => void refreshOrders().catch(() => undefined))
    .subscribe();
}

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
    databaseId: order.databaseId,
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
    ownerId: order.ownerId ?? null,
    slipPath: order.slipPath ?? null,
    synced: order.synced ?? false,
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
    if (isSupabaseConfigured) {
      cache = [];
      startDatabase();
    } else {
      cache = read();
      // A second tab — the kitchen screen next to the till — writing an order
      // should show up here without a refresh.
      window.addEventListener('storage', (event) => {
        if (event.key && event.key !== ORDERS_KEY) return;
        cache = read();
        announce();
      });
    }
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
  if (!loaded && !isSupabaseConfigured) return read();
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
  if (isSupabaseConfigured) {
    cache = [order, ...rest].slice(0, 200);
    announce();
    void refreshOrders().catch(() => undefined);
  } else {
    write([order, ...rest].slice(0, 60));
  }
}

function patch(orderNumber: string, changes: Partial<StoredOrder>) {
  const now = new Date().toISOString();
  write(
    readOrders().map((order) =>
      order.orderNumber === orderNumber ? { ...order, ...changes, updatedAt: now } : order,
    ),
  );
}

function patchCache(orderNumber: string, changes: Partial<StoredOrder>) {
  const now = new Date().toISOString();
  cache = cache.map((order) =>
    order.orderNumber === orderNumber ? { ...order, ...changes, updatedAt: now } : order,
  );
  announce();
}

export async function setOrderStatus(orderNumber: string, status: OrderStatus) {
  if (!isSupabaseConfigured || !supabase) {
    patch(orderNumber, { status });
    return;
  }
  patchCache(orderNumber, { status });
  const { error } = await supabase.rpc('staff_set_order_status', {
    p_order_number: orderNumber,
    p_status: status,
    p_note: null,
  });
  if (error) { await refreshOrders(); throw error; }
  await refreshOrders();
  const updated = findOrder(orderNumber);
  if (updated) void import('./n8n').then(({ notify }) => notify('order.status_changed', updated));
}

/**
 * Staff decision on a transfer.
 *
 * The note is what the customer reads on the tracking page, so a rejection
 * always carries a reason — "สลิปไม่ผ่าน" with no explanation just generates
 * a phone call.
 */
export async function setPaymentStatus(orderNumber: string, paymentStatus: PaymentStatus, paymentNote?: string) {
  if (!isSupabaseConfigured || !supabase) {
    patch(orderNumber, { paymentStatus, paymentNote: paymentNote ?? null });
    return;
  }
  patchCache(orderNumber, { paymentStatus, paymentNote: paymentNote ?? null });
  const databaseStatus = paymentStatus === 'paid' ? 'verified' : paymentStatus;
  const { error } = await supabase.rpc('staff_set_payment_status', {
    p_order_number: orderNumber,
    p_status: databaseStatus,
    p_note: paymentNote ?? null,
  });
  if (error) { await refreshOrders(); throw error; }
  await refreshOrders();
  const updated = findOrder(orderNumber);
  if (updated) void import('./n8n').then(({ notify }) => notify('payment.slip_checked', updated));
}

export async function cancelOrder(orderNumber: string, reason = 'ร้านยกเลิกออเดอร์นี้') {
  if (!isSupabaseConfigured || !supabase) {
    patch(orderNumber, { status: 'cancelled', paymentNote: reason });
    return;
  }
  patchCache(orderNumber, { status: 'cancelled', paymentNote: reason });
  const { error } = await supabase.rpc('staff_set_order_status', {
    p_order_number: orderNumber,
    p_status: 'cancelled',
    p_note: reason,
  });
  if (error) { await refreshOrders(); throw error; }
  await refreshOrders();
  const updated = findOrder(orderNumber);
  if (updated) void import('./n8n').then(({ notify }) => notify('order.cancelled', updated));
}

/** Orders belonging to one signed-in customer, newest first. */
export function ordersForAccount(orders: StoredOrder[], email: string | null | undefined, ownerId?: string | null) {
  if (!email && !ownerId) return [];
  const wanted = (email ?? '').trim().toLowerCase();
  return orders.filter((order) =>
    ownerId && order.ownerId ? order.ownerId === ownerId : (order.accountEmail ?? '').toLowerCase() === wanted,
  );
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
    paidCount: todays.filter((order) => order.paymentStatus === 'paid').length,
    unpaidCount: todays.filter((order) => order.paymentStatus === 'unpaid').length,
    rejectedPaymentCount: todays.filter((order) => order.paymentStatus === 'rejected').length,
    averageBasket: todays.length ? Math.round(revenue / todays.length) : 0,
    /** Null rather than 0% when there is nothing to compare against. */
    changeVsYesterday: previous > 0 ? Math.round(((revenue - previous) / previous) * 100) : null,
  };
}
