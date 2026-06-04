const crypto = require("crypto");
const {
  auditLog,
  json,
  readJson,
  requireAdmin,
  statusFromError,
  supabaseFetch,
} = require("../security");

function clean(value) {
  return String(value || "").trim();
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

  try {
    const { user, admin } = await requireAdmin(request);
    const profile = body.profile || {};
    const requestedCompanyId = clean(profile.id || profile.company_id);
    const name = clean(profile.name);
    const email = clean(profile.email).toLowerCase();
    if (!name || !email || !requestedCompanyId) {
      json(response, 400, { error: "Nome, e-mail e company_id sao obrigatorios." });
      return;
    }
    if (!admin.is_super_admin && requestedCompanyId !== admin.company_id) {
      json(response, 403, { error: "ADMIN CLIENTE nao pode alterar company_id." });
      return;
    }

    const payload = {
      company_id: requestedCompanyId,
      name_type: clean(profile.name_type),
      name,
      email,
      sheet_name: clean(profile.sheet_name) || name,
      spreadsheet_id: clean(profile.spreadsheet_id),
      google_sheet_id: clean(profile.googleSheetId || profile.google_sheet_id),
      webhook_url: clean(profile.webhook_url),
      logo_data_url: clean(profile.logo_data_url),
      updated_at: new Date().toISOString(),
    };

    const rows = await supabaseFetch(`/rest/v1/admins?user_id=eq.${encodeURIComponent(user.id)}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    const updatedAdmin = Array.isArray(rows) ? rows[0] : null;
    if (!updatedAdmin) {
      json(response, 404, { error: "ADM autenticado nao encontrado." });
      return;
    }

    await auditLog({
      actorUserId: user.id,
      actorRole: admin.role || "admin",
      companyId: updatedAdmin.company_id,
      action: "admin_profile_saved",
      details: {
        requestId,
        role: updatedAdmin.role || "admin",
        changedCompanyId: admin.company_id !== updatedAdmin.company_id,
      },
    });

    json(response, 200, { ok: true, admin: updatedAdmin });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha ao salvar Cadastro ADM.", details: error.message, requestId });
  }
};

