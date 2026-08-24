import { expect, test } from './fixtures';

/**
 * The brightness control.
 *
 * The point of these is the two things a theme gets wrong most often: the
 * choice not surviving a page change, and the page painting white for a frame
 * before the stored choice is applied — which is exactly the flash the shop
 * asked to be rid of.
 */

test('a chosen tone is applied, remembered, and carried across pages', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: 'เปลี่ยนโทนสีเว็บ' }).click();
  await page.getByRole('menuitemradio', { name: /นวลตา/ }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'soft');

  await page.goto('/menu');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'soft');
});

test('a stored dark choice is on the page before it paints', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('imjai-theme', 'dark');
    } catch {
      // Storage unavailable: the assertion below will say so.
    }
  });

  // Read at DOMContentLoaded rather than after load: an attribute applied by
  // React on hydration would arrive later than this and show a white flash.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  const surface = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = surface.match(/\d+/g)!.map(Number);
  // A dark ground, not merely a different one.
  expect((r + g + b) / 3).toBeLessThan(70);
});

test('following the device is the default', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

/**
 * Panels that keep a fixed light card colour across every theme.
 *
 * The redesign gave several storefront panels — the map's address card, the
 * review cards, a dish's stock badge, the cart summary, the assistant's
 * message list — a background that stays light on purpose (the map, the
 * drawer, and the chat panel are meant to read as paper regardless of
 * theme). Each one shipped without its own text colour, so in dark mode the
 * text inherited the theme's default ink — which is *light* in dark mode —
 * and went the same colour as the card. The text was there; it was reading
 * white on white.
 *
 * The fix took one of two forms depending on what the card was for: a fixed
 * dark ink where the background is genuinely meant to stay light forever
 * (the address card, review cards, stock badge), or switching the background
 * onto the same theme token its own container already uses (the cart summary
 * and the assistant's messages, which sit inside a drawer and a panel that
 * were already theme-aware — only the inner strip had been left behind).
 *
 * Contrast is checked from the rendered pixels rather than from CSS, because
 * the actual failure mode here was never a colour keyword — it was a
 * component whose background and text happened to compute to nearby shades
 * once dark mode changed one of them. Reading computed styles and redoing
 * that arithmetic would just repeat the mistake in a different place, so
 * this crops the true rendered element and asks whether it holds more than
 * one distinguishable tone.
 */

/**
 * True once a screenshot clipped to the element shows at least two
 * meaningfully different tones — one for the glyphs, one for the ground.
 * Text and background painted the same colour produce a clip that is, give or
 * take antialiasing, a single tone throughout.
 *
 * The PNG is decoded inside the page with a canvas rather than with a Node
 * library, because the browser already has a decoder and this avoids adding
 * a dependency just to read pixels back out of a screenshot it just took.
 */
async function hasVisibleText(locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox();
  if (!box || box.width < 2 || box.height < 2) return true; // nothing to judge

  const png = await locator.page().screenshot({ clip: box });

  return locator.page().evaluate(async (base64) => {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('screenshot failed to decode'));
    });
    image.src = `data:image/png;base64,${base64}`;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const relativeLuminance = ([r, g, b]: [number, number, number]) => {
      const f = (c: number) => {
        c /= 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };

    // Neither a trimmed percentile nor the true extremes works here. A
    // password field's dots are a small enough share of the box that
    // trimming the extremes (meant to ignore antialiasing noise) trims the
    // dots away with it; the true min and max go the other way and catch a
    // single antialiased pixel at a glyph's edge even when the glyph itself
    // is unreadable — which is exactly the shape of the bug this exists to
    // catch: near-black text on a near-black field is not pure black on
    // pure black, it is close enough that only its edges show at all.
    //
    // So this asks a different question: ignoring the background colour
    // itself (the single most common tone, found the same way a flood-fill
    // would), is there a real cluster of pixels that reads as a distinct
    // tone from it — not one stray antialiased dot, but enough pixels that
    // it has to be an actual glyph? The histogram buckets luminance into 40
    // steps; the background owns whichever bucket most of the box agrees on.
    const buckets = new Array(40).fill(0);
    const luminances = new Float64Array(data.length / 4);
    for (let i = 0, n = 0; i < data.length; i += 4, n += 1) {
      const l = relativeLuminance([data[i], data[i + 1], data[i + 2]]);
      luminances[n] = l;
      buckets[Math.min(39, Math.floor(l * 40))] += 1;
    }
    const backgroundBucket = buckets.indexOf(Math.max(...buckets));
    const backgroundLuminance = (backgroundBucket + 0.5) / 40;

    // A pixel counts as ink once it clears a real contrast margin from the
    // background tone — comfortably past antialiasing noise, well short of
    // the polish a design would actually aim for.
    let inkPixels = 0;
    for (const l of luminances) {
      const ratio = (Math.max(l, backgroundLuminance) + 0.05) / (Math.min(l, backgroundLuminance) + 0.05);
      if (ratio > 2.2) inkPixels += 1;
    }
    // A stray antialiased edge is a handful of pixels; an actual glyph —
    // even a password field's dots — is not.
    return inkPixels > luminances.length * 0.003;
  }, png.toString('base64'));
}

test.describe('fixed-light panels stay readable in dark mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
  });

  test('the address card heading and labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const section = page.locator('.visit-copy');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    expect(await hasVisibleText(section.locator('h2'))).toBe(true);
    expect(await hasVisibleText(section.locator('dd').first())).toBe(true);
  });

  test('a review card', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const card = page.locator('.review-grid article').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    expect(await hasVisibleText(card.locator('p'))).toBe(true);
  });

  test('a dish stock badge', async ({ page }) => {
    await page.goto('/menu');
    await page.waitForLoadState('networkidle');
    const badge = page.locator('.catalog-art > small').first();
    await badge.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    expect(await hasVisibleText(badge)).toBe(true);
  });

  // .contact-card.is-primary (the LINE card) carries its own light-mint
  // gradient in light mode, same idea as the panels above but the opposite
  // direction: this one is the card that is NOT supposed to go fully dark.
  // --ink-faint had no dark-mode value at all, so .contact-label fell back to
  // a hardcoded tone that read fine against a plain dark card but nearly
  // vanished against this card's lighter corner.
  test('the LINE contact card label', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    const card = page.locator('.contact-card.is-primary');
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    expect(await hasVisibleText(card.locator('.contact-label'))).toBe(true);
  });
});

/**
 * Form fields keep their typed text visible in every theme.
 *
 * Browsers give `input`/`textarea`/`select` their own default text colour
 * rather than inheriting one, so a themed background with no themed text
 * colour to match runs the same failure as the fixed-light panels above, just
 * inverted: dark mode's default text colour never gets a chance to apply, and
 * the browser's own default — black — sits on the field's now-dark
 * background. Password fields make it hardest to notice, because the dots
 * that stand in for the characters are exactly the thing that goes missing.
 */
test('typed text is visible in a themed input in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/account');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'สมัครสมาชิก' }).click();

  const password = page.locator('input[type="password"]');
  await password.fill('checking-visibility');
  expect(await hasVisibleText(password)).toBe(true);

  const email = page.locator('input[type="email"]');
  await email.fill('checking@example.com');
  expect(await hasVisibleText(email)).toBe(true);
});
