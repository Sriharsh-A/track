create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  duration integer not null check (duration in (7, 30, 90)),
  start_date date not null default current_date,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.plans add column if not exists archived boolean not null default false;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (id, plan_id),
  unique (plan_id, position)
);

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  activity_id uuid not null,
  day integer not null check (day between 1 and 90),
  status text not null check (status in ('empty', 'complete', 'incomplete')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_entries_activity_plan_fk foreign key (activity_id, plan_id)
    references public.activities(id, plan_id) on delete cascade,
  unique (activity_id, day)
);

create index if not exists plans_user_created_idx on public.plans(user_id, created_at desc);
create index if not exists activities_plan_position_idx on public.activities(plan_id, position);
create index if not exists daily_entries_plan_day_idx on public.daily_entries(plan_id, day);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_entries_set_updated_at on public.daily_entries;
create trigger daily_entries_set_updated_at before update on public.daily_entries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.activities enable row level security;
alter table public.daily_entries enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "plans_select_own" on public.plans;
create policy "plans_select_own" on public.plans for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "plans_insert_own" on public.plans;
create policy "plans_insert_own" on public.plans for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "plans_update_own" on public.plans;
create policy "plans_update_own" on public.plans for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "plans_delete_own" on public.plans;
create policy "plans_delete_own" on public.plans for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "activities_select_owned" on public.activities;
create policy "activities_select_owned" on public.activities for select to authenticated using (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);
drop policy if exists "activities_insert_owned" on public.activities;
create policy "activities_insert_owned" on public.activities for insert to authenticated with check (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);
drop policy if exists "activities_update_owned" on public.activities;
create policy "activities_update_owned" on public.activities for update to authenticated using (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);
drop policy if exists "activities_delete_owned" on public.activities;
create policy "activities_delete_owned" on public.activities for delete to authenticated using (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);

drop policy if exists "entries_select_owned" on public.daily_entries;
create policy "entries_select_owned" on public.daily_entries for select to authenticated using (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);
drop policy if exists "entries_insert_owned" on public.daily_entries;
create policy "entries_insert_owned" on public.daily_entries for insert to authenticated with check (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);
drop policy if exists "entries_update_owned" on public.daily_entries;
create policy "entries_update_owned" on public.daily_entries for update to authenticated using (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
) with check (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);
drop policy if exists "entries_delete_owned" on public.daily_entries;
create policy "entries_delete_owned" on public.daily_entries for delete to authenticated using (
  exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid()))
);
