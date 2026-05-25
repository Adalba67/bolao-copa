-- Bolao Copa 2026 - email login and password reset migration
-- Safe migration: additive changes only. No existing data is deleted.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.admins add column if not exists email text;
alter table public.admins drop constraint if exists admins_email_format_check;
alter table public.admins
  add constraint admins_email_format_check check (
    email is null or email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  ) not valid;

alter table public.participantes add column if not exists email text;
alter table public.participantes drop constraint if exists participantes_email_format_check;
alter table public.participantes
  add constraint participantes_email_format_check check (
    email is null or email ~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$'
  ) not valid;

create unique index if not exists idx_admins_email
on public.admins(lower(email))
where email is not null;

create unique index if not exists idx_participantes_company_email
on public.participantes(company_id, lower(email))
where email is not null;

create table if not exists public.password_reset_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  token text not null unique,
  email text not null,
  user_type text not null check (user_type in ('admin', 'participant')),
  company_id text,
  id_participante integer,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_token
on public.password_reset_tokens(token)
where used_at is null;

create index if not exists idx_password_reset_tokens_email
on public.password_reset_tokens(lower(email), expires_at desc);

alter table public.password_reset_tokens enable row level security;

create or replace function public.authenticate_admin(p_login text, p_password text)
returns table (
  id uuid,
  company_id text,
  login text,
  email text,
  name_type text,
  name text,
  sheet_name text,
  spreadsheet_id text,
  google_sheet_id text,
  webhook_url text,
  logo_data_url text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    a.id,
    a.company_id,
    a.login,
    a.email,
    a.name_type,
    a.name,
    a.sheet_name,
    a.spreadsheet_id,
    a.google_sheet_id,
    a.webhook_url,
    a.logo_data_url,
    a.updated_at
  from public.admins a
  where (lower(a.login) = lower(p_login) or lower(a.email) = lower(p_login))
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;
$$;

create or replace function public.get_current_company()
returns table (
  id uuid,
  company_id text,
  login text,
  email text,
  name_type text,
  name text,
  sheet_name text,
  spreadsheet_id text,
  google_sheet_id text,
  webhook_url text,
  logo_data_url text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    a.id,
    a.company_id,
    a.login,
    a.email,
    a.name_type,
    a.name,
    a.sheet_name,
    a.spreadsheet_id,
    a.google_sheet_id,
    a.webhook_url,
    a.logo_data_url,
    a.updated_at
  from public.admins a
  where a.login = 'adm'
  limit 1;
$$;

drop function if exists public.save_admin_profile(text, text, text, text, text, text, text, text);
drop function if exists public.save_admin_profile(text, text, text, text, text, text, text, text, text);

create or replace function public.save_admin_profile(
  p_company_id text,
  p_name_type text,
  p_name text,
  p_email text,
  p_sheet_name text,
  p_spreadsheet_id text,
  p_google_sheet_id text,
  p_webhook_url text,
  p_logo_data_url text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if nullif(trim(p_company_id), '') is null then
    raise exception 'company_id obrigatorio';
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'name obrigatorio';
  end if;

  if nullif(trim(p_email), '') is null or p_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'email obrigatorio';
  end if;

  insert into public.admins (
    company_id,
    login,
    email,
    password_hash,
    name_type,
    name,
    sheet_name,
    spreadsheet_id,
    google_sheet_id,
    webhook_url,
    logo_data_url,
    created_at,
    updated_at
  )
  values (
    p_company_id,
    'adm',
    lower(trim(p_email)),
    extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
    p_name_type,
    p_name,
    p_sheet_name,
    p_spreadsheet_id,
    p_google_sheet_id,
    p_webhook_url,
    p_logo_data_url,
    now(),
    now()
  )
  on conflict (login) do update
  set
    company_id = excluded.company_id,
    email = excluded.email,
    name_type = excluded.name_type,
    name = excluded.name,
    sheet_name = excluded.sheet_name,
    spreadsheet_id = excluded.spreadsheet_id,
    google_sheet_id = excluded.google_sheet_id,
    webhook_url = excluded.webhook_url,
    logo_data_url = excluded.logo_data_url,
    updated_at = now();
end;
$$;

create or replace function public.create_password_reset_token(p_email text)
returns table (
  token text,
  email text,
  user_type text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := now() + interval '30 minutes';
begin
  if v_email is null or v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' then
    raise exception 'email invalido';
  end if;

  insert into public.password_reset_tokens (token, email, user_type, company_id, id_participante, expires_at)
  select v_token, v_email, 'admin', a.company_id, null, v_expires_at
  from public.admins a
  where lower(a.email) = v_email
  limit 1;

  if found then
    return query select v_token, v_email, 'admin'::text, v_expires_at;
    return;
  end if;

  insert into public.password_reset_tokens (token, email, user_type, company_id, id_participante, expires_at)
  select v_token, v_email, 'participant', p.company_id, p.id_participante, v_expires_at
  from public.participantes p
  where lower(p.email) = v_email
    and p.ativo = true
  limit 1;

  if found then
    return query select v_token, v_email, 'participant'::text, v_expires_at;
  end if;
end;
$$;

create or replace function public.consume_password_reset_token(
  p_token text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_reset public.password_reset_tokens%rowtype;
begin
  if nullif(trim(p_new_password), '') is null or length(p_new_password) < 6 then
    raise exception 'A nova senha deve ter pelo menos 6 caracteres.';
  end if;

  select *
  into v_reset
  from public.password_reset_tokens
  where token = p_token
    and used_at is null
    and expires_at > now()
  limit 1
  for update;

  if not found then
    raise exception 'Token de recuperacao invalido ou expirado.';
  end if;

  if v_reset.user_type = 'admin' then
    update public.admins
    set
      password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
    where company_id = v_reset.company_id
      and lower(email) = v_reset.email;
  else
    update public.participantes
    set
      password_token = encode(convert_to('bolao:' || p_new_password, 'UTF8'), 'base64'),
      must_change_password = false,
      updated_at = now()
    where company_id = v_reset.company_id
      and id_participante = v_reset.id_participante
      and lower(email) = v_reset.email;
  end if;

  update public.password_reset_tokens
  set used_at = now()
  where id = v_reset.id;
end;
$$;

grant execute on function public.authenticate_admin(text, text) to anon, authenticated;
grant execute on function public.get_current_company() to anon, authenticated;
grant execute on function public.save_admin_profile(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_password_reset_token(text) to service_role;
grant execute on function public.consume_password_reset_token(text, text) to service_role;
