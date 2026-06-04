const crypto = require("crypto");
require("dotenv").config({ path: ".env.local" });
const { auditLog } = require("../security");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.status(status).json(body);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function asString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeParticipant(participant) {
  return {
    ...participant,
    id_participante: asString(participant.id_participante),
    ativo: participant.ativo === true || participant.ativo === "True" ? "True" : "False",
    access_blocked: participant.access_blocked === true || String(participant.access_blocked).toLowerCase() === "true",
  };
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

async function createConfirmedAuthUser({ email, password, companyId, participantId }) {
  const payload = await supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        source: "bolao-copa-2026",
        role: "participant",
        company_id: companyId,
        id_participante: participantId,
      },
    }),
  });
  return authUserFromPayload(payload);
}

async function ensureAuthUser({ email, password, companyId, participantId }) {
  let authUser = await findAuthUserByEmail(email);
  let created = false;
  if (authUser) return { authUser, created };

  try {
    authUser = await createConfirmedAuthUser({ email, password, companyId, participantId });
    if (!authUser?.id) authUser = await findAuthUserByEmail(email);
    if (!authUser?.id) throw new Error("Usuario Auth criado nao foi retornado.");
    created = true;
  } catch (error) {
    authUser = await findAuthUserByEmail(email);
    if (!authUser) throw error;
  }

  return { authUser, created };
}

async function getCompany(companyId) {
  const rows = await supabaseFetch(
    `/rest/v1/admins?company_id=eq.${encodeURIComponent(companyId)}&select=company_id,name`
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function getCompanyParticipants(companyId) {
  const rows = await supabaseFetch(
    `/rest/v1/participantes?company_id=eq.${encodeURIComponent(companyId)}&select=*&order=id_participante.asc`
  );
  return Array.isArray(rows) ? rows : [];
}

function participantByEmail(participants, email) {
  const targetEmail = normalizeEmail(email);
  return participants.find((participant) => normalizeEmail(participant.email) === targetEmail) || null;
}

function participantByLogin(participants, login) {
  return participants.find((participant) => String(participant.login || "") === login) || null;
}

async function updateParticipant(participant, changes) {
  const rows = await supabaseFetch(
    `/rest/v1/participantes?company_id=eq.${encodeURIComponent(participant.company_id)}&id_participante=eq.${encodeURIComponent(participant.id_participante)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(changes),
    }
  );
  return Array.isArray(rows) ? rows[0] : null;
}

async function createParticipant(payload) {
  const rows = await supabaseFetch("/rest/v1/participantes?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) ? rows[0] : null;
}

module.exports = async function handler(request, response) {
  const requestId = crypto.randomBytes(4).toString("hex");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    json(response, 405, { error: "Method not allowed" });
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    json(response, 500, { error: "Cadastro Auth nao configurado no ambiente." });
    return;
  }

  let body;
  try {
    body = await readJson(request);
  } catch {
    json(response, 400, { error: "JSON invalido." });
    return;
  }

  const companyId = String(body.companyId || "").trim();
  const firstName = String(body.firstName || "").trim();
  const lastName = String(body.lastName || "").trim();
  const phone = String(body.phone || "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const login = String(body.login || "").trim();

  if (!companyId || !firstName || !lastName || !phone || !login || !EMAIL_PATTERN.test(email)) {
    json(response, 400, { error: "Empresa, nome, sobrenome, telefone, login e e-mail valido sao obrigatorios." });
    return;
  }
  if (password.length < 6) {
    json(response, 400, { error: "Informe uma senha com pelo menos 6 caracteres." });
    return;
  }

  try {
    const company = await getCompany(companyId);
    if (!company) {
      json(response, 404, { error: "Empresa nao encontrada para cadastro." });
      return;
    }

    const participants = await getCompanyParticipants(companyId);
    const existingByEmail = participantByEmail(participants, email);
    const existingByLogin = participantByLogin(participants, login);
    if (existingByLogin && (!existingByEmail || existingByLogin.id_participante !== existingByEmail.id_participante)) {
      json(response, 409, { error: `Login ${login} ja cadastrado. Ajuste o telefone ou nome.` });
      return;
    }

    const participantId = existingByEmail
      ? Number(existingByEmail.id_participante)
      : Math.max(0, ...participants.map((participant) => Number(participant.id_participante) || 0)) + 1;
    const { authUser, created } = await ensureAuthUser({ email, password, companyId, participantId });
    if (!authUser?.id) {
      throw new Error("Nao foi possivel obter o usuario Supabase Auth para vinculo.");
    }

    const participantPayload = {
      company_id: company.company_id,
      company_name: company.name,
      id_participante: participantId,
      nome: firstName,
      sobrenome: lastName,
      telefone: phone,
      email,
      auth_user_id: authUser.id,
      login,
      password_token: null,
      must_change_password: false,
      apelido: `${firstName} ${lastName}`,
      data_cadastro: new Date().toISOString().slice(0, 10),
      ativo: true,
      access_blocked: false,
    };

    const participant = existingByEmail
      ? await updateParticipant(existingByEmail, participantPayload)
      : await createParticipant(participantPayload);

    if (!participant?.auth_user_id) {
      throw new Error("Participante salvo sem auth_user_id.");
    }
    await auditLog({
      actorUserId: authUser.id,
      actorRole: "participant",
      companyId: company.company_id,
      participantId: participant.id_participante,
      action: "participant_registered",
      details: { requestId, email, createdAuthUser: created },
    });

    json(response, 200, {
      ok: true,
      created,
      auth_user_id: authUser.id,
      participant: normalizeParticipant(participant),
      requestId,
    });
  } catch (error) {
    json(response, 500, {
      error: "Falha ao criar conta no Supabase Auth.",
      details: error.message,
      requestId,
    });
  }
};

