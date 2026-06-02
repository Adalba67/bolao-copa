from src.rules.final_stage_rules import calcular_pontos_fase_final


def test_selecao_no_top_4():
    pontos, detalhes = calcular_pontos_fase_final(
        ["Brasil", "Alemanha", "Portugal", "Uruguai"],
        ["Franca", "Brasil", "Argentina", "Inglaterra"],
    )
    assert pontos == 10
    assert detalhes[0]["criterio"] == "top_4"


def test_palpite_vazio_na_fase_final_nao_pontua():
    pontos, detalhes = calcular_pontos_fase_final(
        ["", "Brasil", "", ""],
        ["Franca", "Brasil", "Argentina", "Inglaterra"],
    )
    assert pontos == 15
    assert detalhes[0]["pontos"] == 0
    assert detalhes[0]["criterio"] == "fora_top_4"
    assert detalhes[1]["criterio"] == "posicao_exata"


def test_posicao_exata():
    pontos, detalhes = calcular_pontos_fase_final(
        ["Brasil", "Alemanha", "Portugal", "Uruguai"],
        ["Brasil", "Franca", "Argentina", "Inglaterra"],
    )
    assert pontos == 15
    assert detalhes[0]["criterio"] == "posicao_exata"


def test_pontuacao_maxima_60():
    pontos, detalhes = calcular_pontos_fase_final(
        ["Brasil", "Franca", "Argentina", "Inglaterra"],
        ["Brasil", "Franca", "Argentina", "Inglaterra"],
    )
    assert pontos == 60
    assert all(item["criterio"] == "posicao_exata" for item in detalhes)
