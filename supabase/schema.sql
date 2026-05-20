-- Bolao Copa 2026 - Supabase schema
-- Execute este arquivo no Supabase SQL Editor.
-- Pode ser reexecutado: tabelas, indices, triggers e policies usam IF EXISTS/IF NOT EXISTS.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- =========================================================
-- Tabelas
-- =========================================================

create table if not exists public.admins (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  company_id text not null unique,
  login text not null unique,
  password_hash text not null,
  name_type text,
  name text not null,
  sheet_name text,
  spreadsheet_id text,
  google_sheet_id text,
  webhook_url text,
  logo_data_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.admins alter column user_id drop not null;
alter table public.admins alter column id set default extensions.gen_random_uuid();
alter table public.admins add column if not exists login text;
alter table public.admins add column if not exists password_hash text;
alter table public.admins alter column login set default 'adm';
alter table public.admins alter column password_hash set default extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf'));

update public.admins
set
  login = coalesce(login, 'admin-' || left(id::text, 8)),
  password_hash = coalesce(password_hash, extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')))
where login is null or password_hash is null;

alter table public.admins alter column login set not null;
alter table public.admins alter column password_hash set not null;

create table if not exists public.jogos (
  id_jogo integer primary key,
  data_hora timestamp,
  fase text not null,
  grupo text,
  time_casa text not null,
  time_fora text not null,
  placar_real_casa integer,
  placar_real_fora integer,
  status_jogo text not null default 'agendado',
  eh_jogo_do_brasil boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jogos_status_check check (status_jogo in ('agendado', 'em_andamento', 'finalizado', 'adiado', 'cancelado', 'simulado'))
);

create table if not exists public.selecoes (
  id bigserial primary key,
  grupo text not null,
  posicao integer not null,
  selecao text not null,
  created_at timestamptz not null default now(),
  unique (grupo, posicao),
  unique (grupo, selecao)
);

create table if not exists public.participantes (
  id bigserial primary key,
  company_id text not null references public.admins(company_id) on update cascade on delete cascade,
  company_name text not null,
  id_participante integer not null,
  nome text not null,
  sobrenome text,
  telefone text,
  login text not null,
  password_token text,
  must_change_password boolean not null default false,
  apelido text,
  data_cadastro date not null default current_date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id_participante),
  unique (company_id, login)
);

create table if not exists public.palpites (
  id bigserial primary key,
  id_palpite integer,
  company_id text not null references public.admins(company_id) on update cascade on delete cascade,
  company_name text not null,
  id_participante integer not null,
  apelido text,
  id_jogo integer not null references public.jogos(id_jogo) on delete cascade,
  time_casa text not null,
  time_fora text not null,
  palpite_casa integer not null,
  palpite_fora integer not null,
  pontos_obtidos integer not null default 0,
  criterio_pontuacao text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id_participante, id_jogo),
  constraint palpites_placares_check check (palpite_casa >= 0 and palpite_fora >= 0),
  constraint palpites_participante_fk foreign key (company_id, id_participante)
    references public.participantes(company_id, id_participante)
    on update cascade
    on delete cascade
);

create table if not exists public.fase_final (
  id bigserial primary key,
  company_id text not null references public.admins(company_id) on update cascade on delete cascade,
  company_name text not null,
  id_participante integer not null,
  apelido text,
  palpite_1_lugar text,
  palpite_2_lugar text,
  palpite_3_lugar text,
  palpite_4_lugar text,
  pontos_fase_final integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id_participante),
  constraint fase_final_participante_fk foreign key (company_id, id_participante)
    references public.participantes(company_id, id_participante)
    on update cascade
    on delete cascade
);

create table if not exists public.resultado_final (
  id integer primary key default 1,
  real_1_lugar text,
  real_2_lugar text,
  real_3_lugar text,
  real_4_lugar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint resultado_final_singleton check (id = 1)
);

create table if not exists public.ranking (
  id bigserial primary key,
  company_id text not null references public.admins(company_id) on update cascade on delete cascade,
  id_participante integer not null,
  apelido text not null,
  pontos_jogos integer not null default 0,
  pontos_fase_final integer not null default 0,
  pontos_total integer not null default 0,
  posicao integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id_participante),
  constraint ranking_pontos_check check (
    pontos_jogos >= 0
    and pontos_fase_final >= 0
    and pontos_total >= 0
    and posicao > 0
  ),
  constraint ranking_participante_fk foreign key (company_id, id_participante)
    references public.participantes(company_id, id_participante)
    on update cascade
    on delete cascade
);

alter table public.participantes drop constraint if exists participantes_company_id_fkey;
alter table public.participantes
  add constraint participantes_company_id_fkey foreign key (company_id)
  references public.admins(company_id) on update cascade on delete cascade;

alter table public.palpites drop constraint if exists palpites_company_id_fkey;
alter table public.palpites
  add constraint palpites_company_id_fkey foreign key (company_id)
  references public.admins(company_id) on update cascade on delete cascade;

alter table public.palpites drop constraint if exists palpites_participante_fk;
alter table public.palpites
  add constraint palpites_participante_fk foreign key (company_id, id_participante)
  references public.participantes(company_id, id_participante) on update cascade on delete cascade;

alter table public.fase_final drop constraint if exists fase_final_company_id_fkey;
alter table public.fase_final
  add constraint fase_final_company_id_fkey foreign key (company_id)
  references public.admins(company_id) on update cascade on delete cascade;

alter table public.fase_final drop constraint if exists fase_final_participante_fk;
alter table public.fase_final
  add constraint fase_final_participante_fk foreign key (company_id, id_participante)
  references public.participantes(company_id, id_participante) on update cascade on delete cascade;

alter table public.ranking drop constraint if exists ranking_company_id_fkey;
alter table public.ranking
  add constraint ranking_company_id_fkey foreign key (company_id)
  references public.admins(company_id) on update cascade on delete cascade;

alter table public.ranking drop constraint if exists ranking_participante_fk;
alter table public.ranking
  add constraint ranking_participante_fk foreign key (company_id, id_participante)
  references public.participantes(company_id, id_participante) on update cascade on delete cascade;

-- =========================================================
-- Indices
-- =========================================================

create index if not exists idx_admins_user_id on public.admins(user_id);
create unique index if not exists idx_admins_login on public.admins(login);
create index if not exists idx_participantes_company on public.participantes(company_id);
create index if not exists idx_participantes_login on public.participantes(company_id, login);
create index if not exists idx_jogos_grupo on public.jogos(grupo);
create index if not exists idx_palpites_company_participant on public.palpites(company_id, id_participante);
create index if not exists idx_palpites_jogo on public.palpites(id_jogo);
create index if not exists idx_fase_final_company_participant on public.fase_final(company_id, id_participante);
create index if not exists idx_ranking_company_total on public.ranking(company_id, pontos_total desc, pontos_jogos desc);

-- =========================================================
-- Trigger updated_at
-- =========================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.authenticate_admin(p_login text, p_password text)
returns table (
  id uuid,
  company_id text,
  login text,
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
    a.name_type,
    a.name,
    a.sheet_name,
    a.spreadsheet_id,
    a.google_sheet_id,
    a.webhook_url,
    a.logo_data_url,
    a.updated_at
  from public.admins a
  where lower(a.login) = lower(p_login)
    and a.password_hash = extensions.crypt(p_password, a.password_hash)
  limit 1;
$$;

drop function if exists public.change_admin_password(text, text, text);

create or replace function public.change_admin_password(
  p_current_password text,
  p_login text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if nullif(trim(p_new_password), '') is null or length(p_new_password) < 6 then
    raise exception 'A nova senha deve ter pelo menos 6 caracteres.';
  end if;

  update public.admins a
  set
    password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    updated_at = now()
  where lower(a.login) = lower(p_login)
    and a.password_hash = extensions.crypt(p_current_password, a.password_hash);

  if not found then
    raise exception 'Senha atual invalida.';
  end if;
end;
$$;

create or replace function public.reset_admin_password_by_service(
  p_login text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if nullif(trim(p_new_password), '') is null or length(p_new_password) < 6 then
    raise exception 'A nova senha deve ter pelo menos 6 caracteres.';
  end if;

  update public.admins a
  set
    password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    updated_at = now()
  where lower(a.login) = lower(p_login);

  if not found then
    raise exception 'Administrador nao encontrado.';
  end if;
end;
$$;

create or replace function public.get_current_company()
returns table (
  id uuid,
  company_id text,
  login text,
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

create or replace function public.save_admin_profile(
  p_company_id text,
  p_name_type text,
  p_name text,
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

  insert into public.admins (
    company_id,
    login,
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

drop trigger if exists touch_admins_updated_at on public.admins;
create trigger touch_admins_updated_at
before update on public.admins
for each row execute function public.touch_updated_at();

drop trigger if exists touch_jogos_updated_at on public.jogos;
create trigger touch_jogos_updated_at
before update on public.jogos
for each row execute function public.touch_updated_at();

drop trigger if exists touch_participantes_updated_at on public.participantes;
create trigger touch_participantes_updated_at
before update on public.participantes
for each row execute function public.touch_updated_at();

drop trigger if exists touch_palpites_updated_at on public.palpites;
create trigger touch_palpites_updated_at
before update on public.palpites
for each row execute function public.touch_updated_at();

drop trigger if exists touch_fase_final_updated_at on public.fase_final;
create trigger touch_fase_final_updated_at
before update on public.fase_final
for each row execute function public.touch_updated_at();

drop trigger if exists touch_resultado_final_updated_at on public.resultado_final;
create trigger touch_resultado_final_updated_at
before update on public.resultado_final
for each row execute function public.touch_updated_at();

drop trigger if exists touch_ranking_updated_at on public.ranking;
create trigger touch_ranking_updated_at
before update on public.ranking
for each row execute function public.touch_updated_at();

-- =========================================================
-- Row Level Security
-- =========================================================

alter table public.admins enable row level security;
alter table public.jogos enable row level security;
alter table public.selecoes enable row level security;
alter table public.participantes enable row level security;
alter table public.palpites enable row level security;
alter table public.fase_final enable row level security;
alter table public.resultado_final enable row level security;
alter table public.ranking enable row level security;

drop policy if exists "admins_select_own_profile" on public.admins;
drop policy if exists "admins_insert_own_profile" on public.admins;
drop policy if exists "admins_update_own_profile" on public.admins;
drop policy if exists "anon_upsert_default_admin" on public.admins;
drop policy if exists "anon_insert_default_admin" on public.admins;
drop policy if exists "anon_update_default_admin" on public.admins;

create policy "admins_select_own_profile"
on public.admins
for select
to authenticated
using (auth.uid() = user_id);

create policy "admins_insert_own_profile"
on public.admins
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "admins_update_own_profile"
on public.admins
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "anon_insert_default_admin"
on public.admins
for insert
to anon, authenticated
with check (login = 'adm');

create policy "anon_update_default_admin"
on public.admins
for update
to anon, authenticated
using (login = 'adm')
with check (login = 'adm');

drop policy if exists "public_select_jogos" on public.jogos;
drop policy if exists "admins_update_jogos" on public.jogos;
drop policy if exists "anon_update_jogos" on public.jogos;

create policy "public_select_jogos"
on public.jogos
for select
to anon, authenticated
using (true);

create policy "admins_update_jogos"
on public.jogos
for update
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "anon_update_jogos"
on public.jogos
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public_select_selecoes" on public.selecoes;

create policy "public_select_selecoes"
on public.selecoes
for select
to anon, authenticated
using (true);

drop policy if exists "public_select_resultado_final" on public.resultado_final;
drop policy if exists "admins_write_resultado_final" on public.resultado_final;
drop policy if exists "anon_write_resultado_final" on public.resultado_final;

create policy "public_select_resultado_final"
on public.resultado_final
for select
to anon, authenticated
using (true);

create policy "admins_write_resultado_final"
on public.resultado_final
for all
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));

create policy "anon_write_resultado_final"
on public.resultado_final
for all
to anon, authenticated
using (true)
with check (true);

drop policy if exists "public_select_participantes" on public.participantes;
drop policy if exists "public_insert_participantes" on public.participantes;
drop policy if exists "public_update_participantes" on public.participantes;
drop policy if exists "admins_update_participantes" on public.participantes;

create policy "public_select_participantes"
on public.participantes
for select
to anon, authenticated
using (ativo = true);

create policy "public_insert_participantes"
on public.participantes
for insert
to anon, authenticated
with check (ativo = true);

create policy "public_update_participantes"
on public.participantes
for update
to anon, authenticated
using (ativo = true)
with check (ativo = true);

create policy "admins_update_participantes"
on public.participantes
for update
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
      and a.company_id = participantes.company_id
  )
)
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
      and a.company_id = participantes.company_id
  )
);

drop policy if exists "public_select_palpites" on public.palpites;
drop policy if exists "public_insert_palpites_before_deadline" on public.palpites;
drop policy if exists "public_update_palpites_before_deadline" on public.palpites;

create policy "public_select_palpites"
on public.palpites
for select
to anon, authenticated
using (true);

create policy "public_insert_palpites_before_deadline"
on public.palpites
for insert
to anon, authenticated
with check (current_date < date '2026-06-11');

create policy "public_update_palpites_before_deadline"
on public.palpites
for update
to anon, authenticated
using (current_date < date '2026-06-11')
with check (current_date < date '2026-06-11');

drop policy if exists "public_select_fase_final" on public.fase_final;
drop policy if exists "public_insert_fase_final_before_deadline" on public.fase_final;
drop policy if exists "public_update_fase_final_before_deadline" on public.fase_final;

create policy "public_select_fase_final"
on public.fase_final
for select
to anon, authenticated
using (true);

create policy "public_insert_fase_final_before_deadline"
on public.fase_final
for insert
to anon, authenticated
with check (current_date < date '2026-06-11');

create policy "public_update_fase_final_before_deadline"
on public.fase_final
for update
to anon, authenticated
using (current_date < date '2026-06-11')
with check (current_date < date '2026-06-11');

drop policy if exists "public_select_ranking" on public.ranking;
drop policy if exists "admins_write_ranking" on public.ranking;
drop policy if exists "anon_write_ranking" on public.ranking;

create policy "public_select_ranking"
on public.ranking
for select
to anon, authenticated
using (true);

create policy "admins_write_ranking"
on public.ranking
for all
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
      and a.company_id = ranking.company_id
  )
)
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
      and a.company_id = ranking.company_id
  )
);

create policy "anon_write_ranking"
on public.ranking
for all
to anon, authenticated
using (true)
with check (true);

-- =========================================================
-- Grants explicitos para PostgREST/Supabase API
-- =========================================================

grant usage on schema public to anon, authenticated;
grant select on public.jogos to anon, authenticated;
grant select on public.selecoes to anon, authenticated;
grant select on public.resultado_final to anon, authenticated;
grant select, insert, update on public.participantes to anon, authenticated;
grant select, insert, update on public.palpites to anon, authenticated;
grant select, insert, update on public.fase_final to anon, authenticated;
grant select on public.ranking to anon, authenticated;
revoke select on public.admins from anon;
grant select, insert, update on public.admins to authenticated;
grant execute on function public.authenticate_admin(text, text) to anon, authenticated;
grant execute on function public.change_admin_password(text, text, text) to anon, authenticated;
grant execute on function public.get_current_company() to anon, authenticated;
grant execute on function public.save_admin_profile(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.reset_admin_password_by_service(text, text) to service_role;
grant update on public.jogos to authenticated;
grant update on public.jogos to anon;
grant insert, update on public.resultado_final to authenticated;
grant insert, update on public.resultado_final to anon;
grant insert, update on public.ranking to authenticated;
grant insert, update on public.ranking to anon;
grant usage, select on all sequences in schema public to anon, authenticated;

-- =========================================================
-- Seed inicial obrigatorio
-- =========================================================

insert into public.admins (
  company_id,
  login,
  password_hash,
  name_type,
  name,
  sheet_name,
  created_at,
  updated_at
)
values (
  'sem-empresa',
  'adm',
  extensions.crypt(extensions.gen_random_uuid()::text, extensions.gen_salt('bf')),
  'Nome fantasia',
  'Empresa nao configurada',
  'Empresa nao configurada',
  now(),
  now()
)
on conflict (login) do update
set
  company_id = coalesce(public.admins.company_id, excluded.company_id),
  password_hash = case
    when public.admins.password_hash is null then excluded.password_hash
    else public.admins.password_hash
  end,
  name_type = coalesce(public.admins.name_type, excluded.name_type),
  name = coalesce(public.admins.name, excluded.name),
  sheet_name = coalesce(public.admins.sheet_name, excluded.sheet_name),
  updated_at = now();


-- =========================================================
-- Seed de jogos e selecoes da Copa
-- =========================================================

insert into public.jogos (
  id_jogo,
  data_hora,
  fase,
  grupo,
  time_casa,
  time_fora,
  placar_real_casa,
  placar_real_fora,
  status_jogo,
  eh_jogo_do_brasil
)
values
  (1, '2026-06-11 16:00', 'Grupos', 'A', 'Mexico', 'South Africa', null, null, 'agendado', false),
  (2, '2026-06-11 19:00', 'Grupos', 'A', 'Korea Republic', 'Czechia', null, null, 'agendado', false),
  (3, '2026-06-12 16:00', 'Grupos', 'B', 'Canada', 'Bosnia and Herzegovina', null, null, 'agendado', false),
  (4, '2026-06-12 19:00', 'Grupos', 'D', 'USA', 'Paraguay', null, null, 'agendado', false),
  (5, '2026-06-13 13:00', 'Grupos', 'C', 'Haiti', 'Scotland', null, null, 'agendado', false),
  (6, '2026-06-13 16:00', 'Grupos', 'D', 'Australia', 'Turkiye', null, null, 'agendado', false),
  (7, '2026-06-13 19:00', 'Grupos', 'C', 'Brazil', 'Marrocos', null, null, 'agendado', true),
  (8, '2026-06-13 22:00', 'Grupos', 'B', 'Qatar', 'Switzerland', null, null, 'agendado', false),
  (9, '2026-06-14 13:00', 'Grupos', 'E', 'Cote d''Ivoire', 'Ecuador', null, null, 'agendado', false),
  (10, '2026-06-14 16:00', 'Grupos', 'E', 'Germany', 'Curacao', null, null, 'agendado', false),
  (11, '2026-06-14 19:00', 'Grupos', 'F', 'Netherlands', 'Japan', null, null, 'agendado', false),
  (12, '2026-06-14 22:00', 'Grupos', 'F', 'Sweden', 'Tunisia', null, null, 'agendado', false),
  (13, '2026-06-15 13:00', 'Grupos', 'H', 'Saudi Arabia', 'Uruguay', null, null, 'agendado', false),
  (14, '2026-06-15 16:00', 'Grupos', 'H', 'Spain', 'Cabo Verde', null, null, 'agendado', false),
  (15, '2026-06-15 19:00', 'Grupos', 'G', 'IR Iran', 'New Zealand', null, null, 'agendado', false),
  (16, '2026-06-15 22:00', 'Grupos', 'G', 'Belgium', 'Egypt', null, null, 'agendado', false),
  (17, '2026-06-16 13:00', 'Grupos', 'I', 'France', 'Senegal', null, null, 'agendado', false),
  (18, '2026-06-16 16:00', 'Grupos', 'I', 'Iraq', 'Norway', null, null, 'agendado', false),
  (19, '2026-06-16 19:00', 'Grupos', 'J', 'Argentina', 'Algeria', null, null, 'agendado', false),
  (20, '2026-06-16 22:00', 'Grupos', 'J', 'Austria', 'Jordan', null, null, 'agendado', false),
  (21, '2026-06-17 13:00', 'Grupos', 'L', 'Ghana', 'Panama', null, null, 'agendado', false),
  (22, '2026-06-17 16:00', 'Grupos', 'L', 'England', 'Croatia', null, null, 'agendado', false),
  (23, '2026-06-17 19:00', 'Grupos', 'K', 'Portugal', 'Congo DR', null, null, 'agendado', false),
  (24, '2026-06-17 22:00', 'Grupos', 'K', 'Uzbekistan', 'Colombia', null, null, 'agendado', false),
  (25, '2026-06-18 13:00', 'Grupos', 'A', 'Czechia', 'South Africa', null, null, 'agendado', false),
  (26, '2026-06-18 16:00', 'Grupos', 'B', 'Switzerland', 'Bosnia and Herzegovina', null, null, 'agendado', false),
  (27, '2026-06-18 19:00', 'Grupos', 'B', 'Canada', 'Qatar', null, null, 'agendado', false),
  (28, '2026-06-18 22:00', 'Grupos', 'A', 'Mexico', 'Korea Republic', null, null, 'agendado', false),
  (29, '2026-06-19 13:00', 'Grupos', 'C', 'Brazil', 'Haiti', null, null, 'agendado', true),
  (30, '2026-06-19 16:00', 'Grupos', 'C', 'Scotland', 'Marrocos', null, null, 'agendado', false),
  (31, '2026-06-19 19:00', 'Grupos', 'D', 'Turkiye', 'Paraguay', null, null, 'agendado', false),
  (32, '2026-06-19 22:00', 'Grupos', 'D', 'USA', 'Australia', null, null, 'agendado', false),
  (33, '2026-06-20 13:00', 'Grupos', 'E', 'Germany', 'Cote d''Ivoire', null, null, 'agendado', false),
  (34, '2026-06-20 16:00', 'Grupos', 'E', 'Ecuador', 'Curacao', null, null, 'agendado', false),
  (35, '2026-06-20 19:00', 'Grupos', 'F', 'Netherlands', 'Sweden', null, null, 'agendado', false),
  (36, '2026-06-20 22:00', 'Grupos', 'F', 'Tunisia', 'Japan', null, null, 'agendado', false),
  (37, '2026-06-21 13:00', 'Grupos', 'H', 'Uruguay', 'Cabo Verde', null, null, 'agendado', false),
  (38, '2026-06-21 16:00', 'Grupos', 'H', 'Spain', 'Saudi Arabia', null, null, 'agendado', false),
  (39, '2026-06-21 19:00', 'Grupos', 'G', 'Belgium', 'IR Iran', null, null, 'agendado', false),
  (40, '2026-06-21 22:00', 'Grupos', 'G', 'New Zealand', 'Egypt', null, null, 'agendado', false),
  (41, '2026-06-22 13:00', 'Grupos', 'I', 'Norway', 'Senegal', null, null, 'agendado', false),
  (42, '2026-06-22 16:00', 'Grupos', 'I', 'France', 'Iraq', null, null, 'agendado', false),
  (43, '2026-06-22 19:00', 'Grupos', 'J', 'Argentina', 'Austria', null, null, 'agendado', false),
  (44, '2026-06-22 22:00', 'Grupos', 'J', 'Jordan', 'Algeria', null, null, 'agendado', false),
  (45, '2026-06-23 13:00', 'Grupos', 'L', 'England', 'Ghana', null, null, 'agendado', false),
  (46, '2026-06-23 16:00', 'Grupos', 'L', 'Panama', 'Croatia', null, null, 'agendado', false),
  (47, '2026-06-23 19:00', 'Grupos', 'K', 'Portugal', 'Uzbekistan', null, null, 'agendado', false),
  (48, '2026-06-23 22:00', 'Grupos', 'K', 'Colombia', 'Congo DR', null, null, 'agendado', false),
  (49, '2026-06-24 13:00', 'Grupos', 'C', 'Scotland', 'Brazil', null, null, 'agendado', true),
  (50, '2026-06-24 13:00', 'Grupos', 'C', 'Marrocos', 'Haiti', null, null, 'agendado', false),
  (51, '2026-06-24 16:00', 'Grupos', 'B', 'Switzerland', 'Canada', null, null, 'agendado', false),
  (52, '2026-06-24 16:00', 'Grupos', 'B', 'Bosnia and Herzegovina', 'Qatar', null, null, 'agendado', false),
  (53, '2026-06-24 19:00', 'Grupos', 'A', 'Czechia', 'Mexico', null, null, 'agendado', false),
  (54, '2026-06-24 19:00', 'Grupos', 'A', 'South Africa', 'Korea Republic', null, null, 'agendado', false),
  (55, '2026-06-25 13:00', 'Grupos', 'E', 'Curacao', 'Cote d''Ivoire', null, null, 'agendado', false),
  (56, '2026-06-25 13:00', 'Grupos', 'E', 'Ecuador', 'Germany', null, null, 'agendado', false),
  (57, '2026-06-25 16:00', 'Grupos', 'F', 'Japan', 'Sweden', null, null, 'agendado', false),
  (58, '2026-06-25 16:00', 'Grupos', 'F', 'Tunisia', 'Netherlands', null, null, 'agendado', false),
  (59, '2026-06-25 19:00', 'Grupos', 'D', 'Turkiye', 'USA', null, null, 'agendado', false),
  (60, '2026-06-25 19:00', 'Grupos', 'D', 'Paraguay', 'Australia', null, null, 'agendado', false),
  (61, '2026-06-26 13:00', 'Grupos', 'I', 'Norway', 'France', null, null, 'agendado', false),
  (62, '2026-06-26 13:00', 'Grupos', 'I', 'Senegal', 'Iraq', null, null, 'agendado', false),
  (63, '2026-06-26 16:00', 'Grupos', 'G', 'Egypt', 'IR Iran', null, null, 'agendado', false),
  (64, '2026-06-26 16:00', 'Grupos', 'G', 'New Zealand', 'Belgium', null, null, 'agendado', false),
  (65, '2026-06-26 19:00', 'Grupos', 'H', 'Cabo Verde', 'Saudi Arabia', null, null, 'agendado', false),
  (66, '2026-06-26 19:00', 'Grupos', 'H', 'Uruguay', 'Spain', null, null, 'agendado', false),
  (67, '2026-06-27 13:00', 'Grupos', 'L', 'Panama', 'England', null, null, 'agendado', false),
  (68, '2026-06-27 13:00', 'Grupos', 'L', 'Croatia', 'Ghana', null, null, 'agendado', false),
  (69, '2026-06-27 16:00', 'Grupos', 'J', 'Algeria', 'Austria', null, null, 'agendado', false),
  (70, '2026-06-27 16:00', 'Grupos', 'J', 'Jordan', 'Argentina', null, null, 'agendado', false),
  (71, '2026-06-27 19:00', 'Grupos', 'K', 'Colombia', 'Portugal', null, null, 'agendado', false),
  (72, '2026-06-27 19:00', 'Grupos', 'K', 'Congo DR', 'Uzbekistan', null, null, 'agendado', false)
on conflict (id_jogo) do update
set
  data_hora = excluded.data_hora,
  fase = excluded.fase,
  grupo = excluded.grupo,
  time_casa = excluded.time_casa,
  time_fora = excluded.time_fora,
  eh_jogo_do_brasil = excluded.eh_jogo_do_brasil,
  updated_at = now();

insert into public.selecoes (
  grupo,
  posicao,
  selecao
)
values
  ('A', 1, 'Mexico'),
  ('A', 2, 'South Africa'),
  ('A', 3, 'Korea Republic'),
  ('A', 4, 'Czechia'),
  ('B', 1, 'Canada'),
  ('B', 2, 'Bosnia and Herzegovina'),
  ('B', 3, 'Qatar'),
  ('B', 4, 'Switzerland'),
  ('C', 1, 'Brazil'),
  ('C', 2, 'Marrocos'),
  ('C', 3, 'Haiti'),
  ('C', 4, 'Scotland'),
  ('D', 1, 'USA'),
  ('D', 2, 'Paraguay'),
  ('D', 3, 'Australia'),
  ('D', 4, 'Turkiye'),
  ('E', 1, 'Germany'),
  ('E', 2, 'Curacao'),
  ('E', 3, 'Cote d''Ivoire'),
  ('E', 4, 'Ecuador'),
  ('F', 1, 'Netherlands'),
  ('F', 2, 'Japan'),
  ('F', 3, 'Sweden'),
  ('F', 4, 'Tunisia'),
  ('G', 1, 'Belgium'),
  ('G', 2, 'Egypt'),
  ('G', 3, 'IR Iran'),
  ('G', 4, 'New Zealand'),
  ('H', 1, 'Spain'),
  ('H', 2, 'Cabo Verde'),
  ('H', 3, 'Saudi Arabia'),
  ('H', 4, 'Uruguay'),
  ('I', 1, 'France'),
  ('I', 2, 'Senegal'),
  ('I', 3, 'Iraq'),
  ('I', 4, 'Norway'),
  ('J', 1, 'Argentina'),
  ('J', 2, 'Algeria'),
  ('J', 3, 'Austria'),
  ('J', 4, 'Jordan'),
  ('K', 1, 'Portugal'),
  ('K', 2, 'Congo DR'),
  ('K', 3, 'Uzbekistan'),
  ('K', 4, 'Colombia'),
  ('L', 1, 'England'),
  ('L', 2, 'Croatia'),
  ('L', 3, 'Ghana'),
  ('L', 4, 'Panama')
on conflict (grupo, posicao) do update
set
  selecao = excluded.selecao;
