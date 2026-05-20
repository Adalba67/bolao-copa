# Documentacao do Projeto

## Visao geral

O Bolao Copa e uma aplicacao web estatica para cadastrar palpites, lancar resultados e calcular ranking de um bolao da Copa do Mundo.

## Acesso

- Login: `ADM`
- Senha: definida no Supabase e alterada pelo menu ADM

## Modulos da tela

- `Dashboard`: resumo geral, banner e grupos.
- `Jogos`: tabela de jogos e resultados aplicados.
- `Palpites`: palpites cadastrados com pontuacao.
- `Simulador`: gera resultados ficticios.
- `Meus Palpites`: cadastra participante e palpites.
- `Resultados`: lanca placares ou importa da Ball Don't Lie.

## Regras

Jogos normais:

- Vencedor ou empate: 3 pontos.
- Placar exato: 5 pontos.
- Erro: 0 ponto e criterio `perdeu`.

Jogos do Brasil:

- Vencedor ou empate: 5 pontos.
- Placar exato: 10 pontos.

Fase final:

- Selecao no top 4: 10 pontos.
- Posicao exata: +5 pontos.

## Integracoes

### Bandeiras

As bandeiras sao carregadas pela FlagCDN:

```text
https://flagcdn.com/24x18/{codigo}.png
```

### Resultados reais

Os resultados reais podem ser buscados na Ball Don't Lie:

```text
https://api.balldontlie.io/fifa/worldcup/v1/matches?seasons[]=2026&per_page=100
```

A chave da API e preenchida na tela `Resultados`.

## Deploy

Deploy recomendado: Vercel.

Arquivos:

- `vercel.json`
- `.vercelignore`
- `DEPLOY.md`
- `docs/deploy_vercel.md`

## Testes

```powershell
node --check app.js
python -m pytest
```
