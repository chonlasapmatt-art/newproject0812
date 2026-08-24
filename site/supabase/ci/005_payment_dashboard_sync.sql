-- Keep payment settlement, order confirmation and the live dashboard in sync.
-- Safe to run on every deploy.

create or replace function public.complete_verified_payment(
  p_payment_id uuid,
  p_verified_via public.payment_verifier default 'automation',
  p_verification jsonb default null,
  p_note text default 'ยืนยันยอดเรียบร้อย'
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_before_payment public.payment_status;
  v_before_order public.order_status;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;

  select p.order_id,p.status,o.order_number,o.status
    into strict v_order_id,v_before_payment,v_order_number,v_before_order
    from public.payments p
    join public.orders o on o.id=p.order_id
   where p.id=p_payment_id
   for update of p,o;

  update public.payments
     set status='verified',
         verified_via=case
           when v_before_payment='verified' then coalesce(verified_via,p_verified_via)
           else p_verified_via
         end,
         verified_at=coalesce(verified_at,now()),
         verification=coalesce(p_verification,verification),
         verification_reason=case
           when v_before_payment='verified' then coalesce(verification_reason,left(p_note,300))
           else left(p_note,300)
         end
   where id=p_payment_id;

  if v_before_order='pending' then
    update public.orders set status='confirmed',updated_at=now() where id=v_order_id;
    insert into public.order_status_history(order_id,status,note)
      values(v_order_id,'confirmed','ยืนยันออเดอร์อัตโนมัติหลังตรวจพบยอดชำระแล้ว');
  end if;

  if v_before_payment<>'verified' or v_before_order='pending' then
    insert into public.audit_logs(action,entity_type,entity_id,before_data,after_data)
      values('payment.verified','order',v_order_number,
        jsonb_build_object('payment_status',v_before_payment,'order_status',v_before_order),
        jsonb_build_object(
          'payment_status','verified',
          'order_status',case when v_before_order='pending' then 'confirmed' else v_before_order::text end,
          'verified_via',p_verified_via,
          'note',left(p_note,300)
        ));
  end if;
end; $$;

revoke all on function public.complete_verified_payment(uuid,public.payment_verifier,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.complete_verified_payment(uuid,public.payment_verifier,jsonb,text)
  to service_role;

create or replace function public.staff_set_payment_status(
  p_order_number text, p_status public.payment_status, p_note text default null
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_payment uuid;
  v_order uuid;
  v_before_payment public.payment_status;
  v_before_order public.order_status;
begin
  if not public.is_staff() then raise exception 'staff required'; end if;

  select p.id,o.id,p.status,o.status
    into strict v_payment,v_order,v_before_payment,v_before_order
    from public.payments p
    join public.orders o on o.id=p.order_id
   where o.order_number=p_order_number
   for update of p,o;

  update public.payments
     set status=p_status,
         verification_reason=left(p_note,300),
         verified_via=case when p_status='verified' then 'staff' else verified_via end,
         verified_by=case when p_status='verified' then auth.uid() else verified_by end,
         verified_at=case when p_status='verified' then coalesce(verified_at,now()) else verified_at end
   where id=v_payment;

  if p_status='verified' and v_before_order='pending' then
    update public.orders set status='confirmed',updated_at=now() where id=v_order;
    insert into public.order_status_history(order_id,status,changed_by,note)
      values(v_order,'confirmed',auth.uid(),'ยืนยันออเดอร์อัตโนมัติหลังพนักงานรับชำระเงินแล้ว');
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,before_data,after_data)
    values(auth.uid(),'payment.status_changed','order',p_order_number,
      jsonb_build_object('payment_status',v_before_payment,'order_status',v_before_order),
      jsonb_build_object(
        'payment_status',p_status,
        'order_status',case
          when p_status='verified' and v_before_order='pending' then 'confirmed'
          else v_before_order::text
        end,
        'note',p_note
      ));
end; $$;

revoke all on function public.staff_set_payment_status(text,public.payment_status,text)
  from public, anon;
grant execute on function public.staff_set_payment_status(text,public.payment_status,text)
  to authenticated;

notify pgrst, 'reload schema';
