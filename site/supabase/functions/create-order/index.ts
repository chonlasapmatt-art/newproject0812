import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

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

const reply = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers });

/**
 * `create_order_secure` raises a plain-text exception for everything from an
 * empty cart to a sold-out item, and Postgres itself raises one more —
 * `no_data_found` (P0002) — when the `select ... for update` for a line finds
 * no matching, available, in-stock row. Collapsing all of that into one
 * "unable_to_create_order" left the checkout page with nothing to tell a
 * customer apart from "try again", even for a sold-out item that trying again
 * can never fix. This turns the ones worth telling apart into a stable code;
 * anything unrecognised still falls back to the generic one rather than
 * leaking a raw database message to the browser.
 */
function mapOrderError(error: { code?: string; message?: string }): string {
  if (error?.code === 'P0002') return 'item_unavailable';
  const message = String(error?.message ?? '');
  if (/insufficient stock/i.test(message)) return 'item_unavailable';
  if (/too many orders|daily order limit/i.test(message)) return 'rate_limited';
  if (/cart empty|too many items/i.test(message)) return 'invalid_cart';
  if (/delivery address/i.test(message)) return 'invalid_address';
  if (/invalid phone|customer required/i.test(message)) return 'invalid_customer';
  if (/invalid option|invalid add-on/i.test(message)) return 'invalid_selection';
  return 'unable_to_create_order';
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const headers = { ...cors(origin), 'Content-Type': 'application/json' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST' || (origin && !allowedOrigins.includes(origin))) {
    return reply({ error: 'request_not_allowed' }, 403, headers);
  }

  try {
    const authorization = request.headers.get('Authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return reply({ error: 'authentication_required' }, 401, headers);

    // Use the caller's JWT all the way into Postgres. The RPC is SECURITY
    // DEFINER for its transaction, but begins by requiring auth.uid(), prices
    // every line from trusted rows and ties an idempotency key to its owner.
    const client = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
    );
    const { data: account, error: authError } = await client.auth.getUser(authorization.slice(7));
    if (authError || !account.user) return reply({ error: 'authentication_required' }, 401, headers);

    const body = await request.json();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        String(body?.idempotencyKey ?? ''),
      ) ||
      !Array.isArray(body?.items) ||
      body.items.length < 1 ||
      body.items.length > 50
    ) return reply({ error: 'invalid_payload' }, 400, headers);
    if (!/^0[0-9]{8,9}$/.test(String(body.customer?.phone ?? ''))) {
      return reply({ error: 'invalid_customer' }, 400, headers);
    }
    if (!['pickup', 'delivery'].includes(String(body.fulfilment))) {
      return reply({ error: 'invalid_fulfilment' }, 400, headers);
    }
    if (!['cash', 'promptpay'].includes(String(body.paymentMethod))) {
      return reply({ error: 'invalid_payment_method' }, 400, headers);
    }

    const payload = {
      idempotency_key: body.idempotencyKey,
      customer: {
        name: String(body.customer?.name ?? '').trim().slice(0, 100),
        phone: String(body.customer.phone).slice(0, 10),
      },
      fulfilment: body.fulfilment,
      address: body.fulfilment === 'delivery' ? String(body.address ?? '').trim().slice(0, 300) : null,
      note: String(body.note ?? '').trim().slice(0, 300),
      payment_method: body.paymentMethod,
      coupon: String(body.coupon ?? '').trim().slice(0, 30).toUpperCase(),
      items: body.items.map((item: Record<string, unknown>) => ({
        sku: String(item.sku ?? '').trim().slice(0, 30),
        quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), 20),
        options: Array.isArray(item.options) ? item.options.map(String).slice(0, 10) : [],
        addOns: Array.isArray(item.addOns) ? item.addOns.map(String).slice(0, 10) : [],
        note: String(item.note ?? '').trim().slice(0, 160),
      })),
    };

    const { data, error } = await client.rpc('create_order_secure', { p_payload: payload });
    if (error) {
      console.error('create-order rpc failed', error.code, error.message);
      return reply({ error: mapOrderError(error) }, 400, headers);
    }
    return reply({
      orderId: data.order_id,
      orderNumber: data.order_number,
      subtotal: Number(data.subtotal),
      discount: Number(data.discount),
      deliveryFee: Number(data.delivery_fee),
      total: Number(data.total),
      payableAmount: Number(data.payable_amount),
    }, 200, headers);
  } catch (error) {
    console.error('create-order failed', error instanceof Error ? error.message : 'unknown');
    return reply({ error: 'unable_to_create_order' }, 400, headers);
  }
});
