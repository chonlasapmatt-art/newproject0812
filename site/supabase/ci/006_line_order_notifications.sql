-- Durable LINE notifications for website orders.
-- Database changes write to an outbox; n8n claims and acknowledges messages.
-- Safe to run on every deploy.

create table if not exists public.line_order_notifications (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  line_user_id text not null references public.line_accounts(line_user_id) on delete cascade,
  event_key text not null check(event_key in (
    'order_placed','payment_verified','payment_rejected','order_confirmed',
    'order_preparing','order_ready','order_out_for_delivery',
    'order_completed','order_cancelled'
  )),
  attempts integer not null default 0 check(attempts between 0 and 8),
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique(order_id,event_key)
);

create index if not exists line_order_notifications_pending_idx
  on public.line_order_notifications(sent_at,claimed_at,created_at)
  where sent_at is null;

alter table public.line_order_notifications enable row level security;
revoke all on table public.line_order_notifications from anon,authenticated;
grant all on table public.line_order_notifications to service_role;

create or replace function public.enqueue_line_order_status_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_event text;
  v_line_user_id text;
begin
  if tg_op='INSERT' then
    v_event := 'order_placed';
  elsif new.status is not distinct from old.status then
    return new;
  else
    v_event := case new.status::text
      when 'confirmed' then 'order_confirmed'
      when 'preparing' then 'order_preparing'
      when 'ready' then 'order_ready'
      when 'out_for_delivery' then 'order_out_for_delivery'
      when 'completed' then 'order_completed'
      when 'cancelled' then 'order_cancelled'
      else null
    end;
  end if;

  if v_event is null then return new; end if;

  -- Payment verification confirms a pending order in the same transaction.
  -- The payment trigger sends one combined message, so suppress the duplicate
  -- generic "confirmed" notification in that case.
  if v_event='order_confirmed' and exists(
    select 1 from public.payments p
     where p.order_id=new.id and p.status='verified'
  ) then
    return new;
  end if;

  select la.line_user_id into v_line_user_id
    from public.line_accounts la
   where la.user_id=new.user_id;
  if v_line_user_id is null then return new; end if;

  insert into public.line_order_notifications(order_id,line_user_id,event_key)
    values(new.id,v_line_user_id,v_event)
  on conflict(order_id,event_key) do nothing;
  return new;
end; $$;

create or replace function public.enqueue_line_payment_notification()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_event text;
  v_line_user_id text;
begin
  if new.status is not distinct from old.status then return new; end if;
  v_event := case new.status::text
    when 'verified' then 'payment_verified'
    when 'rejected' then 'payment_rejected'
    else null
  end;
  if v_event is null then return new; end if;

  select la.line_user_id into v_line_user_id
    from public.orders o
    join public.line_accounts la on la.user_id=o.user_id
   where o.id=new.order_id;
  if v_line_user_id is null then return new; end if;

  insert into public.line_order_notifications(order_id,line_user_id,event_key)
    values(new.order_id,v_line_user_id,v_event)
  on conflict(order_id,event_key) do nothing;
  return new;
end; $$;

drop trigger if exists queue_line_order_status on public.orders;
create trigger queue_line_order_status
  after insert or update of status on public.orders
  for each row execute function public.enqueue_line_order_status_notification();

drop trigger if exists queue_line_payment_status on public.payments;
create trigger queue_line_payment_status
  after update of status on public.payments
  for each row execute function public.enqueue_line_payment_notification();

create or replace function public.claim_line_order_notifications(p_limit integer default 30)
returns table(
  id bigint,
  line_user_id text,
  event_key text,
  order_number text,
  order_status text,
  payment_status text,
  payable_amount numeric,
  payment_note text,
  fulfilment text
) language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  return query
    with candidates as (
      select n.id
        from public.line_order_notifications n
       where n.sent_at is null
         and n.attempts < 8
         and (n.claimed_at is null or n.claimed_at < now()-interval '2 minutes')
       order by n.created_at,n.id
       for update skip locked
       limit greatest(1,least(coalesce(p_limit,30),50))
    ), claimed as (
      update public.line_order_notifications n
         set claimed_at=now(),attempts=n.attempts+1
        from candidates c
       where n.id=c.id
       returning n.id,n.line_user_id,n.event_key,n.order_id
    )
    select c.id,c.line_user_id,c.event_key,o.order_number,o.status::text,
           coalesce(p.status::text,'unpaid'),
           coalesce(p.payable_amount,p.amount,o.total),
           coalesce(p.verification_reason,''),o.fulfilment::text
      from claimed c
      join public.orders o on o.id=c.order_id
      left join public.payments p on p.order_id=o.id
     order by c.id;
end; $$;

create or replace function public.ack_line_order_notifications(p_ids bigint[])
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  update public.line_order_notifications
     set sent_at=now()
   where id=any(coalesce(p_ids,array[]::bigint[])) and sent_at is null;
  get diagnostics v_count=row_count;
  return v_count;
end; $$;

revoke all on function public.claim_line_order_notifications(integer)
  from public,anon,authenticated;
revoke all on function public.ack_line_order_notifications(bigint[])
  from public,anon,authenticated;
grant execute on function public.claim_line_order_notifications(integer) to service_role;
grant execute on function public.ack_line_order_notifications(bigint[]) to service_role;

notify pgrst, 'reload schema';
