alter table public.participantes
  add column if not exists access_blocked boolean not null default false;

create index if not exists idx_participantes_access_blocked
  on public.participantes(company_id, access_blocked);
