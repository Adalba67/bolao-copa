# Security Audit

Data: 2026-06-03

## Escopo

Auditoria tecnica dos fluxos de login, cadastro, recuperacao de senha, painel ADM, bloqueio de acesso, palpites, resultados, ranking, APIs Vercel e Supabase/RLS.
Inclui complemento de SUPER ADMIN, ADMIN CLIENTE e Conferencia Semifinalistas.

## O que ja estava seguro

- `SUPABASE_SERVICE_ROLE_KEY` nao e exposta pelo frontend. O navegador carrega apenas `SUPABASE_URL` e `SUPABASE_ANON_KEY` via `/api/config`.
- Cadastro recente ja usa backend serverless para criar/vincular usuario no Supabase Auth.
- `public.participantes.auth_user_id` existe e possui indice unico quando preenchido.
- `public.palpites` possui chave unica por `(company_id, id_participante, id_jogo)`, impedindo duplicidade no banco.
- `public.fase_final` possui chave unica por `(company_id, id_participante)`.
- API `/api/save-predictions` ja validava participante ativo, bloqueio de acesso e prazo por horario da partida antes de salvar.
- Login por e-mail usa Supabase Auth e bloqueia participante com `access_blocked = true`.
- Frontend esconde secoes ADM para participante comum.

## O que estava vulneravel

- APIs com service role aceitavam chamadas sem validar JWT/role:
  - `/api/save-predictions`
  - `/api/set-participant-access`
  - `/api/sync-participant-auth-user`
- Um participante poderia tentar salvar palpites passando `company_id` e `id_participante` de outro usuario, porque o backend nao comparava o payload com o `auth_user_id` da sessao.
- Bloqueio/desbloqueio de participante podia ser acionado sem prova backend de que o chamador era ADM.
- Vinculo de e-mail/Auth de participante podia ser acionado sem prova backend de que o chamador era ADM.
- Resultados e ranking ainda eram salvos diretamente pelo cliente Supabase do navegador, dependendo de grants/policies permissivas.
- RLS/grants mantinham escritas anonimas legadas em tabelas criticas:
  - `participantes`
  - `palpites`
  - `fase_final`
  - `jogos`
  - `resultado_final`
  - `ranking`
  - RPC `save_admin_profile`
  - RPC `change_admin_password`
  - RPC `authenticate_admin`
- Nao havia tabela persistente de auditoria para alteracoes criticas.

## O que foi corrigido

- Criado helper server-side `server/security.js` para:
  - validar `Authorization: Bearer <access_token>`;
  - carregar usuario Auth via Supabase;
  - exigir ADM vinculado em `public.admins.user_id`;
  - exigir participante dono via `public.participantes.auth_user_id`;
  - escrever `audit_logs`;
  - padronizar erro 401/403.
- `/api/save-predictions` agora exige JWT do participante dono dos palpites e confere:
  - `company_id`;
  - `id_participante`;
  - `auth_user_id`;
  - participante ativo;
  - participante nao bloqueado;
  - prazo de cada jogo no backend.
- `/api/set-participant-access` agora exige ADM Auth e confere `company_id` do ADM antes de bloquear/desbloquear.
- `/api/sync-participant-auth-user` agora exige ADM Auth e confere `company_id` do ADM antes de vincular usuario Auth.
- Criadas APIs ADM protegidas:
  - `/api/save-admin-profile`
  - `/api/change-admin-password`
  - `/api/save-results`
  - `/api/save-ranking`
- Login ADM legado removido. ADM e SUPER ADMIN entram apenas por Supabase Auth; o perfil e a role sao carregados por `/api/auth-profile` com JWT.
- Criada API de participante protegida:
  - `/api/complete-participant-password-change`
- Criada API protegida de conferencia:
  - `/api/semifinalists-conference`
- Criado modelo de roles em `public.admins.role`:
  - `super_admin`: escopo global;
  - `admin`: escopo por `company_id`.
- Criado menu desktop "Conferencia Semifinalistas" apenas para ADM/SUPER ADMIN.
- `src/lib/bolaoRepository.js` agora envia token Supabase Auth nas APIs sensiveis.
- Criada migration `supabase/migrations/20260603090000_security_hardening.sql` para:
  - criar `public.audit_logs`;
  - habilitar RLS em `audit_logs`;
  - permitir insert em audit apenas por `service_role`;
  - permitir leitura de audit apenas por ADM da empresa;
  - remover policies anonimas de escrita;
  - revogar grants anonimos/authenticated de escrita em tabelas criticas;
  - revogar execucao por `anon`/`authenticated` de `save_admin_profile`, `change_admin_password` e `authenticate_admin`.
- Criada migration `supabase/migrations/20260604090000_remove_legacy_admin_auth.sql` para dropar os RPCs legados de ADM:
  - `authenticate_admin`;
  - `change_admin_password`;
  - `save_admin_profile`;
  - `get_current_company`;
  - `link_auth_user_by_email`.
- Criados testes de contrato em `tests/test_security_contracts.py`.

## Logs e auditoria

Eventos registrados em `public.audit_logs`:

- `participant_registered`
- `participant_auth_linked`
- `participant_blocked`
- `participant_unblocked`
- `predictions_saved`
- `results_saved`
- `ranking_saved`
- `participant_password_changed`
- `semifinalists_conference_recalculated`
- `admin_login`
- `admin_profile_saved`
- `admin_password_changed`

As APIs tambem mantem logs estruturados no console da Vercel com `requestId`.

## Riscos restantes

- ADM legado via login `adm` foi removido do frontend e da API. Para acessar o painel, o usuario precisa existir em Supabase Auth, estar vinculado a `public.admins.user_id` e entrar por e-mail/senha do Supabase Auth.
- Para SUPER ADMIN funcionar, o usuario precisa existir em Supabase Auth e a linha correspondente em `public.admins` precisa ter `role = 'super_admin'`.
- ADMIN CLIENTE precisa de usuario proprio em Supabase Auth. Nunca compartilhar e-mail/senha do SUPER ADMIN com cliente.
- `save_admin_profile`, `change_admin_password`, `authenticate_admin`, `get_current_company` e `link_auth_user_by_email` nao sao mais chamados pelo frontend. A migration remove os RPCs legados; os fluxos ADM agora passam por Supabase Auth, `/api/auth-profile`, `/api/save-admin-profile`, `/api/change-admin-password` e `/api/admins`.
- `/api/change-admin-password` valida a senha atual no Supabase Auth e altera a senha do usuario Auth, nao `public.admins.password_hash`.
- `/api/admins` permite ao SUPER ADMIN listar, criar/vincular, remover e gerar reset de ADMIN CLIENTE com JWT, `requireSuperAdmin` e audit logs.
- O frontend ainda e responsavel por renderizar/ocultar menus. A protecao real foi movida para backend nas APIs criticas, mas qualquer tela nova precisa seguir o mesmo padrao.
- A migration precisa ser aplicada no Supabase antes do deploy depender dela. Se o deploy for feito antes da migration, APIs que tentam gravar `audit_logs` nao quebram a operacao principal, mas os logs persistentes nao serao gravados.
- Se existirem participantes antigos sem `auth_user_id`, eles precisarao ser vinculados antes de salvar palpites pelo fluxo novo.

## Checklist de testes manuais

### ADM

- Entrar como ADM por e-mail/Supabase Auth.
- Verificar que menu ADM aparece.
- Bloquear um participante.
- Desbloquear o mesmo participante.
- Verificar `public.audit_logs` com `participant_blocked` e `participant_unblocked`.
- Salvar resultados.
- Verificar `public.audit_logs` com `results_saved`.
- Conferir ranking atualizado.

### Participante

- Criar conta pelo celular.
- Confirmar usuario em Authentication -> Users.
- Confirmar `public.participantes.auth_user_id`.
- Entrar por e-mail e senha.
- Salvar palpites antes do horario de jogo.
- Verificar `public.audit_logs` com `predictions_saved`.
- Tentar alterar palpite de outro participante via payload manual: deve retornar 403.
- Tentar salvar palpite apos horario do jogo: deve retornar 403.

### Bloqueio

- Bloquear participante pelo ADM.
- Tentar login do participante bloqueado: deve negar acesso.
- Se o participante ja estiver logado, recarregar a pagina: deve sair/bloquear.

### Recuperacao de senha

- Usar "Esqueci minha senha".
- Receber e abrir link do Supabase Auth.
- Definir nova senha.
- Entrar com a nova senha.

### Mobile

- Criar conta no celular pela URL de producao.
- Confirmar Authentication -> Users.
- Fazer login.
- Abrir Meus Palpites.
- Salvar palpites.

## Testes automatizados

- `npm run check`
- `node --check` nas APIs serverless alteradas
- `npm test`

## Arquivos principais alterados

- `server/security.js`
- `api/save-predictions.js`
- `api/set-participant-access.js`
- `api/sync-participant-auth-user.js`
- `api/register-participant.js`
- `api/save-results.js`
- `api/save-ranking.js`
- `api/save-admin-profile.js`
- `api/change-admin-password.js`
- `api/auth-profile.js`
- `api/admins.js`
- `api/public-company.js`
- `api/complete-participant-password-change.js`
- `api/semifinalists-conference.js`
- `src/lib/bolaoRepository.js`
- `vercel.json`
- `supabase/migrations/20260603090000_security_hardening.sql`
- `supabase/migrations/20260603100000_super_admin_and_admin_client.sql`
- `supabase/migrations/20260604090000_remove_legacy_admin_auth.sql`
- `tests/test_security_contracts.py`
- `tests/test_final_stage_rules_js.py`
- `docs/admin_access_sql.md`
