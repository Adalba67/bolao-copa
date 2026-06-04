const crypto = require("crypto");
const {
  auditLog,
  getAuthUser,
  json,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function first(rows) {
  return Array.isArray(rows) ? rows[0] : null;
}

async function findAdmin(userId) {
  return first(await supabaseFetch(`/rest/v1/admins?user_id=eq.${encodeURIComponent(userId)}&select=*`));
}

async function findParticipantByAuth(userId) {
  return first(await supabaseFetch(`/rest/v1/participantes?auth_user_id=eq.${encodeURIComponent(userId)}&select=*`));
}

async function findParticipantByEmail(email) {
  if (!email) return null;
  return first(await supabaseFetch(`/rest/v1/participantes?email=eq.${encodeURIComponent(email)}&select=*`));
}

async function linkParticipant(participant, user) {
  if (participant.auth_user_id) return participant;
  const rows = await supabaseFetch(
    `/rest/v1/participantes?company_id=eq.${encodeURIComponent(participant.company_id)}&id_participante=eq.${encodeURIComponent(participant.id_participante)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ auth_user_id: user.id, email: normalizeEmail(user.email) }),
    }
  );
  return first(rows) || participant;
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

    let participant = await findParticipantByAuth(user.id);
    if (!participant) {
      participant = await findParticipantByEmail(normalizeEmail(user.email));
      if (participant) participant = await linkParticipant(participant, user);
    }

    if (!participant) {
      json(response, 403, { error: "Usuario Auth sem vinculo de ADM ou participante." });
      return;
    }

    await auditLog({
      actorUserId: user.id,
      actorRole: "participant",
      companyId: participant.company_id,
      participantId: participant.id_participante,
      action: "participant_auth_profile_loaded",
      details: { requestId },
    });
    json(response, 200, { ok: true, type: "participant", profile: participant });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha ao carregar perfil Auth.", details: error.message, requestId });
  }
};

