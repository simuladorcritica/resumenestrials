-- Resumenes Trials · esquema inicial de usuarios
-- Ejecutar en Supabase SQL Editor una sola vez.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null check (char_length(trim(first_name)) between 1 and 80),
  last_name text not null check (char_length(trim(last_name)) between 1 and 100),
  username text not null check (username ~ '^[a-z0-9._-]{3,30}$'),
  email text not null,
  newsletter_opt_in boolean not null default true,
  newsletter_opt_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));
create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email));

alter table public.profiles enable row level security;

-- Cada usuario solo puede consultar su propio perfil.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

-- Cada usuario solo puede actualizar su propio perfil.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Crea el perfil automáticamente al registrarse en Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    username,
    email,
    newsletter_opt_in,
    newsletter_opt_in_at
  ) values (
    new.id,
    trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')),
    trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')),
    lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))),
    lower(new.email),
    coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false),
    case
      when coalesce((new.raw_user_meta_data ->> 'newsletter_opt_in')::boolean, false)
      then now()
      else null
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Mantiene updated_at al día.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
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
  for each row execute procedure public.set_updated_at();
