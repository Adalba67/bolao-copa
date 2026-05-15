# Prompt Bolão Copa

Quero que você atue como um engenheiro de software sênior e crie um projeto Python completo chamado bolao-copa.

O projeto será usado para administrar um bolão da Copa do Mundo para aproximadamente 50 participantes.

O objetivo é usar:

- Python como motor de cálculo
- Google Sheets como base de dados
- integração futura com API de resultados
- possibilidade futura de automação com N8N

## Regras dos Jogos

Jogos normais:

1. Acertou empate = 3 pontos
2. Acertou quem ganhou = 3 pontos
3. Acertou vencedor/empate e placar exato = 5 pontos

Se acertar placar exato, não soma com os 3 pontos. O placar exato substitui a pontuação simples.

Jogos do Brasil:

1. Acertou vencedor ou empate = 5 pontos
2. Acertou vencedor/empate e placar exato = 10 pontos

Se acertar placar exato em jogo do Brasil, não soma 5 + 10. Recebe apenas 10 pontos.

## Regras da Fase Final

O apostador deve informar 4 seleções em ordem final prevista:

1. Campeão
2. Vice-campeão
3. Terceiro lugar
4. Quarto lugar

Pontuação:

- Se a seleção terminou entre as 4 melhores da Copa = 10 pontos
- Se além disso terminou exatamente na posição prevista = +5 pontos

Pontuação máxima da fase final: 60 pontos.

## Abas do Google Sheets

- Participantes
- Jogos
- Palpites
- FaseFinal
- ResultadoFinal
- Ranking
- Config

## Requisitos

Use Python. Código limpo. Separar regras em arquivos próprios. Adicionar comentários objetivos. Criar dados fictícios de exemplo. Não usar banco de dados agora. Não criar sistema web agora. Foco em custo baixo e simplicidade para 50 participantes.
