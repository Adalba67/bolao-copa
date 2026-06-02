const crypto = require("crypto");
require("dotenv").config({ path: ".env.local" });

function log(requestId, step, details = {}) {
  console.log(`[set-participant-access:${requestId}] ${step}`, details);
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
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });

  if (!companyId || !participantId) {
    log(requestId, "invalid_payload", { companyId: Boolean(companyId), participantId: Boolean(participantId) });
    json(response, 400, { error: "Empresa e participante sao obrigatorios." });
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    log(requestId, "missing_environment");
    json(response, 500, { error: "Controle de acesso nao configurado no ambiente." });
    return;
  }

  try {
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
    json(response, 200, { ok: true, participant });
  } catch (error) {
    log(requestId, "update_failed", { message: error.message, stack: error.stack });
    json(response, 500, { error: "Falha ao alterar acesso do participante.", details: error.message, requestId });
  }
};
