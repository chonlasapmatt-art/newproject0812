-- Official LINE account linking for website members.
-- Safe to run on every deploy. A LINE user id is never accepted from the
-- browser: the website creates a short-lived nonce and LINE returns that nonce
-- to the Messaging API webhook after the customer confirms the link.

create table if not exists public.line_accounts (
  line_user_id text primary key
    check (line_user_id ~ '^U[0-9a-fA-F]{32}$'),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.line_link_nonces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  nonce_hash text not null unique
    check (nonce_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists line_link_nonces_user_created_idx
  on public.line_link_nonces(user_id, created_at desc);
create index if not exists line_link_nonces_expiry_idx
  on public.line_link_nonces(expires_at)
  where consumed_at is null;

alter table public.line_accounts enable row level security;
alter table public.line_link_nonces enable row level security;

drop policy if exists line_accounts_owner_read on public.line_accounts;
create policy line_accounts_owner_read on public.line_accounts
  for select using(user_id=auth.uid() or public.is_staff());

-- The nonce table is intentionally inaccessible through PostgREST. Customers
-- receive a one-time raw nonce only from create_line_link_nonce(); at rest only
-- its SHA-256 digest remains. Completion is service-role-only.
revoke all on table public.line_accounts from anon;
revoke insert, update, delete on table public.line_accounts from authenticated;
grant select on table public.line_accounts to authenticated, service_role;
revoke all on table public.line_link_nonces from anon, authenticated;
grant all on table public.line_link_nonces to service_role;

create or replace function public.create_line_link_nonce() returns text
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid := auth.uid();
  v_nonce text;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  -- Only the latest unfinished request for an account remains usable. This
  -- keeps repeated taps predictable and limits material worth guessing.
  delete from public.line_link_nonces
   where user_id=v_user and consumed_at is null;
  delete from public.line_link_nonces
   where expires_at < now()-interval '1 day';

  v_nonce := encode(gen_random_bytes(32),'hex');
  insert into public.line_link_nonces(user_id,nonce_hash,expires_at)
    values(v_user,encode(digest(v_nonce,'sha256'),'hex'),now()+interval '10 minutes');
  return v_nonce;
end; $$;

create or replace function public.complete_line_account_link(
  p_nonce text,
  p_line_user_id text,
  p_result text default 'ok'
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_link public.line_link_nonces%rowtype;
  v_existing_user uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if p_nonce !~ '^[0-9a-f]{64}$' then raise exception 'invalid or expired link'; end if;
  if p_line_user_id !~ '^U[0-9a-fA-F]{32}$' then raise exception 'invalid line user'; end if;
  if p_result not in ('ok','failed') then raise exception 'invalid link result'; end if;

  select * into v_link
    from public.line_link_nonces
   where nonce_hash=encode(digest(p_nonce,'sha256'),'hex')
     and consumed_at is null
   for update;
  if not found or v_link.expires_at < now() then
    raise exception 'invalid or expired link';
  end if;

  update public.line_link_nonces set consumed_at=now() where id=v_link.id;
  if p_result='failed' then
    return jsonb_build_object('linked',false,'result','failed');
  end if;

  select user_id into v_existing_user
    from public.line_accounts
   where line_user_id=p_line_user_id
   for update;
  if found and v_existing_user<>v_link.user_id then
    raise exception 'line account already linked';
  end if;

  -- One website account maps to one LINE account and vice versa.
  delete from public.line_accounts
   where user_id=v_link.user_id and line_user_id<>p_line_user_id;
  insert into public.line_accounts(line_user_id,user_id,linked_at,updated_at)
    values(p_line_user_id,v_link.user_id,now(),now())
  on conflict(line_user_id) do update set updated_at=now();

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data)
    values(v_link.user_id,'line.account_linked','profile',v_link.user_id::text,
      jsonb_build_object('linked',true));
  return jsonb_build_object('linked',true,'result','ok');
end; $$;

create or replace function public.unlink_line_account() returns boolean
language plpgsql security definer set search_path=public as $$
declare
  v_user uuid := auth.uid();
  v_deleted integer;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  delete from public.line_accounts where user_id=v_user;
  get diagnostics v_deleted=row_count;
  if v_deleted>0 then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,after_data)
      values(v_user,'line.account_unlinked','profile',v_user::text,
        jsonb_build_object('linked',false));
  end if;
  return v_deleted>0;
end; $$;

revoke all on function public.create_line_link_nonce() from public, anon;
revoke all on function public.complete_line_account_link(text,text,text) from public, anon, authenticated;
revoke all on function public.unlink_line_account() from public, anon;
grant execute on function public.create_line_link_nonce() to authenticated;
grant execute on function public.complete_line_account_link(text,text,text) to service_role;
grant execute on function public.unlink_line_account() to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
        where pubname='supabase_realtime' and schemaname='public' and tablename='line_accounts'
     ) then
    alter publication supabase_realtime add table public.line_accounts;
  end if;
end $$;

notify pgrst, 'reload schema';
