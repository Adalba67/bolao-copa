# Deploy Rapido

O projeto esta pronto para deploy estatico na Vercel.

## Publicar pela CLI

Na pasta do projeto:

```powershell
vercel login
vercel --prod
```

Ou usando o script:

```powershell
npm run deploy
```

## Publicar com token

Se voce tiver um token da Vercel:

```powershell
vercel --prod --token SEU_TOKEN
```

## Configuracao

Nao ha comando de build.

Arquivos servidos na raiz:

- `index.html`
- `styles.css`
- `app.js`
- `src/data/*.csv`

## Validacao local

```powershell
npm run check
python -m pytest
python -m http.server 8001
```

Acesse:

```text
http://127.0.0.1:8001/
```
