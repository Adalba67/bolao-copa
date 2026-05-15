from src.rules.score_rules import acertou_placar_exato, acertou_vencedor_ou_empate, calcular_pontos_jogo


def test_jogo_normal_acerta_vencedor():
    pontos, criterio = calcular_pontos_jogo(2, 1, 3, 0)
    assert pontos == 3
    assert criterio == "vencedor"


def test_empate():
    pontos, criterio = calcular_pontos_jogo(1, 1, 2, 2)
    assert pontos == 3
    assert criterio == "vencedor"
    assert acertou_vencedor_ou_empate(1, 1, 2, 2)


def test_placar_exato_substitui_pontuacao_simples():
    pontos, criterio = calcular_pontos_jogo(2, 0, 2, 0)
    assert pontos == 5
    assert criterio == "placar_exato"
    assert acertou_placar_exato(2, 0, 2, 0)


def test_jogo_do_brasil():
    pontos_simples, criterio_simples = calcular_pontos_jogo(1, 0, 2, 0, eh_jogo_do_brasil=True)
    pontos_exato, criterio_exato = calcular_pontos_jogo(2, 0, 2, 0, eh_jogo_do_brasil=True)

    assert pontos_simples == 5
    assert criterio_simples == "vencedor_brasil"
    assert pontos_exato == 10
    assert criterio_exato == "placar_exato_brasil"


def test_palpite_errado_marca_perdeu():
    pontos, criterio = calcular_pontos_jogo(0, 1, 2, 0)
    assert pontos == 0
    assert criterio == "perdeu"
