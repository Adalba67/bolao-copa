# Supabase

## Arquitetura

Este projeto e um frontend estatico na Vercel, nao Vite e nao Next.js. Por isso o navegador busca a configuracao em `/api/config`, uma function Vercel que le `SUPABASE_URL` e `SUPABASE_ANON_KEY` do ambiente.

## Executar SQL

1. Crie um projeto no Supabase.
2. Abra `SQL Editor`.
3. Cole e execute `supabase/schema.sql`.
4. O SQL cria o admin padrao no banco:

```text
login: adm
senha: definida via bootstrap e depois alterada no menu ADM
```

5. Defina a senha inicial usando `/api/reset-admin-password`, entre com `adm` e a senha definida, depois altere a senha no menu ADM.
6. O proprio `schema.sql` insere a agenda de jogos e as selecoes.

As tabelas `participantes`, `palpites`, `fase_final`, `resultado_final` e `ranking` passam a ser preenchidas pelo app.

## Variaveis na Vercel

Como o projeto e estatico puro, use:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SERVICE_ROLE
ADMIN_BOOTSTRAP_PASSWORD=UMA_SENHA_FORTE_DE_BOOTSTRAP
```

`SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_BOOTSTRAP_PASSWORD` ficam somente na Vercel. Nao use essas variaveis no frontend e nao coloque seus valores no GitHub.

## Senha ADM

A senha ADM fica no Supabase apenas como hash em `admins.password_hash`.

Para definir a senha inicial ou recuperar acesso se esquecer:

```powershell
Invoke-RestMethod -Method Post `
  -Uri "https://SEU-DOMINIO.vercel.app/api/reset-admin-password" `
  -ContentType "application/json" `
  -Body '{"bootstrapPassword":"VALOR_DE_ADMIN_BOOTSTRAP_PASSWORD","newPassword":"NOVA_SENHA_ADM"}'
```

Depois de entrar no sistema, altere a senha pelo menu `ADM > Senha do ADM`.

Se no futuro o projeto for migrado para Vite, renomeie para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Se for migrado para Next.js, use `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Teste rapido

1. Configure as variaveis na Vercel e faca redeploy.
2. Abra `/api/config` no deploy e confirme que retorna URL e anon key preenchidas.
3. Abra o site e entre como ADM usando `adm` e a senha salva no Supabase.
4. Salve o Cadastro ADM.
5. Cadastre um participante.
6. Confira no Supabase se a tabela `participantes` recebeu o registro.
7. Entre como participante, salve palpites e confira `palpites` e `fase_final`.
8. Lance resultados e confira `jogos`, `resultado_final` e `ranking`.

