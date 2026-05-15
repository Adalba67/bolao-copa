"""Use case for calculating points from match predictions."""

import pandas as pd

from src.rules.score_rules import calcular_pontos_jogo


def _as_bool(value: object) -> bool:
    return str(value).strip().lower() in {"true", "1", "sim", "yes"}


def calcular_pontos_partidas(jogos: pd.DataFrame, palpites: pd.DataFrame) -> pd.DataFrame:
    jogos_por_id = jogos.set_index("id_jogo").to_dict("index")
    resultados = palpites.copy()
    pontos = []
    criterios = []

    for _, palpite in resultados.iterrows():
        jogo = jogos_por_id.get(palpite["id_jogo"])
        if not jogo or jogo.get("status_jogo") != "finalizado":
            pontos.append(0)
            criterios.append("jogo_nao_finalizado")
            continue

        ponto, criterio = calcular_pontos_jogo(
            int(palpite["palpite_casa"]),
            int(palpite["palpite_fora"]),
            int(jogo["placar_real_casa"]),
            int(jogo["placar_real_fora"]),
            _as_bool(jogo["eh_jogo_do_brasil"]),
        )
        pontos.append(ponto)
        criterios.append(criterio)

    resultados["pontos_obtidos"] = pontos
    resultados["criterio_pontuacao"] = criterios
    return resultados
