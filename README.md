# Bolao Copa

Aplicacao web simples para administrar um bolao da Copa do Mundo.

Repositorio sincronizado para teste de commit e push.

O projeto roda como site estatico no navegador, usa Supabase como persistencia principal e tem regras de pontuacao tambem implementadas em Python para validacao e testes.

## Funcionalidades

- Login de administrador persistido no Supabase.
- Dashboard com banner animado.
- Listagem de jogos e grupos.
- Bandeiras das selecoes via FlagCDN.
- Cadastro de palpites pelo menu `Meus Palpites`.
- Lancamento de 10 resultados pelo menu `Resultados`.
- Simulador automatico de resultados.
- Ranking com pontos dos jogos, fase final e total.
- Persistencia em Supabase para participantes, palpites, resultados e ranking.
- Integracao preparada com Ball Don't Lie para importar resultados reais quando a Copa comecar.

## Como rodar localmente

Na pasta do projeto:

```powershell
python -m http.server 8001
```

Acesse:

```text
http://127.0.0.1:8001/
```

Login ADM:

```text
adm
<senha definida no Supabase>
```

## Como testar

```powershell
python -m pytest
```

Validar sintaxe do JavaScript:

```powershell
node --check app.js
```

## Menus

`Dashboard`: mostra resumo do bolao, grupos e banner.

`Jogos`: lista jogos e resultados aplicados.

`Palpites`: mostra palpites cadastrados e pontuacao calculada.

`Simulador`: gera resultados ficticios e recalcula o ranking.

`Meus Palpites`: permite cadastrar nome, 10 palpites de jogos e 4 selecoes da fase final.

`Resultados`: permite digitar 10 resultados reais ou buscar resultados pela Ball Don't Lie.

## Ball Don't Lie

No menu `Resultados`:

1. Cole sua API key da Ball Don't Lie.
2. Deixe marcada a opcao `Buscar automaticamente quando a Copa comecar`.
3. A partir de 11/06/2026, o sistema tenta importar os resultados ao abrir.
4. O botao manual continua disponivel para forcar a atualizacao.

Endpoint usado:

```text
https://api.balldontlie.io/fifa/worldcup/v1/matches?seasons[]=2026&per_page=100
```

## Arquivos principais

- `index.html`: estrutura da aplicacao web.
- `styles.css`: visual, layout, banner e responsividade.
- `app.js`: login, simulador, lancamento, ranking, bandeiras e API.
- `api/config.js`: expoe a configuracao publica do Supabase a partir das variaveis da Vercel.
- `src/lib/supabaseClient.js`: cliente Supabase centralizado.
- `src/lib/bolaoRepository.js`: camada de persistencia do bolao.
- `supabase/schema.sql`: tabelas, indices e politicas RLS.
- `src/data/*.csv`: arquivos de importacao inicial para agenda e selecoes.
- `src/rules/*.py`: regras de pontuacao em Python.
- `tests/`: testes das regras.
- `vercel.json`: configuracao para deploy estatico na Vercel.

## Documentacao

- [Manual de uso](docs/manual_usuario.md)
- [Deploy](docs/deploy_vercel.md)
- [API Ball Don't Lie](docs/api_ball_dont_lie.md)
- [Regras de pontuacao](docs/regras_pontuacao.md)
- [Estrutura da planilha](docs/estrutura_planilha.md)
- [Supabase](docs/supabase.md)
