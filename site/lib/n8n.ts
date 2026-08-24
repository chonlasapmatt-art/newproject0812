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
  order: { orderNumber: string };
};

/**
 * This public webhook is only a wake-up signal. Keep customer, address and
 * payment data out of both the request and the browser retry queue; n8n reads
 * the authoritative notification from Supabase with its private credential.
 */
function describe(order: StoredOrder): Envelope['order'] {
  return { orderNumber: order.orderNumber };
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
      // text/plain is a CORS-simple request. The workflow only uses this as a
      // wake-up signal and reads the trusted order from Supabase, so avoiding
      // a preflight keeps notifications working on static GitHub Pages.
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify({ event: envelope.event, sentAt: envelope.sentAt, order: envelope.order }),
      // The reply is not read, and a redirect would not be a success either.
      redirect: 'error',
      mode: 'no-cors',
      keepalive: true,
    });
    // A successful cross-origin no-cors request has an opaque response. A
    // network failure still rejects, so it remains eligible for retry.
    return response.ok || response.type === 'opaque';
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
