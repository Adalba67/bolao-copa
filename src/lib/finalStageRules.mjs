export function teamKey(team) {
  return String(team || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function calculateFinalStageDetails(prediction, result) {
  const actualTop4 = [
    result?.real_1_lugar,
    result?.real_2_lugar,
    result?.real_3_lugar,
    result?.real_4_lugar,
  ];
  const predictedTop4 = [
    prediction?.palpite_1_lugar,
    prediction?.palpite_2_lugar,
    prediction?.palpite_3_lugar,
    prediction?.palpite_4_lugar,
  ];
  const normalizedActual = actualTop4.map(teamKey);

  return predictedTop4.map((team, index) => {
    const normalizedTeam = teamKey(team);
    let points = 0;
    let criterion = "fora_top_4";
    if (normalizedTeam && normalizedActual.includes(normalizedTeam)) {
      points = 10;
      criterion = "top_4";
      if (normalizedActual[index] === normalizedTeam) {
        points += 5;
        criterion = "posicao_exata";
      }
    }
    return {
      selecao: String(team || "").trim(),
      posicao_prevista: index + 1,
      pontos: points,
      criterio: criterion,
    };
  });
}

export function calculateFinalStagePoints(prediction, result) {
  return calculateFinalStageDetails(prediction, result)
    .reduce((total, detail) => total + detail.pontos, 0);
}

export function finalResultStatus(result) {
  const actualTop4 = [
    result?.real_1_lugar,
    result?.real_2_lugar,
    result?.real_3_lugar,
    result?.real_4_lugar,
  ];
  const filled = actualTop4.filter((team) => teamKey(team)).length;
  if (filled === 0) return "pendente";
  if (filled < 4) return "parcial";
  return "conferido";
}
