# Supabase

## Arquitetura

Este projeto e um frontend estatico na Vercel, nao Vite e nao Next.js. Por isso o navegador busca a configuracao em `/api/config`, uma function Vercel que le `SUPABASE_URL` e `SUPABASE_ANON_KEY` do ambiente.

## Executar SQL

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Cole e execute `supabase/schema.sql`.
4. Crie o usuario ADM no Supabase Auth.
5. Vincule `auth.users.id` em `public.admins.user_id` usando `docs/admin_access_sql.md`.
6. O proprio `schema.sql` insere a agenda de jogos e as selecoes.

As tabelas `participantes`, `palpites`, `fase_final`, `resultado_final` e `ranking` passam a ser preenchidas pelo app.

## Variaveis na Vercel

Como o projeto e estatico puro, use:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
```

`SUPABASE_SERVICE_ROLE_KEY` fica somente na Vercel. Nao use essa variavel no frontend e nao coloque seu valor no GitHub.

## Senha ADM

ADM e SUPER ADMIN usam Supabase Auth. A coluna legada `admins.password_hash` nao deve ser usada para login ou troca de senha.

Para definir senha inicial ou recuperar acesso, use Supabase Auth em `Authentication -> Users -> Send password recovery`. Para ADMIN CLIENTE, o SUPER ADMIN tambem pode usar `/api/admins` com `action: "reset"`.

Se no futuro o projeto for migrado para Vite, renomeie para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Se for migrado para Next.js, use `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Teste rapido

1. Configure as variaveis na Vercel e faca redeploy.
2. Abra `/api/config` no deploy e confirme que retorna URL e anon key preenchidas.
3. Abra o site e entre como ADM usando e-mail e senha do Supabase Auth.
4. Salve o Cadastro ADM.
5. Cadastre um participante.
6. Confira no Supabase se a tabela `participantes` recebeu o registro.
7. Entre como participante, salve palpites e confira `palpites` e `fase_final`.
8. Lance resultados e confira `jogos`, `resultado_final` e `ranking`.

