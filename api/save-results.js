const crypto = require("crypto");
const {
  auditLog,
  json,
  readJson,
  requireAdmin,
  statusFromError,
  supabaseFetch,
} = require("../server/security");

function log(requestId, step, details = {}) {
  console.log(`[save-results:${requestId}] ${step}`, details);
}

async function updateMatchResult(result) {
  return supabaseFetch(`/rest/v1/jogos?id_jogo=eq.${encodeURIComponent(result.id_jogo)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      placar_real_casa: Number(result.placar_real_casa),
      placar_real_fora: Number(result.placar_real_fora),
      status_jogo: result.status_jogo || "finalizado",
    }),
  });
}

async function upsertFinalResult(finalResult) {
  return supabaseFetch("/rest/v1/resultado_final?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: 1, ...finalResult }),
  });
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

  const results = Array.isArray(body.results) ? body.results : [];
  const finalResult = body.finalResult || null;
  if (!results.length && !finalResult) {
    json(response, 400, { error: "Informe resultados de jogos ou resultado final." });
    return;
  }

  try {
    const { user, admin } = await requireAdmin(request);
    const invalidResult = results.find((result) =>
      !Number.isFinite(Number(result.id_jogo)) ||
      !Number.isFinite(Number(result.placar_real_casa)) ||
      !Number.isFinite(Number(result.placar_real_fora)) ||
      Number(result.placar_real_casa) < 0 ||
      Number(result.placar_real_fora) < 0
    );
    if (invalidResult) {
      json(response, 400, { error: "Resultados devem ter jogo e placares numericos nao negativos." });
      return;
    }

    await Promise.all(results.map(updateMatchResult));
    if (finalResult) await upsertFinalResult(finalResult);
    await auditLog({
      actorUserId: user.id,
      actorRole: admin.role || "admin",
      companyId: admin.company_id,
      action: "results_saved",
      details: {
        requestId,
        resultCount: results.length,
        hasFinalResult: Boolean(finalResult),
        gameIds: results.map((result) => Number(result.id_jogo)),
      },
    });
    log(requestId, "results_saved", { admin: admin.company_id, count: results.length });
    json(response, 200, { ok: true });
  } catch (error) {
    log(requestId, "save_failed", { message: error.message, stack: error.stack });
    json(response, statusFromError(error), { error: "Falha ao salvar resultados.", details: error.message, requestId });
  }
};
