/**
 * What checkout tells a customer, and what it lets them repeat back to staff,
 * when something in the two-phase order flow goes wrong.
 */

const DEFAULT_CHECKOUT_ERROR =
  'ยังดำเนินการไม่สำเร็จ ข้อมูลออเดอร์เดิมยังอยู่ กรุณาลองอีกครั้งหรือติดต่อร้านที่ 099-875-6879';

const CHECKOUT_ERROR_MESSAGE: Record<string, string> = {
  item_unavailable: 'สินค้าบางรายการในตะกร้าหมดหรือมีไม่พอแล้ว กรุณาปรับจำนวนหรือนำออกจากตะกร้าแล้วลองใหม่',
  rate_limited: 'สั่งซื้อถี่เกินไปในช่วงนี้ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
  invalid_cart: 'ตะกร้าว่างหรือมีสินค้ามากเกินไป กรุณาตรวจสอบตะกร้าอีกครั้ง',
  invalid_address: 'ที่อยู่จัดส่งไม่ครบถ้วน กรุณากรอกรายละเอียดที่อยู่เพิ่มเติม',
  invalid_customer: 'ชื่อหรือเบอร์โทรไม่ถูกต้อง กรุณาตรวจสอบข้อมูลผู้สั่ง',
  invalid_selection: 'ตัวเลือกหรือของเพิ่มที่เลือกไม่ตรงกับเมนู กรุณาเลือกใหม่อีกครั้ง',
  verification_rate_limited: 'ระบบกำลังตรวจสลิปจากการส่งครั้งก่อนอยู่ กรุณารอ 15 วินาทีแล้วกดยืนยันอีกครั้ง',
  authentication_required: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองสั่งซื้ออีกครั้ง',
};

/**
 * Every failure used to show the same sentence, whether the cause was a
 * sold-out item, a session that had quietly expired, or a real server error —
 * none of which "try again" answers the same way. The Edge Functions carry a
 * specific code for the ones worth telling apart, either in a JSON body (a
 * thrown `FunctionsHttpError`'s `.context` is the raw Response — see the
 * supabase-js docs for that exact shape) or as the message of a plain `Error`
 * thrown locally. Anything unrecognised keeps the original, always-safe
 * default rather than guessing at a cause the code doesn't actually know.
 */
export async function checkoutErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  let code = '';
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown; code?: unknown };
      code = String(body?.error ?? body?.code ?? '');
    } catch {
      code = '';
    }
  } else if (error instanceof Error) {
    code = error.message;
  }
  return CHECKOUT_ERROR_MESSAGE[code] ?? DEFAULT_CHECKOUT_ERROR;
}

/**
 * The order number checkout offers a customer to quote back to staff over
 * LINE. `preview` is generated in the browser before the server has agreed to
 * anything — real once Supabase is never in the picture, which is the whole
 * point of it in that mode, but a name for nothing once Supabase is live and
 * the server call actually failed: staff searching the dashboard for it would
 * find no such order, because there isn't one. So the preview number is only
 * ever offered when there is no server that could have failed to create it.
 */
export function lineHintOrderNumber(
  serverOrderNumber: string | undefined,
  preview: string | undefined,
  isSupabaseConfigured: boolean,
): string | undefined {
  return serverOrderNumber ?? (isSupabaseConfigured ? undefined : preview);
}
