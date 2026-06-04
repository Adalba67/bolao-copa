const crypto = require("crypto");
const {
  auditLog,
  json,
  readJson,
  requireSuperAdmin,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function authUserFromPayload(payload) {
  if (!payload) return null;
  if (payload.id && payload.email) return payload;
  if (payload.user?.id) return payload.user;
  if (payload.data?.user?.id) return payload.data.user;
  return null;
}

async function findAuthUserByEmail(email) {
  const targetEmail = normalizeEmail(email);
  for (let page = 1; page <= 20; page += 1) {
    const data = await supabaseFetch(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const users = Array.isArray(data) ? data : data?.users || [];
    const user = users.find((item) => normalizeEmail(item.email) === targetEmail);
    if (user) return user;
    if (users.length < 1000) return null;
  }
  return null;
}

async function ensureAuthUser({ email, password, companyId, name }) {
  let authUser = await findAuthUserByEmail(email);
  let created = false;
  if (authUser?.id) return { authUser, created };

  const payload = await supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: password || crypto.randomBytes(24).toString("base64url"),
      email_confirm: true,
      user_metadata: {
        source: "bolao-copa-2026",
        role: "admin",
        company_id: companyId,
        name,
      },
    }),
  });
  authUser = authUserFromPayload(payload) || await findAuthUserByEmail(email);
  if (!authUser?.id) throw new Error("Usuario Auth do ADMIN CLIENTE nao foi retornado.");
  created = true;
  return { authUser, created };
}

async function upsertAdmin({ authUserId, companyId, email, name, nameType }) {
  const payload = {
    user_id: authUserId,
    company_id: companyId,
    login: `admin-${companyId}`,
    email,
    name,
    name_type: nameType || "Pessoa juridica",
    sheet_name: name,
    role: "admin",
    updated_at: new Date().toISOString(),
  };
  const existing = await supabaseFetch(
    `/rest/v1/admins?role=eq.admin&company_id=eq.${encodeURIComponent(companyId)}&email=eq.${encodeURIComponent(email)}&select=id`
  );
  if (Array.isArray(existing) && existing[0]?.id) {
    const rows = await supabaseFetch(`/rest/v1/admins?id=eq.${encodeURIComponent(existing[0].id)}&select=*`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return Array.isArray(rows) ? rows[0] : null;
  }

  const rows = await supabaseFetch("/rest/v1/admins?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] : null;
}

async function listAdmins() {
  const rows = await supabaseFetch("/rest/v1/admins?select=*&order=role.desc,company_id.asc,email.asc");
  return Array.isArray(rows) ? rows : [];
}

async function generateRecoveryLink(email) {
  const redirectTo = process.env.SUPABASE_AUTH_REDIRECT_URL || process.env.PUBLIC_SITE_URL || undefined;
  const body = { type: "recovery", email };
  if (redirectTo) body.redirect_to = redirectTo;
  return supabaseFetch("/auth/v1/admin/generate_link", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

module.exports = async function handler(request, response) {
  const requestId = crypto.randomBytes(4).toString("hex");

  try {
    const { user, admin } = await requireSuperAdmin(request);

    if (request.method === "GET") {
      const admins = await listAdmins();
      json(response, 200, { ok: true, admins });
      return;
    }

    if (request.method === "POST") {
      const body = await readJson(request);
      const action = clean(body.action || "upsert");
      const email = normalizeEmail(body.email);
      const companyId = clean(body.companyId || body.company_id);
      const name = clean(body.name);
      const nameType = clean(body.nameType || body.name_type);

      if (action === "reset") {
        if (!EMAIL_PATTERN.test(email)) {
          json(response, 400, { error: "E-mail valido e obrigatorio para reset." });
          return;
        }
        const recovery = await generateRecoveryLink(email);
        await auditLog({
          actorUserId: user.id,
          actorRole: admin.role || "super_admin",
          companyId,
          action: "admin_client_access_reset",
          details: { requestId, email },
        });
        json(response, 200, { ok: true, recovery });
        return;
      }

      if (!companyId || !name || !EMAIL_PATTERN.test(email)) {
        json(response, 400, { error: "company_id, nome e e-mail valido sao obrigatorios." });
        return;
      }

      const { authUser, created } = await ensureAuthUser({
        email,
        password: body.password ? String(body.password) : "",
        companyId,
        name,
      });
      const adminClient = await upsertAdmin({
        authUserId: authUser.id,
        companyId,
        email,
        name,
        nameType,
      });
      await auditLog({
        actorUserId: user.id,
        actorRole: admin.role || "super_admin",
        companyId,
        action: created ? "admin_client_created" : "admin_client_linked",
        details: { requestId, email, authUserId: authUser.id },
      });
      json(response, 200, { ok: true, created, admin: adminClient });
      return;
    }

    if (request.method === "DELETE") {
      const body = await readJson(request);
      const email = normalizeEmail(body.email);
      const companyId = clean(body.companyId || body.company_id);
      if (!companyId || !EMAIL_PATTERN.test(email)) {
        json(response, 400, { error: "company_id e e-mail valido sao obrigatorios." });
        return;
      }
      const removed = await supabaseFetch(
        `/rest/v1/admins?role=eq.admin&company_id=eq.${encodeURIComponent(companyId)}&email=eq.${encodeURIComponent(email)}&select=*`,
        {
          method: "DELETE",
          headers: { Prefer: "return=representation" },
        }
      );
      await auditLog({
        actorUserId: user.id,
        actorRole: admin.role || "super_admin",
        companyId,
        action: "admin_client_removed",
        details: { requestId, email, removedCount: Array.isArray(removed) ? removed.length : 0 },
      });
      json(response, 200, { ok: true, removed });
      return;
    }

    response.setHeader("Allow", "GET, POST, DELETE");
    json(response, 405, { error: "Method not allowed" });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha na gestao de ADM cliente.", details: error.message, requestId });
  }
};
