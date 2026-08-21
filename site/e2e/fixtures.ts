import { test as base } from '@playwright/test';

/**
 * Shared test setup.
 *
 * The opening sequence covers the page for about two seconds on the first load
 * of a fresh tab. That is right for a visitor and wrong for a test: every
 * navigation would spend the time waiting for it to lift, and the suite starts
 * failing on timeouts rather than on defects.
 *
 * Marking it as already seen before any page script runs skips it, exactly as
 * it is skipped for someone returning to a tab they have already used. Tests
 * that exercise the opening itself should use the raw `test` from Playwright.
 */
export const test = base.extend({
  page: async ({ page }, runTest) => {
    await page.addInitScript(() => {
      try {
        sessionStorage.setItem('imjai-intro-seen', '1');
      } catch {
        // Storage unavailable: the opening plays and the test waits it out.
      }
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
