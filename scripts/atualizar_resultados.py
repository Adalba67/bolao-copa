"""Generate simulated match results and store them locally."""

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pandas as pd  # noqa: E402

from src.config.settings import DATA_DIR  # noqa: E402
from src.services.football_api_service import FootballApiService  # noqa: E402
from src.usecases.apply_match_results import aplicar_resultados  # noqa: E402


def main() -> None:
    jogos_path = DATA_DIR / "jogos_exemplo.csv"
    resultados_path = DATA_DIR / "resultados_simulados.csv"
    jogos_simulados_path = DATA_DIR / "jogos_simulados.csv"

    jogos = pd.read_csv(jogos_path)
    service = FootballApiService()
    resultados = pd.DataFrame(service.simular_resultados_primeira_fase(jogos))
    jogos_simulados = aplicar_resultados(jogos, resultados)

    resultados.to_csv(resultados_path, index=False)
    jogos_simulados.to_csv(jogos_simulados_path, index=False)

    print(f"Resultados simulados salvos em: {resultados_path}")
    print(f"Jogos com placares simulados salvos em: {jogos_simulados_path}")


if __name__ == "__main__":
    main()
