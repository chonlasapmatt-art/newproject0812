import { test as base } from '@playwright/test';

/**
 * Shared test setup.
 *
 * The opening sequence now plays on every navigation — including a client-side
 * one, not just a fresh document — and covers the page while it does. Waiting
 * it out on every test navigation would spend real time and risk the suite
 * failing on timeouts rather than on defects.
 *
 * The component already leaves on any keypress, for a visitor who wants past
 * it — this dispatches one on a short poll for as long as the page lives,
 * which clears each appearance in roughly one hydration tick instead of the
 * full hold. It has to keep running for the page's whole lifetime rather than
 * stopping after the first one: `addInitScript` only re-runs on a fresh
 * document, and a same-document route change is exactly the case where the
 * opening now replays without one. Tests that exercise the opening itself
 * should use the raw `test` from Playwright.
 */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await page.addInitScript(() => {
      window.setInterval(() => {
        if (!document.querySelector('.boot')) return;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }, 30);
    });

    // Serve the webfont request locally. Reaching the real font host makes
    // every navigation depend on the network — slow where it is reachable,
    // and a long timeout on any machine where it is not. The fallback stack
    // renders the same layout, which is what these tests assert on.
    await page.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/css', body: '' }),
    );
    await page.route('https://fonts.gstatic.com/**', (route) => route.abort());

    await runTest(page);
  },
});

/**
 * Put a signed-in session in place before the page loads.
 *
 * Writes the same record lib/session reads, so the app comes up already signed
 * in without a test having to drive the account form for every case that
 * merely needs an account to exist.
 */
export async function signIn(page: import('@playwright/test').Page, email = 'customer@example.com') {
  await page.addInitScript((address) => {
    try {
      localStorage.setItem(
        'imjai-session',
        JSON.stringify({ email: address, name: address.split('@')[0], verified: false }),
      );
    } catch {
      // Storage unavailable: the test will see the signed-out view and say so.
    }
  }, email);
}

/**
 * The address the end-to-end build treats as staff.
 *
 * NEXT_PUBLIC_ADMIN_EMAILS is baked in at build time, so the suite cannot
 * grant itself the role at runtime — the build under test has to have been
 * told. The workflow passes this same address when it builds the copy these
 * tests run against.
 */
export const ADMIN_EMAIL = 'admin@imjai.test';

/**
 * Put orders in place before the app boots, as if they had been placed here.
 *
 * The script runs on every navigation, so it seeds only when the shop is
 * empty. Writing unconditionally would undo whatever the test just did the
 * moment it moved to another page — a dashboard edit would look as though it
 * had never been saved.
 */
export async function seedOrders(page: import('@playwright/test').Page, orders: unknown[]) {
  await page.addInitScript((records) => {
    try {
      if (localStorage.getItem('imjai-orders')) return;
      localStorage.setItem('imjai-orders', JSON.stringify(records));
    } catch {
      // Storage unavailable: the test will see an empty shop and say so.
    }
  }, orders);
}

/** One plausible order, overridable per test. */
export function anOrder(over: Record<string, unknown> = {}) {
  return {
    orderNumber: 'IJ260821-TEST',
    idempotencyKey: 'e2e-1',
    name: 'ลูกค้าทดสอบ',
    phone: '0899999999',
    fulfilment: 'pickup',
    payment: 'promptpay',
    lines: [{ id: 'l1', sku: 'FD-01', name: 'ข้าวผัดกะเพราหมูสับ ไข่ดาว', unitPrice: 79, quantity: 2, emoji: '🍳' }],
    totals: { subtotal: 158, discount: 0, deliveryFee: 0, total: 158 },
    payableAmount: 158.42,
    slipReference: null,
    paymentNote: null,
    status: 'pending',
    paymentStatus: 'pending_verification',
    createdAt: new Date().toISOString(),
    accountEmail: 'customer@example.com',
    ...over,
  };
}

export { expect } from '@playwright/test';
