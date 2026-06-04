-- Remove legacy ADM authentication paths. ADM and SUPER ADMIN must use
-- Supabase Auth plus public.admins.user_id.

revoke execute on function public.authenticate_admin(text, text) from anon, authenticated;
revoke execute on function public.change_admin_password(text, text, text) from anon, authenticated;
revoke execute on function public.save_admin_profile(text, text, text, text, text, text, text, text, text) from anon, authenticated;
revoke execute on function public.get_current_company() from anon, authenticated;

drop function if exists public.authenticate_admin(text, text);
drop function if exists public.change_admin_password(text, text, text);
drop function if exists public.reset_admin_password_by_service(text, text);
drop function if exists public.save_admin_profile(text, text, text, text, text, text, text, text);
drop function if exists public.save_admin_profile(text, text, text, text, text, text, text, text, text);
drop function if exists public.get_current_company();
drop function if exists public.link_auth_user_by_email();

alter table public.admins
add column if not exists role text not null default 'admin';

alter table public.admins
drop constraint if exists admins_role_check;

alter table public.admins
add constraint admins_role_check check (role in ('super_admin', 'admin'));

-- Legacy password_hash is no longer used for authentication. Keep the column
-- for compatibility with older schema snapshots, but make it non-authoritative.
alter table public.admins
alter column password_hash drop not null;

create unique index if not exists idx_admins_user_id_unique
on public.admins(user_id);

create index if not exists idx_admins_company_role
on public.admins(company_id, role);

grant select on public.admins to authenticated;
revoke insert, update, delete on public.admins from anon;
