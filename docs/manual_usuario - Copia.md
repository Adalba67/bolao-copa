# Manual de Uso do Sistema

## 1. O que o sistema faz

O Bolao da Copa serve para:

- Cadastrar a empresa ou responsavel pelo bolao.
- Cadastrar participantes.
- Registrar palpites dos jogos.
- Registrar palpites da fase final.
- Lancar resultados reais ou simulados.
- Calcular a pontuacao automaticamente.
- Exibir ranking geral.
- Exportar participantes para uma planilha no Google Sheets.
- Enviar uma copia dos dados para Google Sheets, quando configurado.

## 2. Acesso ao sistema

O acesso administrativo padrao e:

- Login: `ADM`
- Senha: a senha cadastrada no Supabase Auth para o administrador.

O login de sessao fica salvo somente no navegador, em `sessionStorage`, com a chave `bolao-user`.

Participantes cadastrados tambem podem ter login proprio. O login do participante e formado com o primeiro nome e os 3 ultimos digitos do telefone.

Exemplo:

```text
Nome: Joao
Telefone: 11999991234
Login: joao_234
```

## 3. Cadastro ADM

No cadastro ADM, informe:

- Nome da empresa ou responsavel.
- Tipo do nome cadastrado.
- Nome da planilha Google, se for usar Google Sheets.
- URL do Web App do Google Apps Script, se for sincronizar.

Quando salva o cadastro ADM, o sistema cria um identificador da empresa usando o nome informado. Esse identificador separa os dados de uma empresa dos dados de outra.

Exemplo:

```text
Empresa: Copa da Firma
ID interno: copa-da-firma
```

Se trocar o nome da empresa, o sistema passa a usar outro conjunto de dados locais.

## 4. Dashboard

O Dashboard mostra um resumo do bolao:

- Quantidade de jogos.
- Grupos.
- Selecoes.
- Participantes cadastrados.
- Ranking resumido.
- Informacoes gerais da Copa.

Use o Dashboard para acompanhar a situacao geral depois de cadastrar participantes, palpites e resultados.

## 5. Participantes

O sistema permite cadastrar participantes com:

- Nome.
- Sobrenome.
- Telefone.
- Login.
- Senha.
- Data de cadastro.

Os participantes ativos aparecem na tela de participantes e entram no ranking.

Tambem existe uma opcao para resetar senha. Ao resetar, o sistema gera uma senha temporaria e marca o participante para alterar a senha depois.

## 6. Meus Palpites

Nesta tela, o participante ou administrador registra:

- Palpites dos jogos.
- Placar do time da casa.
- Placar do time visitante.
- Campeao.
- Vice-campeao.
- Terceiro lugar.
- Quarto lugar.

Ao salvar, os palpites substituem palpites anteriores daquele mesmo participante para os mesmos jogos.

Depois de salvar, o sistema atualiza:

- Dashboard.
- Lista de palpites.
- Ranking.
- Pontuacao do participante.
- Dados armazenados no navegador.

## 7. Resultados

Na tela de Resultados, o administrador pode:

- Digitar os resultados manualmente.
- Buscar resultados pela API Ball Don't Lie.
- Definir o resultado final da competicao.
- Aplicar os resultados para recalcular o ranking.

A chave da Ball Don't Lie e digitada na tela e fica salva no navegador com a chave:

```text
ball-api-key
```

A configuracao de busca automatica fica em:

```text
ball-auto-fetch
```

A busca automatica so tenta importar resultados a partir da data configurada no codigo:

```text
2026-06-11
```

## 8. Simulador

O Simulador gera resultados ficticios para testar o bolao antes dos jogos reais.

Use o simulador para:

- Conferir se os palpites estao pontuando.
- Testar ranking.
- Demonstrar o sistema antes da Copa.

Os resultados simulados ficam em memoria enquanto a pagina esta aberta. Eles nao sao gravados em arquivo automaticamente.

## 9. Ranking

O ranking soma:

- Pontos dos jogos.
- Pontos da fase final.
- Total geral.

O ranking pode ser filtrado por:

- Todas as rodadas.
- Rodada 1.
- Rodada 2.
- Rodada 3.
- Todos os grupos.
- Grupo especifico.

O primeiro colocado aparece como vencedor do bolao.

## 10. Regras de pontuacao

Jogos normais:

- Acertou vencedor ou empate: 3 pontos.
- Acertou placar exato: 5 pontos.
- Errou: 0 ponto.

Jogos do Brasil:

- Acertou vencedor ou empate: 5 pontos.
- Acertou placar exato: 10 pontos.

Fase final:

- Acertou uma selecao dentro do top 4: 10 pontos.
- Acertou a posicao exata: mais 5 pontos.

## 11. Onde os dados ficam salvos

### 11.1 Dados iniciais do projeto

Os dados base ficam no Supabase. Os CSVs em `src/data/` servem apenas como fonte de importacao inicial da agenda de jogos e das selecoes.

### 11.2 Dados cadastrados pela tela

Os dados cadastrados pelo usuario ficam no Supabase.

As tabelas principais sao `admins`, `participantes`, `jogos`, `palpites`, `fase_final`, `resultado_final` e `ranking`.

Isso significa que os cadastros ficam no navegador e no computador onde foram feitos. Se abrir em outro navegador ou limpar os dados do navegador, esses dados locais podem nao aparecer.

### 11.3 Copia para Google Sheets

Quando o botao de sincronizacao com Google Sheets e usado, o sistema envia uma copia dos dados para a URL do Google Apps Script configurada no Cadastro ADM.

No Cadastro ADM, preencha:

- Nome da planilha: nome amigavel exibido no sistema.
- ID da planilha Google: trecho da URL do Google Sheets que fica entre `/d/` e `/edit`.

Exemplo:

```text
https://docs.google.com/spreadsheets/d/1ABCDEFghiJKLmnoPQRstuVWXYZ123456789/edit
```

Nesse exemplo, o ID da planilha e:

```text
1ABCDEFghiJKLmnoPQRstuVWXYZ123456789
```

A URL tecnica do Web App do Apps Script nao fica mais na tela. Ela deve ser configurada uma unica vez no codigo em `app.js`, na constante:

```text
GOOGLE_APPS_SCRIPT_WEBHOOK_URL
```

O arquivo do script esta em:

```text
docs/google_apps_script.gs
```

O script grava abas na planilha com estes nomes:

```text
<Empresa> - Cadastro
<Empresa> - Participantes
<Empresa> - Palpites
<Empresa> - Ranking
```

Essa e a copia externa principal do sistema. Ela so acontece quando:

- A URL do Google Apps Script foi informada.
- O Cadastro ADM foi salvo.
- O usuario clicou para enviar/sincronizar com Google Sheets.

### 11.4 Exportacao da planilha de participantes

Na tela de participantes, o botao **Exportar planilha** envia os participantes ativos para o Google Apps Script configurado no Cadastro ADM.

O Google Apps Script cria ou reutiliza a planilha da empresa no Google Sheets e abre a planilha em uma nova aba do navegador.

### 11.5 Pasta de copia para deploy

O projeto tambem possui a pasta:

```text
vercel-stage/
```

Essa pasta contem uma copia de arquivos usada como area de preparacao para deploy/publicacao na Vercel.

Ela nao e a base principal dos dados do usuario. A base principal dos cadastros feitos pela tela e o Supabase, e a copia externa opcional e o Google Sheets.

## 12. Como usar no dia a dia

Fluxo recomendado:

1. Abrir o sistema no navegador.
2. Entrar como ADM.
3. Salvar o Cadastro ADM com o nome da empresa/responsavel.
4. Cadastrar participantes.
5. Orientar cada participante a preencher os palpites.
6. Conferir os palpites cadastrados.
7. Antes dos jogos reais, usar o Simulador apenas para teste.
8. Durante a Copa, lancar resultados reais ou importar pela Ball Don't Lie.
9. Aplicar resultados.
10. Conferir o ranking.
11. Exportar a planilha de participantes, se precisar.
12. Enviar copia para Google Sheets, se configurado.

## 13. Cuidados importantes

- Nao limpe os dados do navegador sem antes exportar ou sincronizar os dados.
- O Supabase e a fonte de verdade dos dados. Dados salvos em um navegador aparecem para outros acessos autorizados.
- A planilha exportada pela tela de participantes contem participantes, mas nao substitui uma copia completa dos palpites e ranking.
- Para ter copia externa, configure e use o Google Sheets.
- Resultados simulados servem para teste e podem nao representar resultados reais.
- A chave da Ball Don't Lie fica salva no navegador, nao em servidor.

## 14. Arquivos importantes

Arquivos do Bolao:

```text
app.js
styles.css
src/data/
src/rules/
src/usecases/
tests/
docs/
```

Documentacao complementar:

```text
README.md
DOCUMENTACAO.md
docs/deploy_vercel.md
docs/api_ball_dont_lie.md
docs/regras_pontuacao.md
docs/estrutura_planilha.md
```
