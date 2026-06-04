# Rollback Manual - Auth ADM

Use somente se o deploy precisar ser revertido.

## 1. Reverter codigo

```bash
git revert <commit-da-mudanca-de-auth>
git push
```

## 2. Restaurar acesso operacional

No Supabase, confirme que pelo menos um usuario em `auth.users` esta vinculado:

```sql
select a.company_id, a.email, a.role, a.user_id, u.email as auth_email
from public.admins a
left join auth.users u on u.id = a.user_id
order by a.role desc, a.company_id;
```

Se necessario, promova novamente o usuario principal:

```sql
update public.admins a
set role = 'super_admin'
from auth.users u
where a.user_id = u.id
  and lower(u.email) = lower('SEU_EMAIL@DOMINIO.COM');
```

## 3. Reabrir temporariamente execucao legada

Evite este passo. Use apenas para recuperar acesso enquanto o codigo antigo
estiver em producao. As funcoes legadas precisam existir no banco para estes
grants funcionarem.

```sql
grant execute on function public.authenticate_admin(text, text) to anon, authenticated;
grant execute on function public.change_admin_password(text, text, text) to anon, authenticated;
grant execute on function public.save_admin_profile(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_current_company() to anon, authenticated;
```

## 4. Checklist de reversao

- Confirmar login por Supabase Auth do SUPER ADMIN.
- Confirmar `public.admins.user_id` preenchido.
- Confirmar que `SUPABASE_SERVICE_ROLE_KEY` continua somente no backend.
- Confirmar que nenhum cliente recebeu senha/e-mail do SUPER ADMIN.
- Reaplicar a migration de remocao do legado antes de novo deploy seguro.

