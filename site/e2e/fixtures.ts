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

export { expect } from '@playwright/test';
