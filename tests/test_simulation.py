import pandas as pd

from src.config.settings import DATA_DIR
from src.services.football_api_service import FootballApiService
from src.usecases.apply_match_results import aplicar_resultados


def test_simulacao_gera_um_resultado_por_jogo():
    jogos = pd.read_csv(DATA_DIR / "jogos_exemplo.csv")
    resultados = FootballApiService().simular_resultados_primeira_fase(jogos)
    assert len(resultados) == 72
    assert {resultado["status_jogo"] for resultado in resultados} == {"finalizado"}


def test_aplicar_resultados_atualiza_jogos_sem_mudar_quantidade():
    jogos = pd.read_csv(DATA_DIR / "jogos_exemplo.csv")
    resultados = pd.DataFrame(FootballApiService().simular_resultados_primeira_fase(jogos))
    jogos_atualizados = aplicar_resultados(jogos, resultados)

    assert len(jogos_atualizados) == 72
    assert set(jogos_atualizados["status_jogo"]) == {"finalizado"}
    assert jogos_atualizados["placar_real_casa"].notna().all()
    assert jogos_atualizados["placar_real_fora"].notna().all()
