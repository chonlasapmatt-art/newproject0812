-- Settings the shop can change without a developer.
--
-- The LINE account, the phone number, the address: none of these are code, and
-- every one of them was a build setting the shop had to ask us to change. One
-- row, readable by everyone because the site shows it to customers, writable
-- only by staff because it is what a customer is told to trust.
--
-- Written to repair as well as create. A first attempt at this left a
-- store_settings table behind with none of its columns, and `create table if
-- not exists` will not touch a table that already exists — so every piece is
-- added on its own and checked for before it is added. That makes this correct
-- against a database that has never seen it, one that has it complete, and one
-- left half-built by a run that failed partway.

create table if not exists public.store_settings ();

alter table public.store_settings add column if not exists id boolean;
alter table public.store_settings add column if not exists line_oa_id text;
alter table public.store_settings add column if not exists line_oa_link text;
alter table public.store_settings add column if not exists phone text;
alter table public.store_settings add column if not exists address text;
alter table public.store_settings add column if not exists hours text;
alter table public.store_settings add column if not exists updated_at timestamptz not null default now();
alter table public.store_settings add column if not exists updated_by uuid;

-- Exactly one row, enforced by the database rather than by everyone
-- remembering to update instead of insert: the key is a boolean that must be
-- true, so a second row has nowhere to go.
update public.store_settings set id = true where id is null or id is false;
alter table public.store_settings alter column id set default true;
alter table public.store_settings alter column id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_settings'::regclass and contype = 'p'
  ) then
    alter table public.store_settings add primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_settings'::regclass and conname = 'store_settings_id_true'
  ) then
    alter table public.store_settings add constraint store_settings_id_true check (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.store_settings'::regclass and conname = 'store_settings_updated_by_fkey'
  ) then
    alter table public.store_settings
      add constraint store_settings_updated_by_fkey
      foreign key (updated_by) references public.profiles(id);
  end if;
end $$;

insert into public.store_settings(id) values (true) on conflict (id) do nothing;

alter table public.store_settings enable row level security;

-- Customers read it: the LINE button and the shop's address are public.
drop policy if exists store_settings_public_read on public.store_settings;
create policy store_settings_public_read on public.store_settings
  for select using (true);

-- Only staff change it. There is no insert policy on purpose — the single row
-- already exists, and nobody should be able to add a second.
drop policy if exists store_settings_staff_write on public.store_settings;
create policy store_settings_staff_write on public.store_settings
  for update using (public.is_staff()) with check (public.is_staff());

create or replace function public.touch_store_settings() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists store_settings_touched on public.store_settings;
create trigger store_settings_touched before update on public.store_settings
  for each row execute procedure public.touch_store_settings();
