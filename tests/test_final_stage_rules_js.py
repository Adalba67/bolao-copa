import json
import subprocess


def run_node_rule(prediction, result):
    script = f"""
import {{ calculateFinalStagePoints, finalResultStatus }} from './src/lib/finalStageRules.mjs';
const prediction = {json.dumps(prediction)};
const result = {json.dumps(result)};
console.log(JSON.stringify({{
  points: calculateFinalStagePoints(prediction, result),
  status: finalResultStatus(result),
}}));
"""
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def test_js_semifinalists_all_hits():
    data = run_node_rule(
        {
            "palpite_1_lugar": "Brasil",
            "palpite_2_lugar": "Franca",
            "palpite_3_lugar": "Argentina",
            "palpite_4_lugar": "Inglaterra",
        },
        {
            "real_1_lugar": "Brasil",
            "real_2_lugar": "Franca",
            "real_3_lugar": "Argentina",
            "real_4_lugar": "Inglaterra",
        },
    )
    assert data["points"] == 60
    assert data["status"] == "conferido"


def test_js_semifinalists_partial_hits():
    data = run_node_rule(
        {
            "palpite_1_lugar": "Brasil",
            "palpite_2_lugar": "Alemanha",
            "palpite_3_lugar": "Portugal",
            "palpite_4_lugar": "Uruguai",
        },
        {
            "real_1_lugar": "Franca",
            "real_2_lugar": "Brasil",
            "real_3_lugar": "Argentina",
            "real_4_lugar": "Inglaterra",
        },
    )
    assert data["points"] == 10


def test_js_semifinalists_zero_hits_and_pending_result():
    data = run_node_rule(
        {
            "palpite_1_lugar": "Brasil",
            "palpite_2_lugar": "Franca",
            "palpite_3_lugar": "Argentina",
            "palpite_4_lugar": "Inglaterra",
        },
        {
            "real_1_lugar": "",
            "real_2_lugar": "",
            "real_3_lugar": "",
            "real_4_lugar": "",
        },
    )
    assert data["points"] == 0
    assert data["status"] == "pendente"
