'use client';

/**
 * The reference a checkout session pays against.
 *
 * It has to exist before the customer submits, because the PromptPay QR bakes
 * the order's satang suffix into the amount — and it has to be identical when
 * the order is finally sent, or the transfer maps to nothing.
 *
 * It cannot be generated during render either: `crypto.randomUUID()` would
 * produce one value on the server and a different one at hydration. So it
 * lives outside React, is created lazily on first client read, and is exposed
 * through `useSyncExternalStore` — which reports `null` on the server and the
 * stable reference on the client, with no state update during an effect.
 */

export type OrderRef = {
  /** Guards against a double-submit creating two orders. */
  idempotencyKey: string;
  /** Human-facing code shown on the QR hint and the tracking page. */
  orderNumber: string;
};

let current: OrderRef | null = null;
const listeners = new Set<() => void>();

function create(): OrderRef {
  const idempotencyKey = crypto.randomUUID();
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = idempotencyKey.replace(/-/g, '').slice(0, 4).toUpperCase();
  return { idempotencyKey, orderNumber: `IJ${stamp}-${suffix}` };
}

export function subscribeOrderRef(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Client snapshot — stable across renders so the store never loops. */
export function getOrderRef(): OrderRef {
  current ??= create();
  return current;
}

/** Server snapshot — no reference exists until the browser asks for one. */
export function getServerOrderRef(): null {
  return null;
}

/**
 * Start a fresh reference. Called once an order is accepted, so the next
 * basket cannot reuse a number that has already been paid.
 */
export function renewOrderRef() {
  current = create();
  for (const listener of listeners) listener();
}
