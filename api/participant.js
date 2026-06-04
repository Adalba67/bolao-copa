const completePasswordChange = require("../server/legacy-api/complete-participant-password-change");
const registerParticipant = require("../server/legacy-api/register-participant");
const savePredictions = require("../server/legacy-api/save-predictions");
const { json, readJson } = require("../server/security");

const ACTIONS = {
  "complete-participant-password-change": completePasswordChange,
  "completePasswordChange": completePasswordChange,
  "register-participant": registerParticipant,
  "register": registerParticipant,
  "save-predictions": savePredictions,
  "savePredictions": savePredictions,
};

function pathAction(request) {
  const pathname = new URL(request.url || "/api/participant", "http://localhost").pathname;
  return pathname.split("/").filter(Boolean).pop();
}

module.exports = async function handler(request, response) {
  let action = pathAction(request);

  if (action === "participant") {
    const body = await readJson(request).catch(() => ({}));
    action = body.action || "";
  }

  const target = ACTIONS[action];
  if (!target) {
    json(response, 404, { error: "Acao de participante nao encontrada." });
    return;
  }

  await target(request, response);
};
