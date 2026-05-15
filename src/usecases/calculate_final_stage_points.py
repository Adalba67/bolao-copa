"""Use case for calculating final stage points."""

import pandas as pd

from src.rules.final_stage_rules import calcular_pontos_fase_final


def calcular_pontos_fase_final_df(fase_final: pd.DataFrame, resultado_final: pd.DataFrame) -> pd.DataFrame:
    resultado = resultado_final.iloc[0]
    top_4_real = [
        resultado["real_1_lugar"],
        resultado["real_2_lugar"],
        resultado["real_3_lugar"],
        resultado["real_4_lugar"],
    ]

    saida = fase_final.copy()
    pontos = []

    for _, linha in saida.iterrows():
        palpites = [
            linha["palpite_1_lugar"],
            linha["palpite_2_lugar"],
            linha["palpite_3_lugar"],
            linha["palpite_4_lugar"],
        ]
        total, _ = calcular_pontos_fase_final(palpites, top_4_real)
        pontos.append(total)

    saida["pontos_fase_final"] = pontos
    return saida
