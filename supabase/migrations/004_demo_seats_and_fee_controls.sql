-- StudyDesk: persistent demo seats, unique member phones, and safer admin controls
-- Run this once after 003_profile_photos.sql.

begin;

create table if not exists public.seat_demos (
  id uuid primary key,
  library_id uuid not null references public.libraries(id) on delete cascade,
  seat_code text not null check (char_length(seat_code) between 1 and 12),
  shift text not null check (char_length(shift) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (library_id, seat_code, shift)
);

create index if not exists seat_demos_library_id_idx
  on public.seat_demos(library_id);
create index if not exists seat_demos_seat_idx
  on public.seat_demos(library_id, seat_code);
create index if not exists members_library_phone_idx
  on public.members(library_id, phone);

create or replace function private.enforce_unique_member_phone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and new.library_id is not distinct from old.library_id
    and new.phone is not distinct from old.phone
  then
    return new;
  end if;

  if exists (
    select 1
    from public.members as existing
    where existing.library_id = new.library_id
      and existing.phone = new.phone
      and existing.id <> new.id
  ) then
    raise exception 'This phone number already belongs to another member'
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists members_enforce_unique_phone on public.members;
create trigger members_enforce_unique_phone
before insert or update on public.members
for each row execute function private.enforce_unique_member_phone();

create or replace function public.remove_library_user(
  p_library_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  core_admin_id uuid;
begin
  select owner_id into core_admin_id
  from public.libraries
  where id = p_library_id;

  if core_admin_id is null then
    raise exception 'Library not found';
  end if;

  if core_admin_id <> (select auth.uid()) then
    raise exception 'Only the Core admin can remove another admin'
      using errcode = '42501';
  end if;

  if p_user_id = core_admin_id then
    raise exception 'The Core admin cannot be removed';
  end if;

  delete from public.library_users
  where library_id = p_library_id
    and user_id = p_user_id;
end;
$$;

drop function if exists public.apply_workspace_changes(
  uuid, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[]
);

create or replace function public.apply_workspace_changes(
  p_library_id uuid,
  p_settings jsonb,
  p_members jsonb,
  p_payments jsonb,
  p_attendance jsonb,
  p_demo_seats jsonb,
  p_deleted_member_ids uuid[],
  p_deleted_payment_ids uuid[],
  p_deleted_attendance_ids uuid[],
  p_deleted_demo_seat_ids uuid[]
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
      attendance_enabled = (p_settings ->> 'attendance_enabled')::boolean,
      primary_color = p_settings ->> 'primary_color',
      secondary_color = p_settings ->> 'secondary_color',
      seat_sections = p_settings -> 'seat_sections'
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

  insert into public.seat_demos (id, library_id, seat_code, shift)
  select item.id, p_library_id, item.seat_code, item.shift
  from jsonb_to_recordset(coalesce(p_demo_seats, '[]'::jsonb)) as item(
    id uuid,
    seat_code text,
    shift text
  )
  on conflict (id) do update set
    library_id = excluded.library_id,
    seat_code = excluded.seat_code,
    shift = excluded.shift;

  delete from public.payments
  where library_id = p_library_id
    and id = any(coalesce(p_deleted_payment_ids, array[]::uuid[]));

  delete from public.attendance
  where library_id = p_library_id
    and id = any(coalesce(p_deleted_attendance_ids, array[]::uuid[]));

  delete from public.seat_demos
  where library_id = p_library_id
    and id = any(coalesce(p_deleted_demo_seat_ids, array[]::uuid[]));

  delete from public.members
  where library_id = p_library_id
    and id = any(coalesce(p_deleted_member_ids, array[]::uuid[]));
end;
$$;

alter table public.seat_demos enable row level security;

revoke all on table public.seat_demos from anon, authenticated;
grant select, insert, update, delete on table public.seat_demos to authenticated;

drop policy if exists "library users read demo seats" on public.seat_demos;
create policy "library users read demo seats"
on public.seat_demos for select to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "library users add demo seats" on public.seat_demos;
create policy "library users add demo seats"
on public.seat_demos for insert to authenticated
with check ((select private.user_owns_library(library_id)));

drop policy if exists "library users update demo seats" on public.seat_demos;
create policy "library users update demo seats"
on public.seat_demos for update to authenticated
using ((select private.user_owns_library(library_id)))
with check ((select private.user_owns_library(library_id)));

drop policy if exists "library users remove demo seats" on public.seat_demos;
create policy "library users remove demo seats"
on public.seat_demos for delete to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "library users correct recent payments" on public.payments;
drop policy if exists "library users correct payments" on public.payments;
create policy "library users correct payments"
on public.payments for update to authenticated
using ((select private.user_owns_library(library_id)))
with check ((select private.user_owns_library(library_id)));

revoke execute on function private.enforce_unique_member_phone() from public;
revoke execute on function public.remove_library_user(uuid, uuid) from public;
revoke execute on function public.apply_workspace_changes(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb,
  uuid[], uuid[], uuid[], uuid[]
) from public;

grant execute on function public.remove_library_user(uuid, uuid) to authenticated;
grant execute on function public.apply_workspace_changes(
  uuid, jsonb, jsonb, jsonb, jsonb, jsonb,
  uuid[], uuid[], uuid[], uuid[]
) to authenticated;

notify pgrst, 'reload schema';

commit;
