const crypto = require("crypto");
const {
  auditLog,
  getAuthUser,
  json,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

function first(rows) {
  return Array.isArray(rows) ? rows[0] : null;
}

async function findAdmin(userId) {
  return first(await supabaseFetch(`/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}&select=*`));
}

async function findParticipantByAuth(userId) {
  return first(await supabaseFetch(
    `/rest/v1/participantes?auth_user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
  ));
}

function normalizeParticipantProfile(participant) {
  return {
    ...participant,
    id_participante: String(participant.id_participante),
    ativo: participant.ativo === true || String(participant.ativo).toLowerCase() === "true",
    access_blocked:
      participant.access_blocked === true ||
      String(participant.access_blocked).toLowerCase() === "true",
  };
}

module.exports = async function handler(request, response) {
  const requestId = crypto.randomBytes(4).toString("hex");
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const user = await getAuthUser(request);
    const admin = await findAdmin(user.id);
    if (admin) {
      await auditLog({
        actorUserId: user.id,
        actorRole: admin.role || "admin",
        companyId: admin.company_id,
        action: "admin_auth_profile_loaded",
        details: { requestId },
      });
      json(response, 200, { ok: true, type: "admin", profile: { ...admin, role: admin.role || "admin" } });
      return;
    }

    const participantSource = "auth_user_id";
    const participant = await findParticipantByAuth(user.id);

    if (!participant) {
      json(response, 403, { error: "Usuario Auth sem vinculo de ADM ou participante." });
      return;
    }

    const normalizedParticipant = normalizeParticipantProfile(participant);
    console.info("[auth-profile-debug]", {
      requestId,
      participantSource,
      authUserId: user.id,
      participantId: normalizedParticipant.id_participante,
      participantIdType: typeof normalizedParticipant.id_participante,
      companyId: normalizedParticipant.company_id,
      ativo: normalizedParticipant.ativo,
      accessBlocked: normalizedParticipant.access_blocked,
    });
    await auditLog({
      actorUserId: user.id,
      actorRole: "participant",
      companyId: normalizedParticipant.company_id,
      participantId: normalizedParticipant.id_participante,
      action: "participant_auth_profile_loaded",
      details: { requestId },
    });
    json(response, 200, { ok: true, type: "participant", profile: normalizedParticipant });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha ao carregar perfil Auth.", details: error.message, requestId });
  }
};
