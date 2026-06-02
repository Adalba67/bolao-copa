-- Link participantes to Supabase Auth users created by the serverless sync endpoint.

alter table public.participantes
add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists idx_participantes_auth_user_id
on public.participantes(auth_user_id)
where auth_user_id is not null;
