# Resultados e Simulacoes

O projeto deve continuar autocontido em Python. Nao usar N8N neste momento.

## Antes da Copa comecar

Use simulacao local:

```powershell
python scripts\atualizar_resultados.py
python scripts\calcular_pontos.py --simulado
```

Arquivos gerados:

- `src/data/resultados_simulados.csv`
- `src/data/jogos_simulados.csv`

## Quando a Copa comecar

Ha duas opcoes simples:

1. Preencher manualmente os placares em uma copia de `jogos_exemplo.csv`.
2. Conectar uma API real em `src/services/football_api_service.py`.

Formato esperado para cada resultado:

```python
{
    "id_jogo": 1,
    "placar_real_casa": 2,
    "placar_real_fora": 0,
    "status_jogo": "finalizado",
    "origem": "api_real"
}
```

## Regra de armazenamento

Manter a tabela oficial `jogos_exemplo.csv` como agenda base.

Guardar resultados calculados, simulados ou importados em arquivos separados. Isso evita misturar dados ficticios com dados reais.
