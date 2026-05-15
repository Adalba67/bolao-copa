"""Mock football results service prepared for a future real API."""

import random

import pandas as pd


class FootballApiService:
    """Provide match results without depending on paid APIs initially."""

    def buscar_resultados_atualizados(self, jogos: pd.DataFrame | None = None) -> list[dict]:
        """Return mocked results in the same shape expected by the application."""
        if jogos is None:
            return [
                {"id_jogo": 1, "placar_real_casa": 2, "placar_real_fora": 0, "status_jogo": "finalizado", "origem": "mock"},
                {"id_jogo": 7, "placar_real_casa": 2, "placar_real_fora": 1, "status_jogo": "finalizado", "origem": "mock"},
            ]
        return self.simular_resultados_primeira_fase(jogos)

    def simular_resultados_primeira_fase(self, jogos: pd.DataFrame, seed: int = 2026) -> list[dict]:
        """Create deterministic fake results for validation before the tournament starts."""
        rng = random.Random(seed)
        resultados = []

        for _, jogo in jogos.sort_values("id_jogo").iterrows():
            placar_casa = self._simular_gols(rng)
            placar_fora = self._simular_gols(rng)
            resultados.append(
                {
                    "id_jogo": int(jogo["id_jogo"]),
                    "placar_real_casa": placar_casa,
                    "placar_real_fora": placar_fora,
                    "status_jogo": "finalizado",
                    "origem": f"simulacao_seed_{seed}",
                }
            )

        return resultados

    @staticmethod
    def _simular_gols(rng: random.Random) -> int:
        """Generate plausible low football scores without external dependencies."""
        return rng.choices([0, 1, 2, 3, 4, 5], weights=[18, 30, 26, 15, 8, 3], k=1)[0]

    def buscar_resultados_api_real(self) -> list[dict]:
        """Future integration point for a real football results API."""
        raise NotImplementedError("Configure FOOTBALL_API_BASE_URL e FOOTBALL_API_KEY antes de usar API real.")
