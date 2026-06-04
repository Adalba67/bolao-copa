const crypto = require("crypto");
const {
  assertAdminCompanyAccess,
  auditLog,
  json,
  readJson,
  requireAdmin,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

function rankingPayloadItem(item, index, companyId) {
  return {
    company_id: companyId,
    id_participante: Number(item.id),
    apelido: item.name,
    pontos_jogos: Number(item.pointsGames || 0),
    pontos_fase_final: Number(item.pointsFinal || 0),
    pontos_total: Number(item.pointsTotal || 0),
    posicao: index + 1,
  };
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

  const ranking = Array.isArray(body.ranking) ? body.ranking : [];
  if (!ranking.length) {
    json(response, 200, { ok: true, ranking: [] });
    return;
  }

  try {
    const { user, admin } = await requireAdmin(request);
    const companyId = admin.is_super_admin ? String(body.companyId || admin.company_id).trim() : admin.company_id;
    assertAdminCompanyAccess(admin, companyId);
    const payload = ranking.map((item, index) => rankingPayloadItem(item, index, companyId));
    const invalid = payload.find((item) =>
      !Number.isFinite(item.id_participante) ||
      item.pontos_jogos < 0 ||
      item.pontos_fase_final < 0 ||
      item.pontos_total < 0
    );
    if (invalid) {
      json(response, 400, { error: "Ranking contem participante ou pontuacao invalida." });
      return;
    }

    const savedRanking = await supabaseFetch("/rest/v1/ranking?on_conflict=company_id,id_participante&select=*", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload),
    });
    await auditLog({
      actorUserId: user.id,
      actorRole: admin.role || "admin",
      companyId,
      action: "ranking_saved",
      details: { requestId, count: payload.length },
    });
    json(response, 200, { ok: true, ranking: savedRanking });
  } catch (error) {
    json(response, statusFromError(error), { error: "Falha ao salvar ranking.", details: error.message, requestId });
  }
};
