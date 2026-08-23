-- Settings the shop can change without a developer.
--
-- The LINE account, the phone number, the address: none of these are code, and
-- every one of them was a build setting the shop had to ask us to change. One
-- row, readable by everyone because the site shows it to customers, writable
-- only by staff because it is what a customer is told to trust.

create table if not exists public.store_settings (
  -- A boolean primary key that must be true: exactly one row, enforced by the
  -- database rather than by everyone remembering to update instead of insert.
  id boolean primary key default true check (id),
  line_oa_id text,
  line_oa_link text,
  phone text,
  address text,
  hours text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

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
