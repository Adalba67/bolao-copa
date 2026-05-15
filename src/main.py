"""Command-line entry point for local CSV processing."""

from src.services.sheets_service import SheetsService
from src.usecases.calculate_final_stage_points import calcular_pontos_fase_final_df
from src.usecases.calculate_match_points import calcular_pontos_partidas
from src.usecases.update_ranking import consolidar_ranking


def main() -> None:
    service = SheetsService()
    participantes = service.read_sheet("Participantes")
    jogos = service.read_sheet("Jogos")
    palpites = service.read_sheet("Palpites")
    fase_final = service.read_sheet("FaseFinal")
    resultado_final = service.read_sheet("ResultadoFinal")

    palpites_calculados = calcular_pontos_partidas(jogos, palpites)
    fase_final_calculada = calcular_pontos_fase_final_df(fase_final, resultado_final)
    ranking = consolidar_ranking(participantes, palpites_calculados, fase_final_calculada)

    service.update_sheet("Palpites", palpites_calculados)
    service.update_sheet("FaseFinal", fase_final_calculada)
    service.update_sheet("Ranking", ranking)
    print(ranking.to_string(index=False))


if __name__ == "__main__":
    main()
