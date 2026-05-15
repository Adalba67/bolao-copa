"""Apply stored or simulated match results to the fixtures table."""

import pandas as pd


def aplicar_resultados(jogos: pd.DataFrame, resultados: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of jogos with result columns updated from resultados."""
    jogos_atualizados = jogos.copy()
    resultados_por_id = resultados.set_index("id_jogo").to_dict("index")

    for indice, jogo in jogos_atualizados.iterrows():
        resultado = resultados_por_id.get(jogo["id_jogo"])
        if not resultado:
            continue
        jogos_atualizados.at[indice, "placar_real_casa"] = int(resultado["placar_real_casa"])
        jogos_atualizados.at[indice, "placar_real_fora"] = int(resultado["placar_real_fora"])
        jogos_atualizados.at[indice, "status_jogo"] = resultado.get("status_jogo", "finalizado")

    return jogos_atualizados
