"""Rules for scoring final stage predictions."""


def calcular_pontos_fase_final(palpites: list[str], resultado_real: list[str]) -> tuple[int, list[dict]]:
    """Calculate final stage points.

    Each team in the real top 4 scores 10 points. Exact position adds 5 points.
    Maximum score: 60 points.
    """
    total = 0
    detalhes = []
    resultado_normalizado = [time.strip().lower() for time in resultado_real]

    for indice, selecao in enumerate(palpites):
        nome = selecao.strip()
        nome_normalizado = nome.lower()
        pontos = 0
        criterio = "fora_top_4"

        if nome_normalizado in resultado_normalizado:
            pontos = 10
            criterio = "top_4"
            if indice < len(resultado_real) and nome_normalizado == resultado_normalizado[indice]:
                pontos += 5
                criterio = "posicao_exata"

        total += pontos
        detalhes.append(
            {
                "selecao": nome,
                "posicao_prevista": indice + 1,
                "pontos": pontos,
                "criterio": criterio,
            }
        )

    return total, detalhes
