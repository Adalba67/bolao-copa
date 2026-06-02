const crypto = require("crypto");
require("dotenv").config({ path: ".env.local" });

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function log(requestId, step, details = {}) {
  console.log(`[sync-participant-auth-user:${requestId}] ${step}`, details);
}

function json(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.status(status).json(body);
}

async function readJson(request) {
  return typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
}

async function supabaseFetch(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  delete headers.Expect;
  delete headers.expect;
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.message || data?.error || text || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

function authUserFromPayload(payload) {
  if (!payload) return null;
  if (payload.id && payload.email) return payload;
  if (payload.user?.id) return payload.user;
  if (payload.data?.user?.id) return payload.data.user;
  return null;
}

async function findAuthUserByEmail(email) {
  const targetEmail = email.toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const data = await supabaseFetch(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const users = Array.isArray(data) ? data : data?.users || [];
    const user = users.find((item) => String(item.email || "").toLowerCase() === targetEmail);
    if (user) return user;
    if (users.length < 1000) return null;
  }
  return null;
}

async function createConfirmedAuthUser(email, participant) {
  const password = crypto.randomBytes(24).toString("base64url");
  const payload = await supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: "bolao-copa-2026",
        role: "participant",
        company_id: participant.company_id,
        id_participante: participant.id_participante,
      },
    }),
  });
  return authUserFromPayload(payload);
}

async function getParticipant(companyId, participantId) {
  const rows = await supabaseFetch(
    `/rest/v1/participantes?company_id=eq.${encodeURIComponent(companyId)}&id_participante=eq.${encodeURIComponent(participantId)}&select=*`
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function updateParticipantAuth(companyId, participantId, email, authUserId) {
  const rows = await supabaseFetch(
    `/rest/v1/participantes?company_id=eq.${encodeURIComponent(companyId)}&id_participante=eq.${encodeURIComponent(participantId)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        email,
        auth_user_id: authUserId,
      }),
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
  const email = String(body.email || "").trim().toLowerCase();
  log(requestId, "request_received", {
    companyId,
    participantId,
    email,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });

  if (!companyId || !participantId || !EMAIL_PATTERN.test(email)) {
    log(requestId, "invalid_payload", { companyId: Boolean(companyId), participantId: Boolean(participantId), email });
    json(response, 400, { error: "Empresa, participante e e-mail valido sao obrigatorios." });
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log(requestId, "missing_environment");
    json(response, 500, { error: "Sincronizacao Auth nao configurada no ambiente." });
    return;
  }

  try {
    const participant = await getParticipant(companyId, participantId);
    if (!participant || participant.ativo === false) {
      log(requestId, "participant_not_found", { companyId, participantId });
      json(response, 404, { error: "Participante ativo nao encontrado." });
      return;
    }
    log(requestId, "participant_loaded", {
      companyId: participant.company_id,
      participantId: participant.id_participante,
      currentEmail: participant.email || "",
      currentAuthUserId: participant.auth_user_id || "",
    });

    let authUser = await findAuthUserByEmail(email);
    let created = false;
    log(requestId, "auth_lookup_finished", { found: Boolean(authUser), authUserId: authUser?.id || "" });
    if (!authUser) {
      try {
        authUser = await createConfirmedAuthUser(email, participant);
        if (!authUser?.id) {
          authUser = await findAuthUserByEmail(email);
        }
        if (!authUser?.id) {
          throw new Error("Usuario Auth criado nao foi retornado nem encontrado apos criacao.");
        }
        created = true;
        log(requestId, "auth_user_created", { authUserId: authUser.id });
      } catch (error) {
        log(requestId, "auth_create_failed_retry_lookup", { message: error.message });
        authUser = await findAuthUserByEmail(email);
        if (!authUser) throw error;
        log(requestId, "auth_user_found_after_create_conflict", { authUserId: authUser.id });
      }
    }

    if (!authUser?.id) {
      throw new Error("Usuario Auth sem id para vinculo.");
    }
    const updatedParticipant = await updateParticipantAuth(companyId, participantId, email, authUser.id);
    log(requestId, "participant_linked", {
      participantId,
      email,
      authUserId: authUser.id,
      created,
    });
    json(response, 200, {
      ok: true,
      created,
      auth_user_id: authUser.id,
      participant: updatedParticipant,
    });
  } catch (error) {
    log(requestId, "sync_failed", { message: error.message, stack: error.stack });
    json(response, 500, { error: "Falha ao sincronizar usuario Auth do participante.", details: error.message, requestId });
  }
};
