-- Adds explicit admin roles.
-- role = 'super_admin' can operate globally through protected backend APIs.
-- role = 'admin' is scoped to its own company_id.

alter table public.admins
add column if not exists role text not null default 'admin';

alter table public.admins
drop constraint if exists admins_role_check;

alter table public.admins
add constraint admins_role_check check (role in ('super_admin', 'admin'));

create index if not exists idx_admins_role
on public.admins(role);

-- Super admin can read every admin row. Admin client reads only itself.
drop policy if exists "admins_select_own_profile" on public.admins;
create policy "admins_select_own_profile"
on public.admins
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.admins super
    where super.user_id = auth.uid()
      and super.role = 'super_admin'
  )
);

-- Admin client cannot promote itself or change company ownership through RLS.
drop policy if exists "admins_update_own_profile" on public.admins;
create policy "admins_update_own_profile"
on public.admins
for update
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.admins super
    where super.user_id = auth.uid()
      and super.role = 'super_admin'
  )
)
with check (
  (
    user_id = auth.uid()
    and role = 'admin'
  )
  or exists (
    select 1
    from public.admins super
    where super.user_id = auth.uid()
      and super.role = 'super_admin'
  )
);

-- Super admin can inspect all audit logs. Admin client sees its company only.
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
      and (
        a.role = 'super_admin'
        or a.company_id = audit_logs.company_id
      )
  )
);

-- Super admin can update participants for every company through authenticated
-- admin tooling. Admin client remains scoped to its company_id.
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
      and (
        a.role = 'super_admin'
        or a.company_id = participantes.company_id
      )
  )
)
with check (
  exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
      and (
        a.role = 'super_admin'
        or a.company_id = participantes.company_id
      )
  )
);
