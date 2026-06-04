const crypto = require("crypto");
const {
  auditLog,
  json,
  readJson,
  requireParticipant,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

function log(requestId, step, details = {}) {
  console.log(`[save-predictions:${requestId}] ${step}`, details);
}

function predictionPayload(prediction, participant) {
  return {
    id_palpite: prediction.id_palpite ? Number(prediction.id_palpite) : null,
    company_id: participant.company_id,
    company_name: participant.company_name,
    id_participante: Number(participant.id_participante),
    apelido: prediction.apelido,
    id_jogo: Number(prediction.id_jogo),
    time_casa: prediction.time_casa,
    time_fora: prediction.time_fora,
    palpite_casa: Number(prediction.palpite_casa),
    palpite_fora: Number(prediction.palpite_fora),
    pontos_obtidos: Number(prediction.pontos_obtidos || 0),
    criterio_pontuacao: prediction.criterio_pontuacao || "",
  };
}

function finalPredictionPayload(prediction, participant) {
  return {
    company_id: participant.company_id,
    company_name: participant.company_name,
    id_participante: Number(participant.id_participante),
    apelido: prediction.apelido,
    palpite_1_lugar: prediction.palpite_1_lugar || "",
    palpite_2_lugar: prediction.palpite_2_lugar || "",
    palpite_3_lugar: prediction.palpite_3_lugar || "",
    palpite_4_lugar: prediction.palpite_4_lugar || "",
    pontos_fase_final: Number(prediction.pontos_fase_final || 0),
  };
}

function officialMatchDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const normalized = text.replace(" ", "T");
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasTimezone ? normalized : `${normalized}-03:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchStillOpen(game) {
  const matchDate = officialMatchDate(game?.data_hora);
  return Boolean(matchDate && Date.now() < matchDate.getTime());
}

function finalStageStillOpen() {
  return Date.now() < new Date("2026-06-11T00:00:00-03:00").getTime();
}

async function getGames(gameIds) {
  const ids = [...new Set(gameIds.map((id) => Number(id)).filter(Number.isFinite))];
  if (!ids.length) return [];
  return supabaseFetch(`/rest/v1/jogos?id_jogo=in.(${ids.join(",")})&select=id_jogo,data_hora,time_casa,time_fora`);
}

async function upsertMatchPredictions(predictions) {
  return supabaseFetch("/rest/v1/palpites?on_conflict=company_id,id_participante,id_jogo&select=*", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(predictions),
  });
}

async function upsertFinalPrediction(prediction) {
  return supabaseFetch("/rest/v1/fase_final?on_conflict=company_id,id_participante&select=*", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(prediction),
  });
}

module.exports = async function handler(request, response) {
  const requestId = crypto.randomBytes(4).toString("hex");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    log(requestId, "method_not_allowed", { method: request.method });
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    log(requestId, "invalid_json");
    json(response, 400, { error: "JSON invalido." });
    return;
  }

  const matchPredictions = Array.isArray(body.matchPredictions) ? body.matchPredictions : [];
  const finalPrediction = body.finalPrediction || null;
  const participantId = String(finalPrediction?.id_participante || matchPredictions[0]?.id_participante || "").trim();
  const companyId = String(finalPrediction?.company_id || matchPredictions[0]?.company_id || "").trim();
  const participantIds = new Set(matchPredictions.map((prediction) => String(prediction.id_participante)));
  if (finalPrediction?.id_participante) participantIds.add(String(finalPrediction.id_participante));

    log(requestId, "request_received", {
      companyId,
      participantId,
      matchPredictionCount: matchPredictions.length,
      hasFinalPrediction: Boolean(finalPrediction),
      samplePrediction: matchPredictions[0]
        ? {
            id_jogo: matchPredictions[0].id_jogo,
            palpite_casa: matchPredictions[0].palpite_casa,
            palpite_fora: matchPredictions[0].palpite_fora,
          }
        : null,
    });

  if (!companyId || !participantId || !matchPredictions.length || !finalPrediction || participantIds.size !== 1) {
    log(requestId, "invalid_payload", { companyId: Boolean(companyId), participantId: Boolean(participantId), participantIds: [...participantIds] });
    json(response, 400, { error: "Empresa, participante, palpites de jogos e fase final sao obrigatorios." });
    return;
  }
  const gameIds = matchPredictions.map((prediction) => String(prediction.id_jogo));
  if (new Set(gameIds).size !== gameIds.length) {
    json(response, 400, { error: "Payload contem palpites duplicados para o mesmo jogo." });
    return;
  }
  const invalidScore = matchPredictions.find((prediction) =>
    !Number.isFinite(Number(prediction.id_jogo)) ||
    !Number.isFinite(Number(prediction.palpite_casa)) ||
    !Number.isFinite(Number(prediction.palpite_fora)) ||
    Number(prediction.palpite_casa) < 0 ||
    Number(prediction.palpite_fora) < 0
  );
  if (invalidScore) {
    json(response, 400, { error: "Palpites devem ter jogo e placares numericos nao negativos." });
    return;
  }

  try {
    const { user, participant } = await requireParticipant(request, companyId, participantId);
    if (!finalStageStillOpen()) {
      json(response, 403, { error: "Palpite da fase final bloqueado apos o prazo limite." });
      return;
    }

    const games = await getGames(matchPredictions.map((prediction) => prediction.id_jogo));
    const gamesById = new Map(games.map((game) => [String(game.id_jogo), game]));
    const lockedGames = matchPredictions
      .map((prediction) => gamesById.get(String(prediction.id_jogo)))
      .filter((game) => !matchStillOpen(game))
      .map((game) => game ? `Jogo ${game.id_jogo}` : "Jogo invalido");

    if (lockedGames.length) {
      log(requestId, "locked_games_rejected", { lockedGames });
      json(response, 403, {
        error: `Palpite bloqueado: ${lockedGames.join(", ")} ja passou do horario oficial da partida.`,
      });
      return;
    }

    const matchPayload = matchPredictions.map((prediction) => predictionPayload(prediction, participant));
    const finalPayload = finalPredictionPayload(finalPrediction, participant);
    log(requestId, "payload_ready", {
      participantId,
      companyId,
      games: matchPayload.map((prediction) => ({
        id_jogo: prediction.id_jogo,
        palpite_casa: prediction.palpite_casa,
        palpite_fora: prediction.palpite_fora,
      })),
    });
    const savedMatchPredictions = await upsertMatchPredictions(matchPayload);
    const savedFinalPredictions = await upsertFinalPrediction(finalPayload);
    await auditLog({
      actorUserId: user.id,
      actorRole: "participant",
      companyId: participant.company_id,
      participantId: participant.id_participante,
      action: "predictions_saved",
      details: {
        requestId,
        matchPredictionCount: matchPayload.length,
        gameIds: matchPayload.map((prediction) => prediction.id_jogo),
        hasFinalPrediction: Boolean(finalPayload),
      },
    });
    log(requestId, "predictions_saved", {
      participantId,
      matchPredictionCount: Array.isArray(savedMatchPredictions) ? savedMatchPredictions.length : 0,
    });
    json(response, 200, {
      ok: true,
      matchPredictions: Array.isArray(savedMatchPredictions) ? savedMatchPredictions : [],
      finalPrediction: Array.isArray(savedFinalPredictions) ? savedFinalPredictions[0] : null,
    });
  } catch (error) {
    log(requestId, "save_failed", { message: error.message, stack: error.stack });
    json(response, statusFromError(error), { error: "Falha ao salvar palpites.", details: error.message, requestId });
  }
};
