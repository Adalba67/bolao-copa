# Deploy na Vercel

## Tipo de projeto

Este projeto e um site estatico:

- `index.html`
- `styles.css`
- `app.js`
- CSVs em `src/data/`

Nao precisa de build.

## Arquivos de deploy

O projeto ja possui:

- `vercel.json`
- `.vercelignore`

Configuracao atual:

```json
{
  "cleanUrls": true,
  "trailingSlash": false
}
```

## Deploy pelo painel da Vercel

1. Suba o projeto para um repositorio Git.
2. Acesse `https://vercel.com`.
3. Clique em `Add New Project`.
4. Importe o repositorio.
5. Em `Framework Preset`, escolha `Other`.
6. Deixe `Build Command` vazio.
7. Deixe `Output Directory` vazio ou como raiz do projeto.
8. Clique em `Deploy`.

## Deploy pela CLI

Instale ou use a CLI:

```powershell
npm i -g vercel
```

Faça login:

```powershell
vercel login
```

Deploy de producao:

```powershell
vercel --prod
```

## Teste antes de publicar

```powershell
node --check app.js
python -m pytest
python -m http.server 8001
```

Acesse:

```text
http://127.0.0.1:8001/
```

## Variaveis de ambiente

Hoje a chave da Ball Don't Lie e informada na tela e salva no navegador.

Nao ha variavel obrigatoria na Vercel para o frontend atual.

Se no futuro a API key for protegida em backend, crie uma API serverless e salve a chave nas variaveis da Vercel.
