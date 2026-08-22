import { expect, test } from '@playwright/test';

/**
 * Headlines must never be cut off.
 *
 * The site shipped three times with Thai headings sliced into ribbons — a mask
 * cropped to the line box, which works in Latin and cannot work in a script
 * that stacks ไม้โท above the letter and สระอุ below it. Every existing test
 * passed each time, because they all asserted the words were *present*. They
 * were present. They were also cut in half.
 *
 * A bounding rect cannot catch that: it reports the line box, and the marks
 * that get sliced are precisely the ink that sits outside the line box. So
 * this measures the glyphs. Canvas reports where the ink of a specific string
 * in a specific font actually starts and stops, and that is compared against
 * whatever is clipping above it.
 */

const PAGES = ['/', '/menu/', '/about/', '/contact/', '/track/'];

/** Subpixel rounding only. A clipped Thai mark loses several pixels. */
const TOLERANCE = 1.5;

type Cut = { text: string; by: string; lostAbove: number; lostBelow: number };

const findCutText = `(tolerance) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const cut = [];

  // Measure whatever element actually carries the text. A reveal line is a
  // wrapper around a span that the animation moves, so the wrapper sits still
  // while the ink travels — measuring the wrapper would miss exactly the
  // failure this exists to catch.
  const carriers = [
    ...document.querySelectorAll('.reveal-line > span'),
    ...[...document.querySelectorAll('h1, h2, h3')].filter((h) => !h.querySelector('.reveal-line')),
  ];

  for (const line of carriers) {
    const text = line.textContent && line.textContent.trim();
    if (!text) continue;

    const box = line.getBoundingClientRect();
    if (!box.height) continue;

    // The nearest ancestor that clips is the one that decides this line's fate.
    let frame = null, framedBy = '';
    for (let node = line.parentElement; node; node = node.parentElement) {
      const s = getComputedStyle(node);
      if (/hidden|clip/.test(s.overflowY) || /hidden|clip/.test(s.overflow)) {
        frame = node.getBoundingClientRect();
        framedBy = node.tagName.toLowerCase() + '.' + (String(node.className).split(' ')[0] || '(none)');
        break;
      }
    }
    if (!frame) continue;

    const style = getComputedStyle(line);
    ctx.font = style.fontStyle + ' ' + style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    const m = ctx.measureText(text);
    if (!m.actualBoundingBoxAscent && !m.actualBoundingBoxDescent) continue;

    // Where the baseline sits inside the line box, then where the ink reaches
    // above and below it.
    const lineHeight = parseFloat(style.lineHeight) || box.height;
    const fontHeight = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
    const baseline = box.top + (lineHeight - fontHeight) / 2 + m.fontBoundingBoxAscent;
    const inkTop = baseline - m.actualBoundingBoxAscent;
    const inkBottom = baseline + m.actualBoundingBoxDescent;

    const lostAbove = frame.top - inkTop;
    const lostBelow = inkBottom - frame.bottom;
    if (lostAbove > tolerance || lostBelow > tolerance) {
      cut.push({
        text: text.slice(0, 40),
        by: framedBy,
        lostAbove: Math.round(Math.max(0, lostAbove)),
        lostBelow: Math.round(Math.max(0, lostBelow)),
      });
    }
  }
  return cut;
}`;

for (const path of PAGES) {
  test(`no heading is cut off on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Let every reveal finish; a heading that settles late is still a heading.
    await page.waitForTimeout(1500);

    const cut: Cut[] = await page.evaluate(`(${findCutText})(${TOLERANCE})`);
    expect(cut, `text cut off on ${path}: ${JSON.stringify(cut, null, 2)}`).toEqual([]);
  });
}

test('the guard notices when something starts clipping', async ({ page }) => {
  // Proof that the check above can fail. This puts back exactly what the shop
  // photographed: a line box with its overflow hidden, and the text inside it
  // shifted part-way out. Without this, a check that never fires reads exactly
  // like a site that is fine.
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1200);

  await page.addStyleTag({
    content: '.reveal-line { overflow: hidden; } .reveal-line > span { transform: translateY(55%); }',
  });
  await page.waitForTimeout(200);

  const cut: Cut[] = await page.evaluate(`(${findCutText})(${TOLERANCE})`);
  expect(cut.length, 'the clipping guard failed to notice cut-off text').toBeGreaterThan(0);
});

test('a revealed headline comes fully to rest', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const line = page.locator('.hero-copy .reveal-line > span').first();
  await expect(line).toBeVisible();

  // Settled means settled: no leftover offset, no leftover transparency.
  await expect
    .poll(async () =>
      line.evaluate((node) => ({
        offset: Math.round(
          Math.abs(node.getBoundingClientRect().top - node.parentElement!.getBoundingClientRect().top),
        ),
        opacity: Number(getComputedStyle(node).opacity),
      })),
    )
    .toEqual({ offset: 0, opacity: 1 });
});

test('headlines survive a load with no animation at all', async ({ page }) => {
  // The worst case is the reveal never running. The words still have to be
  // there, whole, at their proper size.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const heading = page.locator('.hero-copy h1');
  await expect(heading).toBeVisible();
  expect(await heading.evaluate((n) => n.getBoundingClientRect().height)).toBeGreaterThan(60);
});
