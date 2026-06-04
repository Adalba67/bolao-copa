require("dotenv").config({ path: ".env.local" });

function json(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.status(status).json(body);
}

async function readJson(request) {
  return typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
}

function requireEnvironment() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service role nao configurado no ambiente.");
  }
}

async function supabaseFetch(path, options = {}) {
  requireEnvironment();
  const headers = {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const response = await fetch(`${process.env.SUPABASE_URL}${path}`, {
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

function bearerToken(request) {
  const header = request.headers?.authorization || request.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function getAuthUser(request) {
  const token = bearerToken(request);
  if (!token) {
    const error = new Error("Sessao Supabase Auth obrigatoria.");
    error.statusCode = 401;
    throw error;
  }
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.id) {
    const error = new Error("Sessao Supabase Auth invalida ou expirada.");
    error.statusCode = 401;
    throw error;
  }
  return data;
}

async function requireAdmin(request) {
  requireEnvironment();
  const user = await getAuthUser(request);
  const rows = await supabaseFetch(`/rest/v1/admins?user_id=eq.${encodeURIComponent(user.id)}&select=*`);
  const admin = Array.isArray(rows) ? rows[0] : null;
  if (!admin) {
    const error = new Error("Apenas ADM autenticado pode executar esta operacao.");
    error.statusCode = 403;
    throw error;
  }
  admin.role = admin.role || "admin";
  admin.is_super_admin = admin.role === "super_admin";
  return { user, admin };
}

async function requireSuperAdmin(request) {
  const context = await requireAdmin(request);
  if (!context.admin.is_super_admin) {
    const error = new Error("Apenas SUPER ADMIN pode executar esta operacao.");
    error.statusCode = 403;
    throw error;
  }
  return context;
}

function assertAdminCompanyAccess(admin, companyId) {
  if (admin?.is_super_admin) return;
  if (String(admin?.company_id || "") === String(companyId || "")) return;
  const error = new Error("ADM nao pode acessar dados de outra empresa.");
  error.statusCode = 403;
  throw error;
}

async function requireParticipant(request, companyId, participantId) {
  requireEnvironment();
  const user = await getAuthUser(request);
  const rows = await supabaseFetch(
    `/rest/v1/participantes?auth_user_id=eq.${encodeURIComponent(user.id)}&select=*`
  );
  const participant = Array.isArray(rows) ? rows[0] : null;
  if (!participant) {
    const error = new Error("Participante Auth nao vinculado.");
    error.statusCode = 403;
    throw error;
  }
  if (String(participant.company_id) !== String(companyId) || String(participant.id_participante) !== String(participantId)) {
    const error = new Error("Participante nao pode alterar dados de outro usuario ou empresa.");
    error.statusCode = 403;
    throw error;
  }
  if (participant.ativo === false || participant.access_blocked === true) {
    const error = new Error("Participante sem permissao para acessar o sistema.");
    error.statusCode = 403;
    throw error;
  }
  return { user, participant };
}

async function auditLog({ actorUserId = null, actorRole, companyId = null, participantId = null, action, details = {} }) {
  try {
    await supabaseFetch("/rest/v1/audit_logs", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_user_id: actorUserId,
        actor_role: actorRole,
        company_id: companyId,
        id_participante: participantId === null || participantId === undefined || participantId === "" ? null : Number(participantId),
        action,
        details,
      }),
    });
  } catch (error) {
    console.error("[audit-log] failed", { action, message: error.message });
  }
}

function statusFromError(error) {
  return error.statusCode || 500;
}

module.exports = {
  assertAdminCompanyAccess,
  auditLog,
  getAuthUser,
  json,
  readJson,
  requireAdmin,
  requireEnvironment,
  requireParticipant,
  requireSuperAdmin,
  statusFromError,
  supabaseFetch,
};
