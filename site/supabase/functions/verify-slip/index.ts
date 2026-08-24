import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Confirms a PromptPay transfer against bank records.
 *
 * The browser reads the QR off the customer's slip and sends the reference
 * here; this function asks the slip provider what that reference actually
 * settled, and compares it with what the order asked for. The decision is made
 * here and nowhere else — the client's copy of this logic is a hint for the
 * customer, not a permission.
 *
 * The provider key is shared with the shop's n8n flow, which verifies some
 * slips itself. Two consequences are designed for rather than worked around:
 * the provider reports an already-seen slip as a duplicate, which is treated
 * as confirmation when it belongs to this order; and the unique index on
 * payments.slip_reference settles races between the two systems.
 */

const allowedOrigins = (Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
});

/** Digits only, last four, so proxy formats can be compared across sources. */
const tail = (value: string) => value.replace(/\D/g, '').slice(-4);

type ProviderVerdict =
  | { kind: 'settled'; amount: number; receiver?: string; reference: string; raw: unknown }
  | { kind: 'duplicate'; reference?: string; raw: unknown }
  | { kind: 'not_found'; raw: unknown }
  | { kind: 'unavailable'; raw: unknown };

/**
 * The one place that knows the provider's wire format.
 *
 * Response shapes differ between providers and change between their API
 * versions, so everything provider-specific is confined here: the rest of the
 * function works in terms of ProviderVerdict. Check these field names against
 * the provider's current documentation before going live — a mismatch shows up
 * as every slip landing in manual review, never as a wrong approval.
 */
async function askProvider(slipReference: string): Promise<ProviderVerdict> {
  const apiKey = Deno.env.get('SLIPOK_API_KEY');
  const branchId = Deno.env.get('SLIPOK_BRANCH_ID');
  if (!apiKey || !branchId) return { kind: 'unavailable', raw: 'provider_unconfigured' };

  // Overridable so the endpoint can be corrected from configuration rather
  // than a redeploy. Note this is the API path, not the /webhook/ URL that
  // LINE and the n8n flow post to — same branch id, different purpose.
  const endpoint = Deno.env.get('SLIPOK_API_URL') || `https://api.slipok.com/api/line/apikey/${branchId}`;

  let response: Response;
  let body: Record<string, unknown>;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'x-authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: slipReference, log: true }),
      signal: AbortSignal.timeout(15_000),
    });
    body = await response.json();
  } catch (error) {
    console.error('provider unreachable', error instanceof Error ? error.message : 'unknown');
    return { kind: 'unavailable', raw: 'network_error' };
  }

  const data = (body?.data ?? {}) as Record<string, unknown>;

  if (response.ok && body?.success === true) {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount)) return { kind: 'unavailable', raw: body };
    const receiver = (data.receiver as Record<string, unknown> | undefined)?.proxy as
      | Record<string, unknown>
      | undefined;
    return {
      kind: 'settled',
      amount,
      receiver: receiver?.value ? String(receiver.value) : undefined,
      reference: String(data.transRef ?? slipReference),
      raw: body,
    };
  }

  // A slip the provider has already logged. That is what a correctly working
  // second checker sees, so it is not by itself a failure.
  const code = Number(body?.code ?? 0);
  const message = String(body?.message ?? '');
  if (code === 1012 || /duplicate|ซ้ำ/i.test(message)) {
    return { kind: 'duplicate', reference: data.transRef ? String(data.transRef) : undefined, raw: body };
  }

  if (code === 1002 || response.status === 404) return { kind: 'not_found', raw: body };
  return { kind: 'unavailable', raw: body };
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const headers = { ...cors(origin), 'Content-Type': 'application/json' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST' || (origin && !allowedOrigins.includes(origin))) {
    return new Response('{"error":"request_not_allowed"}', { status: 403, headers });
  }

  try {
    const authorization = request.headers.get('Authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) {
      return new Response('{"error":"authentication_required"}', { status: 401, headers });
    }
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
    );
    const { data: account, error: authError } = await authClient.auth.getUser(authorization.slice(7));
    if (authError || !account.user) {
      return new Response('{"error":"authentication_required"}', { status: 401, headers });
    }

    const body = await request.json();
    const orderNumber = String(body?.orderNumber ?? '').slice(0, 40);
    const slipReference = String(body?.slipReference ?? '').trim().toUpperCase().slice(0, 512);
    const slipPath = String(body?.slipPath ?? '').trim().slice(0, 512);
    if (!orderNumber || (!slipPath && slipReference.length < 8)) throw new Error('invalid_payload');
    if (slipPath && !slipPath.startsWith(`${account.user.id}/`)) throw new Error('invalid_slip_path');

    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    });

    // The expected figure comes from the database, never from the request —
    // otherwise a caller could name the amount its own slip happens to carry.
    const { data: order, error: orderError } = await client
      .from('orders')
      .select('id, user_id, order_number, total, payments(id, status, amount, payable_amount, slip_reference, verification_attempted_at)')
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return new Response('{"status":"rejected","code":"not_found"}', { status: 404, headers });
    if (order.user_id !== account.user.id) {
      return new Response('{"error":"order_not_owned"}', { status: 403, headers });
    }

    // `payments.order_id` is unique, so PostgREST exposes this relationship
    // as a to-one object. Keep array support as well because relationship
    // metadata can differ between local/test projects and production.
    const relatedPayments = order.payments as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | null;
    const payment = Array.isArray(relatedPayments) ? relatedPayments[0] : relatedPayments;
    if (!payment) throw new Error('missing_payment_row');
    const confirmPayment = async (
      verifiedVia: 'provider' | 'staff' | 'automation',
      verification: unknown,
      note: string,
    ) => {
      const { error } = await client.rpc('complete_verified_payment', {
        p_payment_id: payment.id,
        p_verified_via: verifiedVia,
        p_verification: verification,
        p_note: note,
      });
      if (error) throw error;
    };
    if (payment.status === 'verified' || payment.status === 'paid') {
      // Heal older records where payment was verified before the order and
      // dashboard status were linked atomically.
      await confirmPayment('automation', null, 'ยืนยันยอดเรียบร้อย');
      return new Response(JSON.stringify({ status: 'confirmed', reason: 'ยืนยันไปแล้วก่อนหน้านี้' }), { status: 200, headers });
    }
    const attemptedAt = payment.verification_attempted_at ? new Date(String(payment.verification_attempted_at)).getTime() : 0;
    const claimCutoff = new Date(Date.now() - 15_000).toISOString();
    if (attemptedAt && Date.now() - attemptedAt < 15_000) {
      return new Response('{"error":"verification_rate_limited"}', { status: 429, headers });
    }

    // The original image is still valuable when the browser cannot decode its
    // QR. Keep it in the private bucket and put the payment in the staff queue
    // instead of rejecting a genuine transfer for a camera/print-quality issue.
    if (slipReference.length < 8) {
      const reason = 'อ่าน QR บนสลิปไม่ได้ พนักงานจะตรวจสอบจากรูปต้นฉบับ';
      const { data: claimed, error } = await client
        .from('payments')
        .update({
          slip_path: slipPath,
          status: 'pending_verification',
          verification_attempted_at: new Date().toISOString(),
          verification_reason: reason,
        })
        .eq('id', payment.id)
        .or(`verification_attempted_at.is.null,verification_attempted_at.lt.${claimCutoff}`)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!claimed) return new Response('{"error":"verification_rate_limited"}', { status: 429, headers });
      return new Response(JSON.stringify({ status: 'review', code: 'no_qr', reason }), { status: 202, headers });
    }

    const expected = Number(payment.payable_amount ?? payment.amount ?? order.total);

    // Claim the reference before calling out. The unique index rejects a slip
    // already spent on another order, including one n8n recorded a moment ago.
    const { data: claimed, error: claimError } = await client
      .from('payments')
      .update({ slip_reference: slipReference, slip_path: slipPath || null, verification_attempted_at: new Date().toISOString() })
      .eq('id', payment.id)
      .or(`verification_attempted_at.is.null,verification_attempted_at.lt.${claimCutoff}`)
      .select('id')
      .maybeSingle();
    if (claimError) {
      const duplicate = claimError.code === '23505';
      return new Response(
        JSON.stringify({
          status: duplicate ? 'rejected' : 'review',
          code: duplicate ? 'duplicate' : 'storage_error',
          reason: duplicate ? 'สลิปนี้ถูกใช้ยืนยันออเดอร์อื่นแล้ว' : 'บันทึกสลิปไม่สำเร็จ พนักงานจะตรวจสอบ',
        }),
        { status: duplicate ? 409 : 202, headers },
      );
    }
    if (!claimed) return new Response('{"error":"verification_rate_limited"}', { status: 429, headers });

    const verdict = await askProvider(slipReference);

    const settle = async (patch: Record<string, unknown>) => {
      const { error } = await client.from('payments').update(patch).eq('id', payment.id);
      if (error) throw error;
    };

    if (verdict.kind === 'settled') {
      const paid = Math.round(verdict.amount * 100);
      const owed = Math.round(expected * 100);
      if (paid !== owed) {
        const reason = `ยอดโอน ฿${verdict.amount.toFixed(2)} ไม่ตรงกับยอดที่ต้องชำระ ฿${expected.toFixed(2)}`;
        await settle({ status: 'rejected', verified_via: 'provider', verification: verdict.raw, verification_reason: reason });
        return new Response(JSON.stringify({ status: 'rejected', code: 'amount_mismatch', reason }), { status: 200, headers });
      }

      const storeProxy = Deno.env.get('PROMPTPAY_ID');
      if (!storeProxy || !verdict.receiver) {
        const reason = 'ผู้ให้บริการไม่ส่งข้อมูลบัญชีปลายทางครบถ้วน พนักงานจะตรวจสอบ';
        await settle({ status: 'pending_verification', verified_via: 'automation', verification: verdict.raw, verification_reason: reason });
        return new Response(JSON.stringify({ status: 'review', code: 'receiver_unavailable', reason }), { status: 202, headers });
      }
      if (tail(verdict.receiver) !== tail(storeProxy)) {
        const reason = 'บัญชีปลายทางไม่ใช่บัญชีของร้าน';
        await settle({ status: 'rejected', verified_via: 'provider', verification: verdict.raw, verification_reason: reason });
        return new Response(JSON.stringify({ status: 'rejected', code: 'wrong_account', reason }), { status: 200, headers });
      }

      await confirmPayment('provider', verdict.raw, 'ยืนยันยอดกับธนาคารเรียบร้อย');
      return new Response(JSON.stringify({ status: 'confirmed', reason: 'ยืนยันยอดกับธนาคารเรียบร้อย' }), { status: 200, headers });
    }

    if (verdict.kind === 'duplicate') {
      // The reference is ours — the claim above succeeded — so another checker
      // logged this same slip for this same order. Staff still see the note.
      const reason = 'สลิปนี้ถูกตรวจโดยระบบอื่นแล้ว รอพนักงานยืนยันขั้นสุดท้าย';
      await settle({ status: 'pending_verification', verified_via: 'automation', verification: verdict.raw, verification_reason: reason });
      return new Response(JSON.stringify({ status: 'review', code: 'checked_elsewhere', reason }), { status: 202, headers });
    }

    const reason =
      verdict.kind === 'not_found'
        ? 'ธนาคารยังไม่พบรายการโอนนี้ พนักงานจะตรวจสอบ'
        : 'ตรวจสอบกับธนาคารไม่สำเร็จ พนักงานจะตรวจสอบ';
    await settle({ status: 'pending_verification', verification: verdict.raw, verification_reason: reason });
    return new Response(JSON.stringify({ status: 'review', code: verdict.kind, reason }), { status: 202, headers });
  } catch (error) {
    console.error('verify-slip failed', error instanceof Error ? error.message : 'unknown');
    return new Response('{"error":"unable_to_verify_slip"}', { status: 400, headers });
  }
});
