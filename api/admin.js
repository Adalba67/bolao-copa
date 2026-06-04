const admins = require("../server/legacy-api/admins");
const changeAdminPassword = require("../server/legacy-api/change-admin-password");
const saveAdminProfile = require("../server/legacy-api/save-admin-profile");
const setParticipantAccess = require("../server/legacy-api/set-participant-access");
const syncParticipantAuthUser = require("../server/legacy-api/sync-participant-auth-user");
const { json, readJson } = require("../server/security");

const ACTIONS = {
  "admins": admins,
  "admin-clients": admins,
  "change-admin-password": changeAdminPassword,
  "changePassword": changeAdminPassword,
  "save-admin-profile": saveAdminProfile,
  "saveProfile": saveAdminProfile,
  "set-participant-access": setParticipantAccess,
  "setParticipantAccess": setParticipantAccess,
  "sync-participant-auth-user": syncParticipantAuthUser,
  "syncParticipantAuthUser": syncParticipantAuthUser,
};

function pathAction(request) {
  const pathname = new URL(request.url || "/api/admin", "http://localhost").pathname;
  return pathname.split("/").filter(Boolean).pop();
}

module.exports = async function handler(request, response) {
  let action = pathAction(request);

  if (action === "admin") {
    if (request.method === "GET" || request.method === "DELETE") {
      action = "admins";
    } else {
      const body = await readJson(request).catch(() => ({}));
      action = body.action || "admins";
    }
  }

  const target = ACTIONS[action];
  if (!target) {
    json(response, 404, { error: "Acao administrativa nao encontrada." });
    return;
  }

  await target(request, response);
};
