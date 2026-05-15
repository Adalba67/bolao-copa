# Estrutura da Planilha

O projeto foi desenhado para usar Google Sheets como base de dados, com fallback em CSV local.

## Abas

### Participantes

Colunas:

`id_participante, nome, apelido, data_cadastro, ativo`

### Jogos

Colunas:

`id_jogo, data_hora, fase, grupo, time_casa, time_fora, placar_real_casa, placar_real_fora, status_jogo, eh_jogo_do_brasil`

Use `status_jogo=finalizado` para permitir cálculo de pontos.

Na base local, `jogos_exemplo.csv` contem os 72 jogos da primeira fase separados por grupos A-L. Antes da Copa, os placares ficam vazios e `status_jogo=agendado`.

O arquivo local `selecoes_grupos.csv` traz as 48 selecoes separadas por grupo e posicao.

### Palpites

Colunas:

`id_palpite, id_participante, apelido, id_jogo, time_casa, time_fora, palpite_casa, palpite_fora, pontos_obtidos, criterio_pontuacao`

Os campos `pontos_obtidos` e `criterio_pontuacao` ficam ao lado do palpite para registrar a pontuação calculada quando o resultado do jogo estiver disponível.

### FaseFinal

Colunas:

`id_participante, apelido, palpite_1_lugar, palpite_2_lugar, palpite_3_lugar, palpite_4_lugar, pontos_fase_final`

### ResultadoFinal

Colunas:

`real_1_lugar, real_2_lugar, real_3_lugar, real_4_lugar`

### Ranking

Colunas:

`id_participante, apelido, pontos_jogos, pontos_fase_final, pontos_total, posicao`

### Config

Colunas:

`chave, valor`
