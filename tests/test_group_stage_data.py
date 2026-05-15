import pandas as pd

from src.config.settings import DATA_DIR


def test_primeira_fase_tem_72_jogos():
    jogos = pd.read_csv(DATA_DIR / "jogos_exemplo.csv")
    assert len(jogos) == 72
    assert jogos["id_jogo"].tolist() == list(range(1, 73))


def test_grupos_tem_6_jogos_cada():
    jogos = pd.read_csv(DATA_DIR / "jogos_exemplo.csv")
    contagem = jogos.groupby("grupo")["id_jogo"].count().to_dict()
    assert set(contagem) == set("ABCDEFGHIJKL")
    assert all(total == 6 for total in contagem.values())


def test_jogos_do_brasil_marcados():
    jogos = pd.read_csv(DATA_DIR / "jogos_exemplo.csv")
    jogos_brasil = jogos[jogos["eh_jogo_do_brasil"] == True]  # noqa: E712
    assert jogos_brasil["id_jogo"].tolist() == [7, 29, 49]


def test_selecoes_grupos_tem_48_times():
    selecoes = pd.read_csv(DATA_DIR / "selecoes_grupos.csv")
    assert len(selecoes) == 48
    assert selecoes.groupby("grupo")["selecao"].count().eq(4).all()
