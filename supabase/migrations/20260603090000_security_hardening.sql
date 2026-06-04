-- Security hardening for server-side validated writes.
-- After this migration, public browser clients keep read access where needed,
-- but critical writes go through Vercel API routes using SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('super_admin', 'admin', 'participant', 'system')),
  company_id text,
  id_participante integer,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create index if not exists idx_audit_logs_company_created
on public.audit_logs(company_id, created_at desc);

create index if not exists idx_audit_logs_actor_created
on public.audit_logs(actor_user_id, created_at desc);

drop policy if exists "service_role_insert_audit_logs" on public.audit_logs;
create policy "service_role_insert_audit_logs"
on public.audit_logs
for insert
to service_role
with check (true);

drop policy if exists "admins_select_company_audit_logs" on public.audit_logs;
create policy "admins_select_company_audit_logs"
on public.audit_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
      and a.company_id = audit_logs.company_id
  )
);

-- Remove legacy anonymous write policies. API routes now validate Auth/JWT and
-- write with service role after checking role, company and participant ownership.
drop policy if exists "anon_insert_default_admin" on public.admins;
drop policy if exists "anon_update_default_admin" on public.admins;
drop policy if exists "anon_update_jogos" on public.jogos;
drop policy if exists "anon_write_resultado_final" on public.resultado_final;
drop policy if exists "public_insert_participantes" on public.participantes;
drop policy if exists "public_update_participantes" on public.participantes;
drop policy if exists "public_insert_palpites_before_deadline" on public.palpites;
drop policy if exists "public_update_palpites_before_deadline" on public.palpites;
drop policy if exists "public_insert_fase_final_before_deadline" on public.fase_final;
drop policy if exists "public_update_fase_final_before_deadline" on public.fase_final;
drop policy if exists "anon_write_ranking" on public.ranking;

-- Keep authenticated admin profile updates scoped to its own Auth user.
drop policy if exists "admins_update_participantes" on public.participantes;
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

-- Direct participant writes from browser are intentionally disabled. The
-- backend save-predictions API validates auth_user_id ownership and deadlines.
revoke insert, update, delete on public.palpites from anon, authenticated;
revoke insert, update, delete on public.fase_final from anon, authenticated;

-- Participant creation and Auth linking go through /api/register-participant
-- and /api/sync-participant-auth-user.
revoke insert on public.participantes from anon, authenticated;
revoke update on public.participantes from anon;

-- Results and ranking writes go through admin-only API routes.
revoke update on public.jogos from anon, authenticated;
revoke insert, update on public.resultado_final from anon, authenticated;
revoke insert, update, delete on public.ranking from anon, authenticated;

-- Admin profile mutation should not be callable anonymously.
revoke execute on function public.save_admin_profile(text, text, text, text, text, text, text, text, text) from anon, authenticated;
revoke execute on function public.change_admin_password(text, text, text) from anon, authenticated;
revoke execute on function public.authenticate_admin(text, text) from anon, authenticated;
grant execute on function public.authenticate_admin(text, text) to service_role;

grant select on public.audit_logs to authenticated;
grant insert on public.audit_logs to service_role;
