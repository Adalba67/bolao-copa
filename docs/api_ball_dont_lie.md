# API Ball Don't Lie

## Objetivo

Importar resultados reais da Copa do Mundo quando os jogos estiverem acontecendo.

## Onde usar

Menu `Resultados`.

## Configuracao

Cole a API key no campo:

```text
Chave da API Ball Don't Lie
```

A chave fica salva no navegador via `localStorage`.

## Busca automatica

A opcao `Buscar automaticamente quando a Copa comecar` fica marcada por padrao.

A data configurada no codigo e:

```text
2026-06-11
```

A partir dessa data, quando a aplicacao abrir, ela tenta buscar resultados reais se houver API key salva.

## Endpoint usado

```text
GET https://api.balldontlie.io/fifa/worldcup/v1/matches?seasons[]=2026&per_page=100
Authorization: SUA_API_KEY
```

## Campos usados

O sistema usa:

- `match_number`: para relacionar com `id_jogo`.
- `home_score`: placar da selecao da casa.
- `away_score`: placar da selecao visitante.

Somente jogos com `home_score` e `away_score` preenchidos entram no calculo.

## Observacoes

- A API exige chave valida.
- O endpoint de partidas pode exigir plano com acesso a `Matches`.
- Se nao houver resultado disponivel, o sistema avisa que nenhum dos 10 jogos possui placar.
