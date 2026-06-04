const crypto = require("crypto");
const {
  auditLog,
  json,
  requireAdmin,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

function realTop4(result) {
  return [
    result?.real_1_lugar || "",
    result?.real_2_lugar || "",
    result?.real_3_lugar || "",
    result?.real_4_lugar || "",
  ];
}

function predictedTop4(prediction) {
  return [
    prediction?.palpite_1_lugar || "",
    prediction?.palpite_2_lugar || "",
    prediction?.palpite_3_lugar || "",
    prediction?.palpite_4_lugar || "",
  ];
}

module.exports = async function handler(request, response) {
  const requestId = crypto.randomBytes(4).toString("hex");
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const { calculateFinalStageDetails, calculateFinalStagePoints, finalResultStatus, teamKey } =
      await import("../src/lib/finalStageRules.mjs");
    const { user, admin } = await requireAdmin(request);
    const resultRows = await supabaseFetch("/rest/v1/resultado_final?select=*&order=id.desc&limit=1");
    const result = Array.isArray(resultRows) ? resultRows[0] : null;
    const status = finalResultStatus(result);
    const companyFilter = admin.is_super_admin ? "" : `company_id=eq.${encodeURIComponent(admin.company_id)}&`;
    const [participants, predictions] = await Promise.all([
      supabaseFetch(`/rest/v1/participantes?${companyFilter}select=*&order=company_id.asc,id_participante.asc`),
      supabaseFetch(`/rest/v1/fase_final?${companyFilter}select=*`),
    ]);
    const predictionsByKey = new Map(
      (Array.isArray(predictions) ? predictions : []).map((prediction) => [
        `${prediction.company_id}:${prediction.id_participante}`,
        prediction,
      ])
    );
    const actualKeys = realTop4(result).map(teamKey).filter(Boolean);
    const rows = (Array.isArray(participants) ? participants : [])
      .filter((participant) => participant.ativo !== false)
      .map((participant) => {
        const prediction = predictionsByKey.get(`${participant.company_id}:${participant.id_participante}`) || {};
        const details = calculateFinalStageDetails(prediction, result || {});
        const hits = details.filter((detail) => actualKeys.includes(teamKey(detail.selecao))).length;
        return {
          company_id: participant.company_id,
          id_participante: String(participant.id_participante),
          nome: [participant.nome, participant.sobrenome].filter(Boolean).join(" ") || participant.apelido || participant.nome,
          email: participant.email || "",
          semifinalistas_escolhidos: predictedTop4(prediction),
          semifinalistas_reais: realTop4(result),
          quantidade_acertos: status === "pendente" ? 0 : hits,
          pontos_obtidos: status === "pendente" ? 0 : calculateFinalStagePoints(prediction, result || {}),
          status,
          detalhes: details,
        };
      });

    await auditLog({
      actorUserId: user.id,
      actorRole: admin.role || "admin",
      companyId: admin.is_super_admin ? null : admin.company_id,
      action: "semifinalists_conference_recalculated",
      details: {
        requestId,
        scope: admin.is_super_admin ? "global" : admin.company_id,
        rowCount: rows.length,
        status,
      },
    });

    json(response, 200, {
      ok: true,
      scope: admin.is_super_admin ? "global" : admin.company_id,
      status,
      rows,
    });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha ao carregar conferencia de semifinalistas.", details: error.message, requestId });
  }
};
