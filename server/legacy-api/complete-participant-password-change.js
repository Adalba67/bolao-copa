const crypto = require("crypto");
const {
  auditLog,
  json,
  readJson,
  requireParticipant,
  statusFromError,
  supabaseFetch,
} = require("../security");

module.exports = async function handler(request, response) {
  const requestId = crypto.randomBytes(4).toString("hex");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    json(response, 400, { error: "JSON invalido." });
    return;
  }

  const companyId = String(body.companyId || "").trim();
  const participantId = String(body.participantId || body.participant_id || "").trim();
  if (!companyId || !participantId) {
    json(response, 400, { error: "Empresa e participante sao obrigatorios." });
    return;
  }

  try {
    const { user, participant } = await requireParticipant(request, companyId, participantId);
    const rows = await supabaseFetch(
      `/rest/v1/participantes?company_id=eq.${encodeURIComponent(companyId)}&id_participante=eq.${encodeURIComponent(participantId)}&select=*`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          password_token: null,
          must_change_password: false,
        }),
      }
    );
    const updatedParticipant = Array.isArray(rows) ? rows[0] : null;
    await auditLog({
      actorUserId: user.id,
      actorRole: "participant",
      companyId: participant.company_id,
      participantId: participant.id_participante,
      action: "participant_password_changed",
      details: { requestId },
    });
    json(response, 200, { ok: true, participant: updatedParticipant });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha ao concluir troca de senha.", details: error.message, requestId });
  }
};

