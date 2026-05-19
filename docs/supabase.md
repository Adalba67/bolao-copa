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
senha: 12345
```

5. Entre no site com `adm` / `12345` e salve o Cadastro ADM.
6. Importe `src/data/jogos_exemplo.csv` para a tabela `jogos`.
7. Importe `src/data/selecoes_grupos.csv` para a tabela `selecoes`.

As tabelas `participantes`, `palpites`, `fase_final`, `resultado_final` e `ranking` passam a ser preenchidas pelo app.

## Variaveis na Vercel

Como o projeto e estatico puro, use:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLIC
```

Se no futuro o projeto for migrado para Vite, renomeie para `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Se for migrado para Next.js, use `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Teste rapido

1. Configure as variaveis na Vercel e faca redeploy.
2. Abra `/api/config` no deploy e confirme que retorna URL e anon key preenchidas.
3. Abra o site e entre como ADM usando `adm` / `12345`.
4. Salve o Cadastro ADM.
5. Cadastre um participante.
6. Confira no Supabase se a tabela `participantes` recebeu o registro.
7. Entre como participante, salve palpites e confira `palpites` e `fase_final`.
8. Lance resultados e confira `jogos`, `resultado_final` e `ranking`.
