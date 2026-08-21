import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '').split(',').filter(Boolean);
const cors = (origin: string | null) => ({ 'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? '', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' });

Deno.serve(async (request) => {
  const origin = request.headers.get('origin');
  const headers = { ...cors(origin), 'Content-Type': 'application/json' };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST' || (origin && !allowedOrigins.includes(origin))) return new Response('{"error":"request_not_allowed"}', { status: 403, headers });
  try {
    const body = await request.json();
    if (!body?.idempotencyKey || !Array.isArray(body?.items) || body.items.length > 50) throw new Error('invalid_payload');
    if (!/^0[0-9]{8,9}$/.test(String(body.customer?.phone ?? ''))) throw new Error('invalid_customer');
    const authHeader = request.headers.get('Authorization') ?? '';
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { global: { headers: authHeader ? { Authorization: authHeader } : {} }, auth: { persistSession: false } });
    const payload = { idempotency_key: body.idempotencyKey, customer: { name: String(body.customer.name).slice(0,100), phone: String(body.customer.phone).slice(0,10) }, fulfilment: body.fulfilment, address: body.fulfilment === 'delivery' ? body.address : null, note: String(body.note ?? '').slice(0,300), payment_method: body.paymentMethod, coupon: String(body.coupon ?? '').slice(0,30).toUpperCase(), items: body.items.map((item: Record<string, unknown>) => ({ sku: String(item.sku).slice(0,30), quantity: Math.min(Math.max(Number(item.quantity) || 1,1),20), options: Array.isArray(item.options) ? item.options.slice(0,10) : [], addOns: Array.isArray(item.addOns) ? item.addOns.slice(0,10) : [], note: String(item.note ?? '').slice(0,160) })) };
    const { data, error } = await client.rpc('create_order_secure', { p_payload: payload });
    if (error) throw error;
    return new Response(JSON.stringify({ orderNumber: data.order_number, total: data.total }), { status: 200, headers });
  } catch (error) {
    console.error('create-order failed', error instanceof Error ? error.message : 'unknown');
    return new Response('{"error":"unable_to_create_order"}', { status: 400, headers });
  }
});
