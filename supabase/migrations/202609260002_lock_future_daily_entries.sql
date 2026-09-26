-- Keep date-based entry editing authoritative in PostgreSQL. TRACK uses Asia/Kolkata
-- as its calendar timezone in both the browser and this database guard.

drop policy if exists "entries_insert_owned" on public.daily_entries;
create policy "entries_insert_owned" on public.daily_entries
for insert to authenticated
with check (
  exists (
    select 1
    from public.plans p
    where p.id = daily_entries.plan_id
      and p.user_id = (select auth.uid())
      and p.start_date + daily_entries.day - 1 <= (now() at time zone 'Asia/Kolkata')::date
  )
);

drop policy if exists "entries_update_owned" on public.daily_entries;
create policy "entries_update_owned" on public.daily_entries
for update to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = daily_entries.plan_id
      and p.user_id = (select auth.uid())
      and p.start_date + daily_entries.day - 1 <= (now() at time zone 'Asia/Kolkata')::date
  )
)
with check (
  exists (
    select 1
    from public.plans p
    where p.id = daily_entries.plan_id
      and p.user_id = (select auth.uid())
      and p.start_date + daily_entries.day - 1 <= (now() at time zone 'Asia/Kolkata')::date
  )
);

drop policy if exists "entries_delete_owned" on public.daily_entries;
create policy "entries_delete_owned" on public.daily_entries
for delete to authenticated
using (
  exists (
    select 1
    from public.plans p
    where p.id = daily_entries.plan_id
      and p.user_id = (select auth.uid())
      and p.start_date + daily_entries.day - 1 <= (now() at time zone 'Asia/Kolkata')::date
  )
);

create or replace function public.reject_future_daily_entry_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan_start_date date;
  today_in_track_timezone date := (pg_catalog.now() at time zone 'Asia/Kolkata')::date;
begin
  if tg_op = 'UPDATE' or tg_op = 'DELETE' then
    select p.start_date into plan_start_date
    from public.plans as p
    where p.id = old.plan_id;

    if plan_start_date is not null and plan_start_date + old.day - 1 > today_in_track_timezone then
      raise exception using errcode = '42501', message = 'Future plan days cannot be modified.';
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select p.start_date into plan_start_date
    from public.plans as p
    where p.id = new.plan_id;

    if plan_start_date is not null and plan_start_date + new.day - 1 > today_in_track_timezone then
      raise exception using errcode = '42501', message = 'Future plan days cannot be modified.';
    end if;

    return new;
  end if;

  return old;
end;
$$;

drop trigger if exists daily_entries_reject_future_mutation on public.daily_entries;
create trigger daily_entries_reject_future_mutation
before insert or update or delete on public.daily_entries
for each row execute function public.reject_future_daily_entry_mutation();
