const { json, supabaseFetch } = require("../server/security");

function normalizeCompany(admin) {
  return {
    id: admin.company_id,
    name_type: admin.name_type,
    name: admin.name,
    email: admin.email,
    sheet_name: admin.sheet_name,
    spreadsheet_id: admin.spreadsheet_id,
    google_sheet_id: admin.google_sheet_id,
    webhook_url: admin.webhook_url,
    logo_data_url: admin.logo_data_url,
    updated_at: admin.updated_at,
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const requestedUrl = new URL(request.url, "http://localhost");
    const companyId = String(
      requestedUrl.searchParams.get("companyId") ||
        process.env.SUPABASE_PUBLIC_COMPANY_ID ||
        process.env.PUBLIC_COMPANY_ID ||
        ""
    ).trim();
    const query = companyId
      ? `/rest/v1/admins?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`
      : "/rest/v1/admins?select=*&role=neq.super_admin&order=created_at.asc&limit=1";
    const rows = await supabaseFetch(query);
    const company = Array.isArray(rows) ? rows[0] : null;
    if (!company) {
      json(response, 404, { error: "Empresa publica nao configurada." });
      return;
    }
    json(response, 200, { ok: true, company: normalizeCompany(company) });
  } catch (error) {
    json(response, 500, { error: "Falha ao carregar empresa publica.", details: error.message });
  }
};

