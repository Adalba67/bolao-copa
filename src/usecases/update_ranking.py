"""Use case for consolidating the ranking."""

import pandas as pd


def consolidar_ranking(participantes: pd.DataFrame, palpites: pd.DataFrame, fase_final: pd.DataFrame) -> pd.DataFrame:
    pontos_jogos = (
        palpites.groupby("id_participante", as_index=False)["pontos_obtidos"]
        .sum()
        .rename(columns={"pontos_obtidos": "pontos_jogos"})
    )
    pontos_fase = fase_final[["id_participante", "pontos_fase_final"]].copy()

    ranking = participantes[participantes["ativo"] == True][["id_participante", "apelido"]].copy()  # noqa: E712
    ranking = ranking.merge(pontos_jogos, on="id_participante", how="left")
    ranking = ranking.merge(pontos_fase, on="id_participante", how="left")
    ranking[["pontos_jogos", "pontos_fase_final"]] = ranking[["pontos_jogos", "pontos_fase_final"]].fillna(0)
    ranking["pontos_total"] = ranking["pontos_jogos"] + ranking["pontos_fase_final"]
    ranking = ranking.sort_values(["pontos_total", "pontos_jogos", "apelido"], ascending=[False, False, True])
    ranking["posicao"] = range(1, len(ranking) + 1)
    return ranking[["id_participante", "apelido", "pontos_jogos", "pontos_fase_final", "pontos_total", "posicao"]]
