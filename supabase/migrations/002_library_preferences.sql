-- StudyDesk: configurable library preferences and shared admin access
-- Existing projects that already ran 001_initial_schema.sql should run this once.

begin;

alter table public.libraries
  add column if not exists shift_definitions jsonb not null default '[
    {"id":"morning","type":"Morning","name":"Morning","start":"06:00","end":"13:00"},
    {"id":"evening","type":"Evening","name":"Evening","start":"13:00","end":"21:00"},
    {"id":"full-day","type":"Full Day","name":"Full Day","start":"07:00","end":"23:00"}
  ]'::jsonb;

alter table public.libraries
  alter column shift_definitions set default '[
    {"id":"morning","type":"Morning","name":"Morning","start":"06:00","end":"13:00"},
    {"id":"evening","type":"Evening","name":"Evening","start":"13:00","end":"21:00"},
    {"id":"full-day","type":"Full Day","name":"Full Day","start":"07:00","end":"23:00"}
  ]'::jsonb;

update public.libraries as library
set shift_definitions = (
  select jsonb_agg(
    case
      when shift_entry.item ->> 'id' in ('full-day', 'daily')
        and coalesce(shift_entry.item ->> 'start', '') = ''
        and coalesce(shift_entry.item ->> 'end', '') = ''
      then shift_entry.item || '{"start":"07:00","end":"23:00"}'::jsonb
      else shift_entry.item
    end
    order by shift_entry.ordinal
  )
  from jsonb_array_elements(library.shift_definitions)
    with ordinality as shift_entry(item, ordinal)
)
where exists (
  select 1
  from jsonb_array_elements(library.shift_definitions) as shift_entry(item)
  where shift_entry.item ->> 'id' in ('full-day', 'daily')
    and coalesce(shift_entry.item ->> 'start', '') = ''
    and coalesce(shift_entry.item ->> 'end', '') = ''
);

alter table public.libraries
  add column if not exists fee_collection text not null default 'advance';

alter table public.libraries
  add column if not exists attendance_enabled boolean not null default false;

alter table public.libraries
  add column if not exists primary_color text not null default '#334155';

alter table public.libraries
  add column if not exists secondary_color text not null default '#E2E8F0';

alter table public.libraries
  add column if not exists seat_sections jsonb;

update public.libraries
set seat_sections = jsonb_build_array(
  jsonb_build_object(
    'id', 'main-section',
    'name', 'Main section',
    'prefix', seat_prefix,
    'start', 1,
    'end', seat_count
  )
)
where seat_sections is null;

alter table public.libraries
  alter column seat_sections set default '[
    {"id":"main-section","name":"Main section","prefix":"A","start":1,"end":24}
  ]'::jsonb,
  alter column seat_sections set not null;

alter table public.payments
  add column if not exists seat_code text;

alter table public.payments
  add column if not exists member_name text,
  add column if not exists period_start date,
  add column if not exists period_months integer not null default 1,
  add column if not exists period_end date;

alter table public.members
  add column if not exists plan_start_date date,
  add column if not exists plan_months integer not null default 1;

update public.members
set plan_start_date = start_date
where plan_start_date is null;

alter table public.members
  alter column plan_start_date set not null;

update public.payments as payment
set
  seat_code = coalesce(payment.seat_code, member.seat_code),
  member_name = coalesce(payment.member_name, member.name),
  period_start = coalesce(payment.period_start, payment.paid_on),
  period_end = coalesce(payment.period_end, (payment.paid_on + interval '1 month')::date)
from public.members as member
where payment.member_id = member.id
  and payment.library_id = member.library_id
  and (
    payment.seat_code is null
    or payment.member_name is null
    or payment.period_start is null
    or payment.period_end is null
  );

alter table public.payments
  alter column seat_code set not null,
  alter column member_name set not null,
  alter column period_start set not null,
  alter column period_end set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.libraries'::regclass
      and conname = 'libraries_shift_definitions_check'
  ) then
    alter table public.libraries
      add constraint libraries_shift_definitions_check check (
        jsonb_typeof(shift_definitions) = 'array'
        and jsonb_array_length(shift_definitions) between 1 and 12
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.libraries'::regclass
      and conname = 'libraries_fee_collection_check'
  ) then
    alter table public.libraries
      add constraint libraries_fee_collection_check check (
        fee_collection in ('advance', 'later')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.libraries'::regclass
      and conname = 'libraries_primary_color_check'
  ) then
    alter table public.libraries
      add constraint libraries_primary_color_check check (
        primary_color ~ '^#[0-9A-Fa-f]{6}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.libraries'::regclass
      and conname = 'libraries_secondary_color_check'
  ) then
    alter table public.libraries
      add constraint libraries_secondary_color_check check (
        secondary_color ~ '^#[0-9A-Fa-f]{6}$'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.libraries'::regclass
      and conname = 'libraries_seat_sections_check'
  ) then
    alter table public.libraries
      add constraint libraries_seat_sections_check check (
        jsonb_typeof(seat_sections) = 'array'
        and jsonb_array_length(seat_sections) between 1 and 50
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_seat_code_check'
  ) then
    alter table public.payments
      add constraint payments_seat_code_check check (
        char_length(seat_code) between 1 and 12
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.members'::regclass
      and conname = 'members_plan_months_check'
  ) then
    alter table public.members
      add constraint members_plan_months_check check (plan_months between 1 and 24);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.members'::regclass
      and conname = 'members_plan_dates_check'
  ) then
    alter table public.members
      add constraint members_plan_dates_check check (expiry_date >= plan_start_date);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_member_name_check'
  ) then
    alter table public.payments
      add constraint payments_member_name_check check (
        char_length(member_name) between 1 and 120
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_period_months_check'
  ) then
    alter table public.payments
      add constraint payments_period_months_check check (period_months between 1 and 24);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_period_dates_check'
  ) then
    alter table public.payments
      add constraint payments_period_dates_check check (period_end >= period_start);
  end if;
end;
$$;

alter table public.members drop constraint if exists members_shift_check;
alter table public.members
  add constraint members_shift_check check (char_length(shift) between 1 and 40);

create unique index if not exists members_library_identity_idx
  on public.members(
    library_id,
    lower(regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')),
    phone
  );

create table if not exists public.library_users (
  library_id uuid not null references public.libraries(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (library_id, user_id)
);

create table if not exists public.library_invites (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references public.libraries(id) on delete cascade,
  code text not null unique check (code ~ '^[0-9A-F]{10}$'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);

create index if not exists library_users_library_id_idx
  on public.library_users(library_id);
create index if not exists library_invites_library_id_idx
  on public.library_invites(library_id);
create index if not exists library_invites_code_idx
  on public.library_invites(code);

insert into public.library_users (library_id, user_id, added_by)
select id, owner_id, owner_id
from public.libraries
on conflict (user_id) do nothing;

create or replace function private.user_owns_library(target_library_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.library_users
    where library_id = target_library_id
      and user_id = (select auth.uid())
  ) or exists (
    select 1
    from public.libraries
    where id = target_library_id
      and owner_id = (select auth.uid())
  );
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_name text;
  library_name text;
  join_code text;
  requested_seats integer;
  requested_primary text;
  requested_secondary text;
  target_library_id uuid;
  target_invite_id uuid;
begin
  owner_name := left(coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, 'Admin'), '@', 1)
  ), 120);
  join_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'join_code', '')));

  insert into public.profiles (id, full_name)
  values (new.id, owner_name)
  on conflict (id) do update set full_name = excluded.full_name;

  if join_code <> '' then
    select id, library_id
    into target_invite_id, target_library_id
    from public.library_invites
    where code = join_code
      and used_at is null
      and expires_at > now()
    for update;

    if target_invite_id is null then
      raise exception 'The invitation code is invalid, expired, or already used';
    end if;

    insert into public.library_users (library_id, user_id, added_by)
    select target_library_id, new.id, created_by
    from public.library_invites
    where id = target_invite_id;

    update public.library_invites
    set used_by = new.id, used_at = now()
    where id = target_invite_id;
  else
    library_name := left(coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'library_name'), ''),
      'My Study Library'
    ), 120);

    begin
      requested_seats := greatest(
        1,
        least(500, coalesce((new.raw_user_meta_data ->> 'seat_count')::integer, 24))
      );
    exception when invalid_text_representation then
      requested_seats := 24;
    end;

    requested_primary := case
      when coalesce(new.raw_user_meta_data ->> 'primary_color', '') ~ '^#[0-9A-Fa-f]{6}$'
        then upper(new.raw_user_meta_data ->> 'primary_color')
      else '#334155'
    end;
    requested_secondary := case
      when coalesce(new.raw_user_meta_data ->> 'secondary_color', '') ~ '^#[0-9A-Fa-f]{6}$'
        then upper(new.raw_user_meta_data ->> 'secondary_color')
      else '#E2E8F0'
    end;

    insert into public.libraries (
      owner_id, name, seat_count, primary_color, secondary_color, seat_sections
    )
    values (
      new.id,
      library_name,
      requested_seats,
      requested_primary,
      requested_secondary,
      jsonb_build_array(
        jsonb_build_object(
          'id', 'main-section',
          'name', 'Main section',
          'prefix', 'A',
          'start', 1,
          'end', requested_seats
        )
      )
    )
    on conflict (owner_id) do update set owner_id = excluded.owner_id
    returning id into target_library_id;

    insert into public.library_users (library_id, user_id, added_by)
    values (target_library_id, new.id, new.id)
    on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.validate_library_invite(p_code text)
returns table(is_valid boolean, library_name text)
language sql
security definer
set search_path = ''
stable
as $$
  select
    invite.id is not null as is_valid,
    library.name as library_name
  from (select 1) as singleton
  left join lateral (
    select id, library_id
    from public.library_invites
    where code = upper(trim(p_code))
      and used_at is null
      and expires_at > now()
    limit 1
  ) as invite on true
  left join public.libraries as library on library.id = invite.library_id;
$$;

create or replace function public.list_library_users(p_library_id uuid)
returns table(
  user_id uuid,
  full_name text,
  email text,
  is_founder boolean,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not private.user_owns_library(p_library_id) then
    raise exception 'You do not have access to this library' using errcode = '42501';
  end if;

  return query
  select
    membership.user_id,
    profile.full_name,
    account.email::text,
    membership.user_id = library.owner_id,
    membership.created_at
  from public.library_users as membership
  join public.libraries as library on library.id = membership.library_id
  join public.profiles as profile on profile.id = membership.user_id
  join auth.users as account on account.id = membership.user_id
  where membership.library_id = p_library_id
  order by
    (membership.user_id = library.owner_id) desc,
    membership.created_at;
end;
$$;

create or replace function public.create_library_invite(p_library_id uuid)
returns table(invite_code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  new_expiry timestamptz := now() + interval '7 days';
begin
  if not private.user_owns_library(p_library_id) then
    raise exception 'You do not have access to this library' using errcode = '42501';
  end if;

  delete from public.library_invites
  where library_id = p_library_id
    and used_at is null;

  loop
    new_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
    exit when not exists (
      select 1 from public.library_invites where code = new_code
    );
  end loop;

  insert into public.library_invites (
    library_id, code, created_by, expires_at
  )
  values (
    p_library_id, new_code, (select auth.uid()), new_expiry
  );

  return query select new_code, new_expiry;
end;
$$;

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
  founder_id uuid;
begin
  if not private.user_owns_library(p_library_id) then
    raise exception 'You do not have access to this library' using errcode = '42501';
  end if;

  select owner_id into founder_id
  from public.libraries
  where id = p_library_id;

  if p_user_id = founder_id then
    raise exception 'The founding owner cannot be removed';
  end if;

  delete from public.library_users
  where library_id = p_library_id
    and user_id = p_user_id;
end;
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

alter table public.library_users enable row level security;
alter table public.library_invites enable row level security;

revoke all on table public.library_users from anon, authenticated;
revoke all on table public.library_invites from anon, authenticated;
grant select on table public.library_users to authenticated;
grant select on table public.library_invites to authenticated;

revoke update on table public.libraries from authenticated;
grant update (
  name,
  seat_count,
  seat_prefix,
  shift_definitions,
  fee_collection,
  attendance_enabled,
  primary_color,
  secondary_color,
  seat_sections
) on table public.libraries to authenticated;

drop policy if exists "owners read their library" on public.libraries;
drop policy if exists "owners update their library" on public.libraries;
drop policy if exists "library users read their library" on public.libraries;
drop policy if exists "library users update their library" on public.libraries;

create policy "library users read their library"
on public.libraries for select to authenticated
using ((select private.user_owns_library(id)));

create policy "library users update their library"
on public.libraries for update to authenticated
using ((select private.user_owns_library(id)))
with check ((select private.user_owns_library(id)));

drop policy if exists "owners update their payments" on public.payments;
drop policy if exists "owners delete their payments" on public.payments;
drop policy if exists "library users correct recent payments" on public.payments;
drop policy if exists "library users delete recent payments" on public.payments;

create policy "library users correct recent payments"
on public.payments for update to authenticated
using (
  (select private.user_owns_library(library_id))
  and paid_on >= current_date - 4
)
with check ((select private.user_owns_library(library_id)));

create policy "library users delete recent payments"
on public.payments for delete to authenticated
using (
  (select private.user_owns_library(library_id))
  and paid_on >= current_date - 4
);

drop policy if exists "library users read team" on public.library_users;
create policy "library users read team"
on public.library_users for select to authenticated
using ((select private.user_owns_library(library_id)));

drop policy if exists "library users read invites" on public.library_invites;
create policy "library users read invites"
on public.library_invites for select to authenticated
using ((select private.user_owns_library(library_id)));

revoke execute on function private.user_owns_library(uuid) from public;
revoke execute on function private.handle_new_user() from public;
revoke execute on function public.validate_library_invite(text) from public;
revoke execute on function public.list_library_users(uuid) from public;
revoke execute on function public.create_library_invite(uuid) from public;
revoke execute on function public.remove_library_user(uuid, uuid) from public;
revoke execute on function public.apply_workspace_changes(
  uuid, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[]
) from public;

grant execute on function private.user_owns_library(uuid) to authenticated;
grant execute on function public.validate_library_invite(text) to anon, authenticated;
grant execute on function public.list_library_users(uuid) to authenticated;
grant execute on function public.create_library_invite(uuid) to authenticated;
grant execute on function public.remove_library_user(uuid, uuid) to authenticated;
grant execute on function public.apply_workspace_changes(
  uuid, jsonb, jsonb, jsonb, jsonb, uuid[], uuid[], uuid[]
) to authenticated;

commit;
