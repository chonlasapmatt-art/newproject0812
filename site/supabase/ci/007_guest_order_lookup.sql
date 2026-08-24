-- Look up an order without a session, by the two things only the person who
-- placed it (or the shop) would have. Safe to run on every deploy.

/**
 * `orders_phone_number_idx on public.orders(customer_phone, order_number)`
 * has existed since the very first migration — this is the query it was
 * built for, which never actually got wired up: the /track page's own
 * "order number + phone" form searches the client's realtime order cache,
 * and RLS scopes that cache to the signed-in session's own orders. A true
 * guest — no session, or looking up an order that is not their signed-in
 * one — always got an empty cache and "not found," no matter what they
 * typed, which is indistinguishable from the form being decorative.
 *
 * Both fields have to match together. Neither is a secret on its own — an
 * order number is on a receipt, a phone number is not private — but the
 * pair is what only the customer (or someone they showed the receipt to)
 * would have, which is the same trust boundary a phone order at a counter
 * already runs on.
 */
create or replace function public.lookup_order_by_phone(p_order_number text, p_phone text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_number text := upper(trim(coalesce(p_order_number, '')));
begin
  if v_number = '' or char_length(v_phone) < 9 then
    return null;
  end if;

  select * into v_order from public.orders
   where order_number = v_number and customer_phone = v_phone
   limit 1;
  if not found then
    return null;
  end if;

  select * into v_payment from public.payments where order_id = v_order.id limit 1;

  return jsonb_build_object(
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'fulfilment', v_order.fulfilment,
    'subtotal', v_order.subtotal,
    'discount', v_order.discount,
    'deliveryFee', v_order.delivery_fee,
    'total', v_order.total,
    'estimatedReadyAt', v_order.estimated_ready_at,
    'createdAt', v_order.created_at,
    'updatedAt', v_order.updated_at,
    'payment', jsonb_build_object(
      'method', coalesce(v_payment.method, 'cash'),
      'status', coalesce(v_payment.status::text, 'unpaid'),
      'payableAmount', coalesce(v_payment.payable_amount, v_payment.amount, v_order.total),
      'note', coalesce(v_payment.verification_reason, '')
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', oi.name_snapshot, 'quantity', oi.quantity,
        'options', oi.selected_options, 'addOns', oi.selected_add_ons
      ))
      from public.order_items oi where oi.order_id = v_order.id
    ), '[]'::jsonb)
  );
end; $$;

-- Deliberately public: this is the guest path, not a signed-in one. The
-- function itself is the boundary — both fields must match a real order.
revoke all on function public.lookup_order_by_phone(text, text) from public;
grant execute on function public.lookup_order_by_phone(text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
