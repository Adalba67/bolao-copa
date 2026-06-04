const saveRanking = require("../server/legacy-api/save-ranking");
const saveResults = require("../server/legacy-api/save-results");
const semifinalistsConference = require("../server/legacy-api/semifinalists-conference");
const { json, readJson } = require("../server/security");

const ACTIONS = {
  "save-ranking": saveRanking,
  "saveRanking": saveRanking,
  "save-results": saveResults,
  "saveResults": saveResults,
  "semifinalists-conference": semifinalistsConference,
  "semifinalistsConference": semifinalistsConference,
};

function pathAction(request) {
  const pathname = new URL(request.url || "/api/results", "http://localhost").pathname;
  return pathname.split("/").filter(Boolean).pop();
}

module.exports = async function handler(request, response) {
  let action = pathAction(request);

  if (action === "results") {
    if (request.method === "GET") {
      action = "semifinalistsConference";
    } else {
      const body = await readJson(request).catch(() => ({}));
      action = body.action || "";
    }
  }

  const target = ACTIONS[action];
  if (!target) {
    json(response, 404, { error: "Acao de resultados nao encontrada." });
    return;
  }

  await target(request, response);
};
