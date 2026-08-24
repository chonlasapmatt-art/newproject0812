import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

async function sameSecret(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let mismatch = aa.length ^ bb.length;
  for (let index = 0; index < Math.max(aa.length, bb.length); index += 1) {
    mismatch |= (aa[index] ?? 0) ^ (bb[index] ?? 0);
  }
  return mismatch === 0 && left.length > 0;
}

const lineId = (value: unknown) => {
  const id = String(value ?? '').trim();
  return /^U[0-9a-fA-F]{32}$/.test(id) ? id : '';
};

type DatabaseOrder = Record<string, unknown> & {
  order_items?: Array<Record<string, unknown>>;
  payments?: Record<string, unknown> | Array<Record<string, unknown>> | null;
};

function safeOrder(row: DatabaseOrder) {
  const rawPayment = Array.isArray(row.payments) ? row.payments[0] : row.payments;
  const payment = rawPayment && typeof rawPayment === 'object' ? rawPayment : {};
  return {
    orderNumber: String(row.order_number ?? ''),
    status: String(row.status ?? 'pending'),
    fulfilment: String(row.fulfilment ?? 'pickup'),
    total: Number(row.total ?? 0),
    estimatedReadyAt: row.estimated_ready_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    payment: {
      method: String(payment.method ?? ''),
      status: String(payment.status ?? ''),
      payableAmount: Number(payment.payable_amount ?? payment.amount ?? row.total ?? 0),
      note: String(payment.verification_reason ?? ''),
    },
    items: (row.order_items ?? []).map((item) => ({
      name: String(item.name_snapshot ?? ''),
      quantity: Number(item.quantity ?? 0),
      options: Array.isArray(item.selected_options) ? item.selected_options.map(String) : [],
      addOns: Array.isArray(item.selected_add_ons) ? item.selected_add_ons.map(String) : [],
    })),
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const configuredSecret = Deno.env.get('N8N_SHARED_SECRET') ?? '';
  const suppliedSecret = request.headers.get('x-n8n-secret') ?? '';
  if (!await sameSecret(suppliedSecret, configuredSecret)) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    if (action === 'completeLink') {
      const id = lineId(body.lineUserId);
      const nonce = String(body.nonce ?? '');
      const result = body.result === 'failed' ? 'failed' : 'ok';
      if (!id || !/^[0-9a-f]{64}$/.test(nonce)) {
        return json({ error: 'invalid_link_payload' }, 400);
      }
      const { data, error } = await admin.rpc('complete_line_account_link', {
        p_nonce: nonce,
        p_line_user_id: id,
        p_result: result,
      });
      if (error) {
        console.error('complete link failed', error.code, error.message);
        return json({ error: 'link_not_completed' }, 400);
      }
      return json(data);
    }

    if (action === 'claimNotifications') {
      const requested = Number(body.limit ?? 30);
      const limit = Number.isInteger(requested) ? Math.max(1, Math.min(requested, 50)) : 30;
      const { data, error } = await admin.rpc('claim_line_order_notifications', { p_limit: limit });
      if (error) throw error;
      return json({
        notifications: (data ?? []).map((row: Record<string, unknown>) => ({
          id: Number(row.id),
          lineUserId: String(row.line_user_id ?? ''),
          event: String(row.event_key ?? ''),
          orderNumber: String(row.order_number ?? ''),
          orderStatus: String(row.order_status ?? ''),
          paymentStatus: String(row.payment_status ?? ''),
          payableAmount: Number(row.payable_amount ?? 0),
          paymentNote: String(row.payment_note ?? ''),
          fulfilment: String(row.fulfilment ?? 'pickup'),
        })),
      });
    }

    if (action === 'ackNotifications') {
      const ids = Array.isArray(body.ids)
        ? body.ids.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0).slice(0, 50)
        : [];
      if (!ids.length) return json({ error: 'invalid_notification_ids' }, 400);
      const { data, error } = await admin.rpc('ack_line_order_notifications', { p_ids: ids });
      if (error) throw error;
      return json({ acknowledged: Number(data ?? 0) });
    }

    if (action === 'getMyOrders' || action === 'getOrder') {
      const id = lineId(body.lineUserId);
      if (!id) return json({ error: 'invalid_line_user' }, 400);

      const { data: link, error: linkError } = await admin
        .from('line_accounts')
        .select('user_id')
        .eq('line_user_id', id)
        .maybeSingle();
      if (linkError) throw linkError;
      if (!link?.user_id) return json({ linked: false, orders: [] });

      let query = admin
        .from('orders')
        .select(`
          order_number,status,fulfilment,total,estimated_ready_at,created_at,updated_at,
          order_items(name_snapshot,quantity,selected_options,selected_add_ons),
          payments(method,status,amount,payable_amount,verification_reason)
        `)
        .eq('user_id', link.user_id)
        .order('created_at', { ascending: false })
        .limit(action === 'getOrder' ? 1 : 20);

      if (action === 'getOrder') {
        const orderNumber = String(body.orderNumber ?? '').trim().toUpperCase();
        if (!/^IJ[0-9A-Z-]{6,30}$/.test(orderNumber)) {
          return json({ error: 'invalid_order_number' }, 400);
        }
        query = query.eq('order_number', orderNumber);
      }

      const { data: orders, error: ordersError } = await query;
      if (ordersError) throw ordersError;
      return json({ linked: true, orders: ((orders ?? []) as DatabaseOrder[]).map(safeOrder) });
    }

    if (action === 'lookupOrder') {
      // The guest path: no line_accounts link required, for a customer who
      // ordered on the website and asks about it in LINE (or the reverse)
      // without ever having gone through "เชื่อมบัญชี". Order number and
      // phone both have to match — see lookup_order_by_phone for why.
      const orderNumber = String(body.orderNumber ?? '').trim();
      const phone = String(body.phone ?? '').trim();
      if (!orderNumber || !phone) return json({ error: 'invalid_lookup' }, 400);
      const { data, error } = await admin.rpc('lookup_order_by_phone', {
        p_order_number: orderNumber,
        p_phone: phone,
      });
      if (error) throw error;
      return json({ found: Boolean(data), order: data ?? null });
    }

    if (action === 'health') return json({ ok: true });
    return json({ error: 'unknown_action' }, 400);
  } catch (error) {
    console.error('line-orders failed', error instanceof Error ? error.message : 'unknown');
    return json({ error: 'unable_to_process' }, 500);
  }
});
