'use client';

import type { StoredOrder } from './orders';

/**
 * Orders and slip results, forwarded to the shop's own automation.
 *
 * The shop already runs n8n and watches it, so this is how a new order reaches
 * them today — before orders live in a database every device can read. Sending
 * is fire-and-forget: an order is never held up, and never refused, because a
 * webhook is slow or down.
 *
 * A failed send is kept rather than dropped. The whole point of this channel is
 * that the shop finds out a customer is waiting; losing that to one flaky
 * request would be worse than the delay of sending it on the next page load.
 *
 * On trust: a static site has no server, so this URL ships inside the page and
 * anyone who views source can see it and post to it. That is a property of the
 * hosting, not a mistake here, and it means the workflow on the other end must
 * treat what arrives as a claim rather than a fact — check the order against
 * the database before acting on money.
 */

const WEBHOOK_URL = (process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL ?? '').trim();

export const isN8nConfigured = Boolean(WEBHOOK_URL);

const QUEUE_KEY = 'imjai-n8n-queue';

/** Enough attempts to ride out a restart, few enough to not retry forever. */
const MAX_ATTEMPTS = 5;

export type OrderEvent =
  | 'order.placed'
  | 'order.status_changed'
  | 'order.cancelled'
  | 'payment.slip_checked';

type Envelope = {
  event: OrderEvent;
  sentAt: string;
  attempts: number;
  order: {
    orderNumber: string;
    status: StoredOrder['status'];
    paymentStatus: StoredOrder['paymentStatus'];
    paymentMethod: StoredOrder['payment'];
    paymentNote: string | null;
    slipReference: string | null;
    fulfilment: StoredOrder['fulfilment'];
    address: string | null;
    note: string | null;
    customer: { name: string; phone: string; accountEmail: string | null };
    totals: StoredOrder['totals'];
    payableAmount: number;
    items: { sku: string; name: string; quantity: number; unitPrice: number; options: string[]; addOns: string[]; note: string | null }[];
    createdAt: string;
    syncedToDatabase: boolean;
  };
};

/** Only what the workflow needs, shaped so it does not have to know our types. */
function describe(order: StoredOrder): Envelope['order'] {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.payment,
    paymentNote: order.paymentNote ?? null,
    slipReference: order.slipReference ?? null,
    fulfilment: order.fulfilment,
    address: order.address ?? null,
    note: order.note ?? null,
    customer: {
      name: order.name,
      phone: order.phone,
      accountEmail: order.accountEmail ?? null,
    },
    totals: order.totals,
    payableAmount: order.payableAmount,
    items: order.lines.map((line) => ({
      sku: line.sku,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      options: line.options ?? [],
      addOns: (line.addOns ?? []).map((addOn) => addOn.name),
      note: line.note ?? null,
    })),
    createdAt: order.createdAt,
    syncedToDatabase: order.synced ?? false,
  };
}

function readQueue(): Envelope[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as Envelope[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: Envelope[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Private browsing refuses storage; the send simply does not survive a reload.
  }
}

/** One attempt. Resolves true only when the workflow accepted it. */
async function deliver(envelope: Envelope): Promise<boolean> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: envelope.event, sentAt: envelope.sentAt, order: envelope.order }),
      // The reply is not read, and a redirect would not be a success either.
      redirect: 'error',
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Retry whatever is waiting.
 *
 * Called on load and before each new send, so a queue drains at the next sign
 * of life rather than on a timer nobody is watching.
 */
export async function flushQueue(): Promise<void> {
  if (!isN8nConfigured) return;

  const queue = readQueue();
  if (!queue.length) return;

  const remaining: Envelope[] = [];
  for (const envelope of queue) {
    const sent = await deliver(envelope);
    if (sent) continue;
    const attempts = envelope.attempts + 1;
    // Give up eventually: a queue that never empties would resend the same
    // failure on every page load for the rest of the browser's life.
    if (attempts < MAX_ATTEMPTS) remaining.push({ ...envelope, attempts });
  }
  writeQueue(remaining);
}

/** Tell the workflow something happened to an order. Never throws. */
export async function notify(event: OrderEvent, order: StoredOrder): Promise<void> {
  if (!isN8nConfigured) return;

  const envelope: Envelope = {
    event,
    sentAt: new Date().toISOString(),
    attempts: 0,
    order: describe(order),
  };

  await flushQueue();
  const sent = await deliver(envelope);
  if (!sent) writeQueue([...readQueue(), { ...envelope, attempts: 1 }]);
}
