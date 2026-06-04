const crypto = require("crypto");
const {
  assertAdminCompanyAccess,
  auditLog,
  json,
  readJson,
  requireAdmin,
  statusFromError,
  supabaseFetch,
} = require("../security");

function log(requestId, step, details = {}) {
  console.log(`[set-participant-access:${requestId}] ${step}`, details);
}

async function setAccessBlocked(companyId, participantId, accessBlocked) {
  const rows = await supabaseFetch(
    `/rest/v1/participantes?company_id=eq.${encodeURIComponent(companyId)}&id_participante=eq.${encodeURIComponent(participantId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ access_blocked: Boolean(accessBlocked) }),
    }
  );
  return Array.isArray(rows) ? rows[0] : null;
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

  const companyId = String(body.companyId || "").trim();
  const participantId = String(body.participantId || body.participant_id || "").trim();
  const accessBlocked = Boolean(body.accessBlocked);
  log(requestId, "request_received", {
    companyId,
    participantId,
    accessBlocked,
  });

  if (!companyId || !participantId) {
    log(requestId, "invalid_payload", { companyId: Boolean(companyId), participantId: Boolean(participantId) });
    json(response, 400, { error: "Empresa e participante sao obrigatorios." });
    return;
  }

  try {
    const { user, admin } = await requireAdmin(request);
    assertAdminCompanyAccess(admin, companyId);
    const participant = await setAccessBlocked(companyId, participantId, accessBlocked);
    if (!participant) {
      log(requestId, "participant_not_found", { companyId, participantId });
      json(response, 404, { error: "Participante nao encontrado." });
      return;
    }
    log(requestId, "participant_access_updated", {
      companyId,
      participantId,
      accessBlocked: Boolean(participant.access_blocked),
    });
    await auditLog({
      actorUserId: user.id,
      actorRole: admin.role || "admin",
      companyId: admin.company_id,
      participantId,
      action: accessBlocked ? "participant_blocked" : "participant_unblocked",
      details: { requestId, targetCompanyId: companyId },
    });
    json(response, 200, { ok: true, participant });
  } catch (error) {
    log(requestId, "update_failed", { message: error.message, stack: error.stack });
    json(response, statusFromError(error), { error: "Falha ao alterar acesso do participante.", details: error.message, requestId });
  }
};

