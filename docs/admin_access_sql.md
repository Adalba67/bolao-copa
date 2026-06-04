# Admin Access SQL

Substitua os e-mails e `company_id` antes de executar.

## Promover meu usuario a SUPER ADMIN

```sql
update public.admins a
set role = 'super_admin'
from auth.users u
where lower(u.email) = lower('SEU_EMAIL@DOMINIO.COM')
  and a.user_id = u.id;
```

Se ainda nao existir linha em `public.admins`:

```sql
insert into public.admins (
  user_id,
  company_id,
  login,
  name_type,
  name,
  email,
  role
)
select
  u.id,
  'super-admin',
  'super-admin',
  'Pessoa fisica',
  'SUPER ADMIN',
  u.email,
  'super_admin'
from auth.users u
where lower(u.email) = lower('SEU_EMAIL@DOMINIO.COM')
on conflict (login) do update
set user_id = excluded.user_id,
    email = excluded.email,
    role = 'super_admin';
```

## Vincular cliente como ADMIN

1. Crie o usuario em Authentication -> Users ou pelo fluxo de convite/reset do Supabase.
2. Execute:

```sql
insert into public.admins (
  user_id,
  company_id,
  login,
  name_type,
  name,
  email,
  role
)
select
  u.id,
  'COMPANY_ID_CLIENTE',
  'adm-COMPANY_ID_CLIENTE',
  'Pessoa juridica',
  'NOME DO CLIENTE',
  u.email,
  'admin'
from auth.users u
where lower(u.email) = lower('EMAIL_CLIENTE@DOMINIO.COM')
on conflict (login) do update
set user_id = excluded.user_id,
    company_id = excluded.company_id,
    name = excluded.name,
    email = excluded.email,
    role = 'admin';
```

## Listar admins

```sql
select
  a.company_id,
  a.name,
  a.email,
  a.role,
  a.user_id,
  u.email as auth_email,
  a.updated_at
from public.admins a
left join auth.users u on u.id = a.user_id
order by a.role desc, a.company_id, a.email;
```

## Remover admin cliente com seguranca

Nao remova super_admin por este comando.

```sql
delete from public.admins
where role = 'admin'
  and company_id = 'COMPANY_ID_CLIENTE'
  and lower(email) = lower('EMAIL_CLIENTE@DOMINIO.COM');
```

Opcionalmente bloqueie/remova tambem o usuario em Authentication -> Users, se ele nao for usado em outro contexto.

## Resetar senha do admin cliente

Use Authentication -> Users -> Send password recovery, ou execute um fluxo equivalente pelo Supabase Auth para o e-mail do cliente. Isso nao altera o acesso do SUPER ADMIN.
