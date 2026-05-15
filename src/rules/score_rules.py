"""Rules for scoring match predictions."""


def acertou_placar_exato(
    palpite_casa: int,
    palpite_fora: int,
    placar_real_casa: int,
    placar_real_fora: int,
) -> bool:
    """Return True when predicted score equals real score."""
    return palpite_casa == placar_real_casa and palpite_fora == placar_real_fora


def _resultado(casa: int, fora: int) -> str:
    if casa > fora:
        return "casa"
    if fora > casa:
        return "fora"
    return "empate"


def acertou_vencedor_ou_empate(
    palpite_casa: int,
    palpite_fora: int,
    placar_real_casa: int,
    placar_real_fora: int,
) -> bool:
    """Return True when prediction matched winner or draw."""
    return _resultado(palpite_casa, palpite_fora) == _resultado(placar_real_casa, placar_real_fora)


def calcular_pontos_jogo(
    palpite_casa: int,
    palpite_fora: int,
    placar_real_casa: int,
    placar_real_fora: int,
    eh_jogo_do_brasil: bool = False,
) -> tuple[int, str]:
    """Calculate match points and return (points, scoring_criterion)."""
    if acertou_placar_exato(palpite_casa, palpite_fora, placar_real_casa, placar_real_fora):
        return (10, "placar_exato_brasil") if eh_jogo_do_brasil else (5, "placar_exato")

    if acertou_vencedor_ou_empate(palpite_casa, palpite_fora, placar_real_casa, placar_real_fora):
        return (5, "vencedor_brasil") if eh_jogo_do_brasil else (3, "vencedor")

    return 0, "perdeu"
