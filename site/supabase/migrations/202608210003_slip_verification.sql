-- Slip verification.
--
-- Records what a payment provider said about a transfer, and makes reusing a
-- slip impossible rather than merely unlikely. The unique constraint is the
-- load-bearing part: the shop verifies slips from more than one place (this
-- site and an n8n flow), and a database constraint is the only guard that
-- holds when two of them run at once.

-- The exact figure the QR asked for, satang suffix included. payments.amount
-- holds the order total; this is what the customer was actually told to send,
-- and what an incoming transfer has to match.
alter table public.payments
  add column if not exists payable_amount numeric(10, 2)
    check (payable_amount is null or payable_amount >= 0);

-- Reference read from the QR printed on the customer's slip, normalised
-- upper-case. Unique across every payment: one slip settles one order, ever.
alter table public.payments
  add column if not exists slip_reference text;

-- Partial, so the many rows with no slip yet do not collide on null.
create unique index if not exists payments_slip_reference_key
  on public.payments (slip_reference)
  where slip_reference is not null;

-- Which system reached the verdict, so a disputed order can be traced back to
-- the site, the n8n flow, or a staff member clearing it by hand.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_verifier') then
    create type public.payment_verifier as enum ('provider', 'staff', 'automation');
  end if;
end
$$;

alter table public.payments
  add column if not exists verified_via public.payment_verifier;

-- Provider answer, kept verbatim. Useful when a customer disputes a rejection
-- and the provider's own record is the only account of what happened.
alter table public.payments
  add column if not exists verification jsonb;

-- Plain-language outcome shown to staff in the admin list.
alter table public.payments
  add column if not exists verification_reason text
    check (verification_reason is null or char_length(verification_reason) <= 300);

comment on column public.payments.payable_amount is
  'Amount encoded in the PromptPay QR, including the per-order satang suffix.';
comment on column public.payments.slip_reference is
  'Normalised reference from the slip QR. Unique: a slip can settle one order only.';
comment on column public.payments.verified_via is
  'Which system confirmed or rejected the transfer.';

-- Staff read verification detail through the existing payments policies; this
-- only widens what they may write, and never lets a customer self-approve.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payments' and policyname = 'payments_staff_verify'
  ) then
    create policy payments_staff_verify on public.payments
      for update to authenticated
      using (public.is_staff())
      with check (public.is_staff());
  end if;
end
$$;
