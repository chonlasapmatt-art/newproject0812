import { describe, expect, it } from 'vitest';
import { checkoutErrorMessage, lineHintOrderNumber } from '../lib/checkout-errors';

/**
 * A thrown `FunctionsHttpError`'s `.context` is the raw Response the Edge
 * Function answered with — this is what supabase-js actually hands the
 * caller, per its own docs (`await error.context.json()`).
 */
function httpError(body: unknown, status = 400): unknown {
  return { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: new Response(JSON.stringify(body), { status }) };
}

describe('checkoutErrorMessage', () => {
  it('names a sold-out item instead of suggesting a retry that cannot work', async () => {
    const message = await checkoutErrorMessage(httpError({ error: 'item_unavailable' }));
    expect(message).toMatch(/หมดหรือมีไม่พอ/);
  });

  it('reads the code from either an "error" or a "code" field', async () => {
    // verify-slip's not-found response uses `code`, not `error` — both must resolve.
    const message = await checkoutErrorMessage(httpError({ status: 'rejected', code: 'rate_limited' }, 404));
    expect(message).toMatch(/ถี่เกินไป/);
  });

  it('tells a rate-limited slip retry to wait, not to contact the shop', async () => {
    const message = await checkoutErrorMessage(httpError({ error: 'verification_rate_limited' }, 429));
    expect(message).toMatch(/15 วินาที/);
  });

  it('reads a plain Error thrown locally, such as an expired session', async () => {
    const message = await checkoutErrorMessage(new Error('authentication_required'));
    expect(message).toMatch(/เซสชันหมดอายุ/);
  });

  it('falls back to the generic message for a code it does not recognise', async () => {
    const message = await checkoutErrorMessage(new Error('invalid_order_quote'));
    expect(message).toMatch(/ติดต่อร้านที่ 099-875-6879/);
  });

  it('falls back to the generic message for a body that is not JSON', async () => {
    const broken = { context: new Response('not json', { status: 500 }) };
    const message = await checkoutErrorMessage(broken);
    expect(message).toMatch(/ติดต่อร้านที่ 099-875-6879/);
  });

  it('never throws on a nullish or shapeless error', async () => {
    await expect(checkoutErrorMessage(null)).resolves.toMatch(/ติดต่อร้านที่ 099-875-6879/);
    await expect(checkoutErrorMessage(undefined)).resolves.toMatch(/ติดต่อร้านที่ 099-875-6879/);
    await expect(checkoutErrorMessage('a plain string')).resolves.toMatch(/ติดต่อร้านที่ 099-875-6879/);
  });
});

describe('lineHintOrderNumber', () => {
  it('offers the confirmed server order number once there is one', () => {
    expect(lineHintOrderNumber('IJ260824-A3F91C', 'IJ260824-FDCA', true)).toBe('IJ260824-A3F91C');
  });

  it('withholds the browser-only preview number once Supabase is live and creation failed', () => {
    // Staff cannot find this number in the dashboard — no order was ever
    // created — so it must never be offered as something to quote back.
    expect(lineHintOrderNumber(undefined, 'IJ260824-FDCA', true)).toBeUndefined();
  });

  it('still offers the preview number in the no-database demo build', () => {
    // There is no server in this mode, so the preview number is the only
    // number that will ever exist — withholding it here would show nothing.
    expect(lineHintOrderNumber(undefined, 'IJ260824-FDCA', false)).toBe('IJ260824-FDCA');
  });
});
