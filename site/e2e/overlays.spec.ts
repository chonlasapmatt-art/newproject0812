import { expect, test } from './fixtures';

/**
 * Overlays have to actually overlay.
 *
 * This is here because the dish sheet stopped doing so for days without a
 * single test noticing: it was still in the DOM, still "visible" to a
 * selector, and every assertion about its contents passed — while it rendered
 * inline near the bottom of the page with the sticky toolbar drawn over it.
 *
 * So these assert position rather than presence: on screen, centred, and with
 * nothing painted on top of the button a customer has to press.
 */

async function openTheDishSheet(page: import('@playwright/test').Page) {
  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /เลือกตัวเลือก/ }).first().click();
  await expect(page.locator('.product-modal')).toBeVisible();
}

test('the dish sheet floats over the page rather than sitting in it', async ({ page }) => {
  await openTheDishSheet(page);

  // Asserted on where the sheet lands, not on which CSS property puts it
  // there. The mechanism has changed three times; what must not change is that
  // a customer sees it, whole and centred, without scrolling.
  //
  // Polled rather than measured once: the sheet is visible the instant it
  // mounts, which is the middle of its entrance, and a single reading catches
  // it in flight. What matters is where it comes to rest.
  await expect
    .poll(() =>
      page.locator('.product-modal').evaluate((sheet) => {
        const box = sheet.getBoundingClientRect();
        const layer = sheet.closest('.modal-layer');
        const offCentre = Math.max(
          Math.abs((box.left + box.right) / 2 - window.innerWidth / 2),
          Math.abs((box.top + box.bottom) / 2 - window.innerHeight / 2),
        );
        return {
          centred: offCentre < 6,
          whollyOnScreen:
            box.top >= 0 && box.left >= 0 && box.bottom <= window.innerHeight && box.right <= window.innerWidth,
          // Whatever holds it must be pinned to the viewport, or the sheet
          // scrolls away with the page underneath it.
          pinned: layer !== null && getComputedStyle(layer).position === 'fixed',
        };
      }),
    )
    .toEqual({ centred: true, whollyOnScreen: true, pinned: true });
});

test('nothing floats above the add button', async ({ page }) => {
  await openTheDishSheet(page);

  // The chat launcher and the back-to-top button are fixed to the same corner
  // the add button occupies on a phone. Whatever is under that point has to be
  // the button itself, or a customer taps a chat bubble instead of ordering.
  const add = page.getByRole('button', { name: /เพิ่มลงตะกร้า/ });
  await add.scrollIntoViewIfNeeded();
  const covering = await add.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const onTop = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return onTop === button || button.contains(onTop) ? null : (onTop?.className ?? 'unknown');
  });
  expect(covering).toBeNull();
});

test('the sheet closes and gives the page back', async ({ page }) => {
  await openTheDishSheet(page);
  await page.locator('.modal-close').click();
  await expect(page.locator('.product-modal')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /เลือกตัวเลือก/ }).first()).toBeVisible();
});
