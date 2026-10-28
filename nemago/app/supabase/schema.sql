-- NemaGo sign-in: profiles table.
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- It is safe to run more than once.
--
-- Passwords and sessions are handled by Supabase Auth (the auth.users table).
-- This table only stores who the person is in NemaGo: driver or mechanic.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('driver', 'mechanic')),
  full_name text,
  -- Set to true only by NemaGo staff after F7 verification, never by the user.
  mechanic_verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- People can read only their own profile.
drop policy if exists "Read own profile" on public.profiles;
create policy "Read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- People can create only their own profile, and can't mark themselves verified.
-- (Used by Google sign-ins, who pick a role after their first login.)
drop policy if exists "Create own unverified profile" on public.profiles;
create policy "Create own unverified profile"
  on public.profiles for insert
  with check (auth.uid() = id and mechanic_verified = false);

-- No update or delete policy: users can't change their role or verification.
-- Staff change these from the dashboard, which bypasses these rules.

-- Email sign-ups pick a role on the sign-up form. It's saved with the new
-- account, and this trigger copies it into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'role' in ('driver', 'mechanic') then
    insert into public.profiles (id, role, full_name)
    values (
      new.id,
      new.raw_user_meta_data ->> 'role',
      new.raw_user_meta_data ->> 'full_name'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
