"""Calculate match and final stage points using configured data source."""

from pathlib import Path
import sys
import argparse

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from src.main import main  # noqa: E402
from src.config.settings import DATA_DIR  # noqa: E402
from src.services.sheets_service import SheetsService  # noqa: E402
from src.usecases.calculate_final_stage_points import calcular_pontos_fase_final_df  # noqa: E402
from src.usecases.calculate_match_points import calcular_pontos_partidas  # noqa: E402
from src.usecases.update_ranking import consolidar_ranking  # noqa: E402


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--simulado", action="store_true", help="calcula usando src/data/jogos_simulados.csv")
    args = parser.parse_args()

    if not args.simulado:
        main()
    else:
        service = SheetsService()
        jogos_simulados = DATA_DIR / "jogos_simulados.csv"
        if not jogos_simulados.exists():
            raise SystemExit("Gere a simulacao antes: python scripts\\atualizar_resultados.py")

        participantes = service.read_sheet("Participantes")
        jogos = pd.read_csv(jogos_simulados)
        palpites = service.read_sheet("Palpites")
        fase_final = service.read_sheet("FaseFinal")
        resultado_final = service.read_sheet("ResultadoFinal")

        palpites_calculados = calcular_pontos_partidas(jogos, palpites)
        fase_final_calculada = calcular_pontos_fase_final_df(fase_final, resultado_final)
        ranking = consolidar_ranking(participantes, palpites_calculados, fase_final_calculada)

        print(ranking.to_string(index=False))
