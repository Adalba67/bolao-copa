const crypto = require("crypto");
const {
  auditLog,
  json,
  readJson,
  requireAdmin,
  requireEnvironment,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

async function verifyCurrentPassword(email, password) {
  requireEnvironment();
  if (!process.env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_ANON_KEY nao configurada no backend para validar senha atual.");
  }
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    const error = new Error(data?.error_description || data?.msg || "Senha atual invalida.");
    error.statusCode = 403;
    throw error;
  }
}

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

  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!currentPassword || newPassword.length < 6) {
    json(response, 400, { error: "Senha atual e nova senha com pelo menos 6 caracteres sao obrigatorias." });
    return;
  }

  try {
    const { user, admin } = await requireAdmin(request);
    if (!user.email) {
      json(response, 400, { error: "Usuario Auth sem e-mail." });
      return;
    }
    await verifyCurrentPassword(user.email, currentPassword);
    await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PUT",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ password: newPassword }),
    });
    await auditLog({
      actorUserId: user.id,
      actorRole: admin.role || "admin",
      companyId: admin.company_id,
      action: "admin_password_changed",
      details: { requestId, role: admin.role || "admin" },
    });
    json(response, 200, { ok: true });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha ao alterar senha ADM.", details: error.message, requestId });
  }
};
