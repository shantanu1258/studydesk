-- StudyDesk: initial single-library schema
-- Run this once in Supabase Dashboard -> SQL Editor before enabling real signups.

begin;

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.libraries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  seat_count integer not null default 24 check (seat_count between 1 and 500),
  seat_prefix text not null default 'A' check (char_length(seat_prefix) between 1 and 3),
  shift_definitions jsonb not null default '[
    {"id":"morning","type":"Morning","name":"Morning","start":"06:00","end":"13:00"},
    {"id":"evening","type":"Evening","name":"Evening","start":"13:00","end":"21:00"},
    {"id":"full-day","type":"Full Day","name":"Full Day","start":"07:00","end":"23:00"}
  ]'::jsonb check (
    jsonb_typeof(shift_definitions) = 'array'
    and jsonb_array_length(shift_definitions) between 1 and 12
  ),
  fee_collection text not null default 'advance' check (
    fee_collection in ('advance', 'later')
  ),
  attendance_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key,
  library_id uuid not null references public.libraries(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  seat_code text not null check (char_length(seat_code) between 1 and 12),
  shift text not null check (char_length(shift) between 1 and 40),
  monthly_fee integer not null default 0 check (monthly_fee >= 0),
  start_date date not null,
  plan_start_date date not null,
  plan_months integer not null default 1 check (plan_months between 1 and 24),
  expiry_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, library_id)
);

create table if not exists public.payments (
  id uuid primary key,
  library_id uuid not null references public.libraries(id) on delete cascade,
  member_id uuid not null,
  seat_code text not null check (char_length(seat_code) between 1 and 12),
  member_name text not null check (char_length(member_name) between 1 and 120),
  amount_inr integer not null check (amount_inr >= 0),
  paid_on date not null default current_date,
  payment_mode text not null check (
    payment_mode in ('UPI', 'Cash', 'Card', 'Bank transfer')
  ),
  period_start date not null,
  period_months integer not null default 1 check (period_months between 1 and 24),
  period_end date not null check (period_end >= period_start),
  created_at timestamptz not null default now(),
  foreign key (member_id, library_id)
    references public.members(id, library_id) on delete cascade
);

create table if not exists public.attendance (
  id uuid primary key,
  library_id uuid not null references public.libraries(id) on delete cascade,
  member_id uuid not null,
  attendance_date date not null default current_date,
  check_in time,
  check_out time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, attendance_date),
  foreign key (member_id, library_id)
    references public.members(id, library_id) on delete cascade,
  check (check_out is null or check_in is not null)
);

create index if not exists libraries_owner_id_idx on public.libraries(owner_id);
create index if not exists members_library_id_idx on public.members(library_id);
create index if not exists members_active_idx on public.members(library_id, active);
create unique index if not exists members_library_identity_idx
  on public.members(
    library_id,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
    phone
  );
create index if not exists payments_library_id_idx on public.payments(library_id);
create index if not exists payments_member_id_idx on public.payments(member_id);
create index if not exists payments_paid_on_idx on public.payments(library_id, paid_on);
create index if not exists attendance_library_id_idx on public.attendance(library_id);
create index if not exists attendance_member_id_idx on public.attendance(member_id);
create index if not exists attendance_date_idx
  on public.attendance(library_id, attendance_date);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists libraries_set_updated_at on public.libraries;
create trigger libraries_set_updated_at
before update on public.libraries
for each row execute function private.set_updated_at();

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row execute function private.set_updated_at();

drop trigger if exists attendance_set_updated_at on public.attendance;
create trigger attendance_set_updated_at
before update on public.attendance
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_name text;
  library_name text;
begin
  owner_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'Owner'), '@', 1)
  ), 120);
  library_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'library_name'), ''),
    'My Study Library'
  ), 120);

  insert into public.profiles (id, full_name)
  values (new.id, owner_name)
  on conflict (id) do nothing;

  insert into public.libraries (owner_id, name)
  values (new.id, library_name)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.user_owns_library(target_library_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.libraries
    where id = target_library_id
      and owner_id = (select auth.uid())
  );
$$;

create or replace function public.apply_workspace_changes(
  p_library_id uuid,
  p_settings jsonb,
  p_members jsonb,
  p_payments jsonb,
  p_attendance jsonb,
  p_deleted_member_ids uuid[],
  p_deleted_payment_ids uuid[],
  p_deleted_attendance_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.user_owns_library(p_library_id) then
    raise exception 'You do not have access to this library' using errcode = '42501';
  end if;

  if p_settings is not null then
    update public.libraries
    set
      name = p_settings ->> 'name',
      seat_count = (p_settings ->> 'seat_count')::integer,
      seat_prefix = p_settings ->> 'seat_prefix',
      shift_definitions = p_settings -> 'shift_definitions',
      fee_collection = p_settings ->> 'fee_collection',
      attendance_enabled = (p_settings ->> 'attendance_enabled')::boolean
    where id = p_library_id;
  end if;

  insert into public.members (
    id, library_id, name, phone, seat_code, shift,
    monthly_fee, start_date, plan_start_date, plan_months, expiry_date, active
  )
  select
    item.id, p_library_id, item.name, item.phone, item.seat_code, item.shift,
    item.monthly_fee, item.start_date, item.plan_start_date, item.plan_months,
    item.expiry_date, item.active
  from jsonb_to_recordset(coalesce(p_members, '[]'::jsonb)) as item(
    id uuid,
    name text,
    phone text,
    seat_code text,
    shift text,
    monthly_fee integer,
    start_date date,
    plan_start_date date,
    plan_months integer,
    expiry_date date,
    active boolean
  )
  on conflict (id) do update set
    library_id = excluded.library_id,
    name = excluded.name,
    phone = excluded.phone,
    seat_code = excluded.seat_code,
    shift = excluded.shift,
    monthly_fee = excluded.monthly_fee,
    start_date = excluded.start_date,
    plan_start_date = excluded.plan_start_date,
    plan_months = excluded.plan_months,
    expiry_date = excluded.expiry_date,
    active = excluded.active;

  insert into public.payments (
    id, library_id, member_id, seat_code, member_name, amount_inr, paid_on,
    payment_mode, period_start, period_months, period_end
  )
  select
    item.id, p_library_id, item.member_id, item.seat_code, item.member_name,
    item.amount_inr, item.paid_on, item.payment_mode, item.period_start,
    item.period_months, item.period_end
  from jsonb_to_recordset(coalesce(p_payments, '[]'::jsonb)) as item(
    id uuid,
    member_id uuid,
    seat_code text,
    member_name text,
    amount_inr integer,
    paid_on date,
    payment_mode text,
    period_start date,
    period_months integer,
    period_end date
  )
  on conflict (id) do update set
    library_id = excluded.library_id,
    member_id = excluded.member_id,
    seat_code = excluded.seat_code,
    member_name = excluded.member_name,
    amount_inr = excluded.amount_inr,
    paid_on = excluded.paid_on,
    payment_mode = excluded.payment_mode,
    period_start = excluded.period_start,
    period_months = excluded.period_months,
    period_end = excluded.period_end;

  insert into public.attendance (
    id, library_id, member_id, attendance_date, check_in, check_out
  )
  select
    item.id, p_library_id, item.member_id, item.attendance_date,
    item.check_in, item.check_out
  from jsonb_to_recordset(coalesce(p_attendance, '[]'::jsonb)) as item(
    id uuid,
    member_id uuid,
    attendance_date date,
    check_in time,
    check_out time
  )
  on conflict (id) do update set
    library_id = excluded.library_id,
    member_id = excluded.member_id,
    attendance_date = excluded.attendance_date,
    check_in = excluded.check_in,
    check_out = excluded.check_out;

  delete from public.payments
  where library_id = p_library_id
    and id = any(coalesce(p_deleted_payment_ids, array[]::uuid[]));

  delete from public.attendance
  where library_id = p_library_id
    and id = any(coalesce(p_deleted_attendance_ids, array[]::uuid[]));

  delete from public.members
  where library_id = p_library_id
    and id = any(coalesce(p_deleted_member_ids, array[]::uuid[]));
end;
$$;

revoke all on schema private from public;
revoke execute on function private.set_updated_at() from public;
revoke execute on function private.handle_new_user() from public;
revoke execute on function private.user_owns_library(uuid) from public;
revoke execute on function public.apply_workspace_changes(
  uuid, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[]
) from public;
grant usage on schema private to authenticated;
grant execute on function private.user_owns_library(uuid) to authenticated;
grant execute on function public.apply_workspace_changes(
  uuid, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[]
) to authenticated;

alter table public.profiles enable row level security;
alter table public.libraries enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.attendance enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.libraries from anon, authenticated;
revoke all on table public.members from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.attendance from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, update on table public.libraries to authenticated;
grant select, insert, update, delete on table public.members to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.attendance to authenticated;

drop policy if exists "owners read their profile" on public.profiles;
create policy "owners read their profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

drop policy if exists "owners update their profile" on public.profiles;
create policy "owners update their profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "owners read their library" on public.libraries;
create policy "owners read their library"
on public.libraries for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "owners update their library" on public.libraries;
create policy "owners update their library"
on public.libraries for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists "owners read their members" on public.members;
create policy "owners read their members"
on public.members for select to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "owners add their members" on public.members;
create policy "owners add their members"
on public.members for insert to authenticated
with check ((select private.user_owns_library(library_id)));

drop policy if exists "owners update their members" on public.members;
create policy "owners update their members"
on public.members for update to authenticated
using ((select private.user_owns_library(library_id)))
with check ((select private.user_owns_library(library_id)));

drop policy if exists "owners delete their members" on public.members;
create policy "owners delete their members"
on public.members for delete to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "owners read their payments" on public.payments;
create policy "owners read their payments"
on public.payments for select to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "owners add their payments" on public.payments;
create policy "owners add their payments"
on public.payments for insert to authenticated
with check ((select private.user_owns_library(library_id)));

drop policy if exists "owners update their payments" on public.payments;
create policy "owners update their payments"
on public.payments for update to authenticated
using ((select private.user_owns_library(library_id)))
with check ((select private.user_owns_library(library_id)));

drop policy if exists "owners delete their payments" on public.payments;
create policy "owners delete their payments"
on public.payments for delete to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "owners read their attendance" on public.attendance;
create policy "owners read their attendance"
on public.attendance for select to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "owners add their attendance" on public.attendance;
create policy "owners add their attendance"
on public.attendance for insert to authenticated
with check ((select private.user_owns_library(library_id)));

drop policy if exists "owners update their attendance" on public.attendance;
create policy "owners update their attendance"
on public.attendance for update to authenticated
using ((select private.user_owns_library(library_id)))
with check ((select private.user_owns_library(library_id)));

drop policy if exists "owners delete their attendance" on public.attendance;
create policy "owners delete their attendance"
on public.attendance for delete to authenticated
using ((select private.user_owns_library(library_id)));

commit;
