'use client';

import jsQR from 'jsqr';

/**
 * Read the QR a Thai bank prints on a transfer slip, in the browser.
 *
 * Doing this client-side means an unreadable screenshot is caught before the
 * customer waits on an upload, and the order carries a reference the server can
 * check for reuse. It is not a trust boundary — the server re-checks whatever
 * arrives.
 */

/** Longest edge we scale to before scanning; large enough for phone screenshots. */
const MAX_EDGE = 1400;

export type SlipScan = {
  /** Decoded payload, or null when no QR could be read. */
  payload: string | null;
  /** Pixel dimensions actually scanned, useful for diagnostics. */
  scanned: { width: number; height: number };
};

function drawToCanvas(source: CanvasImageSource, width: number, height: number) {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('2D canvas is unavailable');

  // Slips are dark-on-white; a white ground keeps any alpha from reading as black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, w, h);
  context.drawImage(source, 0, 0, w, h);
  return { data: context.getImageData(0, 0, w, h), width: w, height: h };
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('ไม่สามารถเปิดไฟล์รูปได้'));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Scan an uploaded slip image for its QR.
 *
 * Resolves with `payload: null` rather than throwing when nothing is found —
 * an unreadable slip is a routine outcome that routes to manual review, not an
 * error the caller should handle specially.
 */
export async function decodeSlipImage(file: File): Promise<SlipScan> {
  try {
    const { source, width, height } = await loadImage(file);
    const { data, width: w, height: h } = drawToCanvas(source, width, height);

    // attemptBoth handles slips rendered light-on-dark by some banking apps.
    const found = jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
    return { payload: found?.data ?? null, scanned: { width: w, height: h } };
  } catch {
    return { payload: null, scanned: { width: 0, height: 0 } };
  }
}
