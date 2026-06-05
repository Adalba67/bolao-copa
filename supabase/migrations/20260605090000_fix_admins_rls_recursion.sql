-- Fix recursive RLS on public.admins.
-- Policies on admins cannot query public.admins directly, otherwise Postgres
-- evaluates the same policy again and raises "infinite recursion detected".

create or replace function public.auth_admin_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.role
  from public.admins a
  where a.user_id = p_user_id
  limit 1
$$;

create or replace function public.auth_admin_company_id(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select a.company_id
  from public.admins a
  where a.user_id = p_user_id
  limit 1
$$;

create or replace function public.auth_is_super_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.auth_admin_role(p_user_id) = 'super_admin', false)
$$;

revoke all on function public.auth_admin_role(uuid) from public;
revoke all on function public.auth_admin_company_id(uuid) from public;
revoke all on function public.auth_is_super_admin(uuid) from public;
grant execute on function public.auth_admin_role(uuid) to authenticated, service_role;
grant execute on function public.auth_admin_company_id(uuid) to authenticated, service_role;
grant execute on function public.auth_is_super_admin(uuid) to authenticated, service_role;

drop policy if exists "admins_select_own_profile" on public.admins;
create policy "admins_select_own_profile"
on public.admins
for select
to authenticated
using (
  user_id = auth.uid()
  or public.auth_is_super_admin(auth.uid())
);

drop policy if exists "admins_update_own_profile" on public.admins;
create policy "admins_update_own_profile"
on public.admins
for update
to authenticated
using (
  user_id = auth.uid()
  or public.auth_is_super_admin(auth.uid())
)
with check (
  public.auth_is_super_admin(auth.uid())
  or (
    user_id = auth.uid()
    and role = 'admin'
    and company_id = public.auth_admin_company_id(auth.uid())
  )
);

drop policy if exists "admins_select_company_audit_logs" on public.audit_logs;
create policy "admins_select_company_audit_logs"
on public.audit_logs
for select
to authenticated
using (
  public.auth_is_super_admin(auth.uid())
  or company_id = public.auth_admin_company_id(auth.uid())
);
