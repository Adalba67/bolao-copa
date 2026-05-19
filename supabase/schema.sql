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
alter table public.admins alter column password_hash set default extensions.crypt('12345', extensions.gen_salt('bf'));

update public.admins
set
  login = coalesce(login, 'admin-' || left(id::text, 8)),
  password_hash = coalesce(password_hash, extensions.crypt('12345', extensions.gen_salt('bf')))
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
    extensions.crypt('12345', extensions.gen_salt('bf')),
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
grant execute on function public.get_current_company() to anon, authenticated;
grant execute on function public.save_admin_profile(text, text, text, text, text, text, text, text) to anon, authenticated;
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
  extensions.crypt('12345', extensions.gen_salt('bf')),
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
