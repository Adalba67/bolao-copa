import {
  changeAdminPassword,
  getCurrentCompany,
  loadBolaoData,
  saveAdminProfile,
  saveMatchResults,
  saveParticipant,
  savePredictionSetToSupabase,
  saveRanking,
  signInAdmin,
  signOutAdmin,
} from "./src/lib/bolaoRepository.js";

let jogos = [];
let selecoes = [];
let participantes = [];
let palpites = [];
let faseFinal = [];
let resultadoFinal = [];
let simulatedResults = new Map();
let predictionEntryMode = localStorage.getItem("prediction-entry-mode") || "";
let currentUser = null;
let currentPredictionPage = 0;
let currentGamesPage = 0;
let pendingPasswordParticipantId = null;
let companyProfile = null;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const byId = (id) => document.getElementById(id);
const setFeedback = (ids, message) => {
  ids.forEach((id) => {
    const element = byId(id);
    if (element) element.textContent = message;
  });
};
const GOOGLE_APPS_SCRIPT_WEBHOOK_URL = "";
const DEFAULT_GOOGLE_SHEETS_SPREADSHEET_ID = "1wEG1rdXUuRC00YkRtuQeuOEPeZYyijFu8Sj_nHu2SXQ";
const SIMULATION_LIMIT = 10;
const PREDICTION_PAGE_SIZE = 12;
const GAMES_PAGE_SIZE = 12;
const WORLD_CUP_START_DATE = "2026-06-11";
const countryCodes = {
  Algeria: "dz",
  Argentina: "ar",
  Australia: "au",
  Austria: "at",
  Belgium: "be",
  Bosnia: "ba",
  Brazil: "br",
  Brasil: "br",
  Cabo: "cv",
  Canada: "ca",
  Colombia: "co",
  Congo: "cd",
  "Cote d'Ivoire": "ci",
  Croatia: "hr",
  Curacao: "cw",
  Czechia: "cz",
  Ecuador: "ec",
  Egypt: "eg",
  England: "gb-eng",
  Franca: "fr",
  France: "fr",
  Germany: "de",
  Ghana: "gh",
  Haiti: "ht",
  Inglaterra: "gb-eng",
  "IR Iran": "ir",
  Iraq: "iq",
  Japan: "jp",
  Jordan: "jo",
  Korea: "kr",
  Marrocos: "ma",
  Mexico: "mx",
  Netherlands: "nl",
  "New Zealand": "nz",
  Norway: "no",
  Panama: "pa",
  Paraguay: "py",
  Portugal: "pt",
  Qatar: "qa",
  Scotland: "gb-sct",
  Senegal: "sn",
  Spain: "es",
  "Saudi Arabia": "sa",
  South: "za",
  Sweden: "se",
  Switzerland: "ch",
  Tunisia: "tn",
  Turkiye: "tr",
  Uzbekistan: "uz",
  USA: "us",
  Uruguay: "uy",
};

const countryNamesPtBR = {
  Algeria: "Argélia",
  Argentina: "Argentina",
  Australia: "Austrália",
  Austria: "Áustria",
  Belgium: "Bélgica",
  "Bosnia and Herzegovina": "Bósnia e Herzegovina",
  Brazil: "Brasil",
  Brasil: "Brasil",
  "Cabo Verde": "Cabo Verde",
  Canada: "Canadá",
  Colombia: "Colômbia",
  "Congo DR": "República Democrática do Congo",
  "Cote d'Ivoire": "Costa do Marfim",
  Croatia: "Croácia",
  Curacao: "Curaçao",
  Czechia: "Tchecoslovaquia",
  Ecuador: "Equador",
  Egypt: "Egito",
  England: "Inglaterra",
  Franca: "França",
  France: "França",
  Germany: "Alemanha",
  Ghana: "Gana",
  Haiti: "Haiti",
  Inglaterra: "Inglaterra",
  "IR Iran": "Irã",
  Iraq: "Iraque",
  Japan: "Japão",
  Jordan: "Jordânia",
  "Korea Republic": "Coreia do Sul",
  Marrocos: "Marrocos",
  Mexico: "México",
  Netherlands: "Países Baixos",
  "New Zealand": "Nova Zelândia",
  Norway: "Noruega",
  Panama: "Panamá",
  Paraguay: "Paraguai",
  Portugal: "Portugal",
  Qatar: "Catar",
  "Saudi Arabia": "Arábia Saudita",
  Scotland: "Escócia",
  Senegal: "Senegal",
  Spain: "Espanha",
  "South Africa": "África do Sul",
  Sweden: "Suécia",
  Switzerland: "Suíça",
  Tunisia: "Tunísia",
  Turkiye: "Turquia",
  USA: "Estados Unidos",
  Uruguay: "Uruguai",
  Uzbekistan: "Uzbequistão",
};

function countryCodeFor(team) {
  const key = Object.keys(countryCodes).find((name) => team.startsWith(name) || team === name);
  return key ? countryCodes[key] : "";
}

function teamName(team) {
  return countryNamesPtBR[team] || team;
}

function teamKey(team) {
  return String(team || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function teamLabel(team) {
  const code = countryCodeFor(team);
  const displayName = teamName(team);
  const flag = code
    ? `<img class="flag" src="https://flagcdn.com/24x18/${code}.png" alt="Bandeira ${displayName}" loading="lazy" />`
    : `<span class="flag fallback-flag"></span>`;
  return `<span class="team">${flag}${displayName}</span>`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows.shift().map((header) => header.trim());
  return rows.map((values) =>
    headers.reduce((record, header, index) => {
      record[header] = (values[index] || "").trim();
      return record;
    }, {})
  );
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return parseCsv(await response.text());
}

function slugify(value) {
  return String(value || "sem-empresa")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "sem-empresa";
}

function activeCompanyId() {
  return companyProfile?.id || "sem-empresa";
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

async function postJson(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Falha na operação.");
  return data;
}

function loginForParticipant(firstName, phone) {
  const first = String(firstName || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return `${first}_${digitsOnly(phone).slice(-3)}`;
}

function passwordToken(password) {
  return btoa(unescape(encodeURIComponent(`bolao:${password}`)));
}

function participantPasswordMatches(participant, password) {
  return participant.password_token && participant.password_token === passwordToken(password);
}

function temporaryPassword() {
  return `Bolao${Math.floor(100000 + Math.random() * 900000)}`;
}

function nextParticipantId() {
  return String(Math.max(...participantes.map((participant) => Number(participant.id_participante)), 0) + 1);
}

function gameById(gameId) {
  return jogos.find((game) => game.id_jogo === String(gameId));
}

function gameRound(game) {
  const id = Number(game.id_jogo);
  if (id <= 24) return "1";
  if (id <= 48) return "2";
  return "3";
}

function formatGameDate(value) {
  const text = String(value || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2})/);
  if (!match) return text || "-";
  const [, year, month, day, time] = match;
  return `${day}/${month}/${year} H ${time}`;
}

function officialResultFor(gameId) {
  const result = simulatedResults.get(String(gameId));
  return result ? `${result.placar_real_casa} x ${result.placar_real_fora}` : "-";
}

function hydrateOfficialResults() {
  simulatedResults = new Map();
  jogos.forEach((game) => {
    if (game.placar_real_casa === "" || game.placar_real_fora === "") return;
    simulatedResults.set(String(game.id_jogo), {
      placar_real_casa: Number(game.placar_real_casa),
      placar_real_fora: Number(game.placar_real_fora),
      status_jogo: game.status_jogo || "finalizado",
    });
  });
}

function loadCompanyProfile() {
  return companyProfile;
}

async function syncCurrentCompany() {
  const company = await getCurrentCompany();
  companyProfile = {
    id: company.id,
    name_type: company.name_type,
    name: company.name,
    sheet_name: company.sheet_name,
    spreadsheet_id: company.spreadsheet_id,
    googleSheetId: company.googleSheetId,
    webhook_url: company.webhook_url,
    logo_data_url: company.logo_data_url,
    email: company.email || "",
    updated_at: company.updated_at,
  };
  updateCompanyLabels();
  return companyProfile;
}

function companyDisplayName() {
  return companyProfile?.name || "Empresa não configurada";
}

function updateCompanyLabels() {
  byId("companyMenuName").textContent = companyDisplayName();
  byId("companyTopName").textContent = companyDisplayName();
  const logoImage = byId("companyLogoImage");
  logoImage.classList.toggle("hidden", !companyProfile?.logo_data_url);
  if (companyProfile?.logo_data_url) {
    logoImage.src = companyProfile.logo_data_url;
  } else {
    logoImage.removeAttribute("src");
  }
  if (companyProfile) {
    byId("companyNameType").value = companyProfile.name_type;
    byId("companyName").value = companyProfile.name;
    byId("adminEmail").value = companyProfile.email || "";
  }
}

function readCompanyLogoFile() {
  const file = byId("companyLogoFile").files[0];
  if (!file) return Promise.resolve(companyProfile?.logo_data_url || "");
  const isJpeg = file.type === "image/jpeg" || /\.(jpe?g|jpj)$/i.test(file.name);
  if (!isJpeg) {
    return Promise.reject(new Error("Anexe um arquivo JPG ou JPEG para o logotipo."));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Não foi possível ler o arquivo do logotipo.")));
    reader.readAsDataURL(file);
  });
}

function resetCompanyRuntimeData() {
  participantes = [];
  palpites = [];
  faseFinal = [];
  mergeStoredData();
  renderDashboard();
  renderPredictions();
  renderLinePredictionGames();
  renderParticipantsSheet();
  renderRanking();
  renderMyScore();
}

function mergeStoredData() {
  return;
}

async function persistParticipant(participant) {
  return saveParticipant(participant);
}

async function updateParticipant(participantId, changes) {
  const participant = participantes.find((item) => item.id_participante === participantId);
  if (!participant) return null;
  Object.assign(participant, changes);
  await persistParticipant(participant);
  return participant;
}

async function persistPredictions(matchPredictions, finalPrediction) {
  await savePredictionSetToSupabase(matchPredictions, finalPrediction);
}

function participantDisplayName(participant) {
  return [participant.nome, participant.sobrenome].filter(Boolean).join(" ") || participant.apelido || participant.nome;
}

function activeParticipantId() {
  return currentUser && currentUser.role === "participant" ? currentUser.participantId : null;
}

function checkSession() {
  currentUser = JSON.parse(sessionStorage.getItem("bolao-user") || "null");
  const logged = Boolean(currentUser);
  byId("loginView").classList.toggle("hidden", logged);
  byId("appView").classList.toggle("hidden", !logged);
  if (!logged) return;
  const chipName = currentUser.role === "admin" ? "ADM" : currentUser.name;
  byId("userChip").textContent = currentUser.email ? `${chipName} | ${currentUser.email}` : chipName;
  document.body.classList.toggle("participant-session", currentUser.role === "participant");
  document.querySelectorAll(".admin-only").forEach((item) => {
    item.classList.toggle("hidden", currentUser.role !== "admin");
  });
  document.querySelectorAll(".participant-only").forEach((item) => {
    item.classList.toggle("hidden", currentUser.role !== "participant");
  });
  if (currentUser.role === "participant" && document.querySelector(".section.active")?.id === "simulador") {
    activateSection("dashboard");
  }
  if (currentUser.role === "admin" && document.querySelector(".section.active")?.id === "palpitesLinha") {
    activateSection("dashboard");
  }
  populateParticipantForms();
  updatePredictionModeLock();
  renderLinePredictionGames();
  renderLineFinalPrediction();
  renderMyScore();
}

function setupAuth() {
  const resetToken = new URLSearchParams(window.location.search).get("reset_token");
  if (resetToken) {
    byId("loginForm").classList.add("hidden");
    byId("resetPasswordForm").classList.remove("hidden");
    byId("resetToken").value = resetToken;
  }

  byId("showRegisterButton").addEventListener("click", () => {
    byId("loginForm").classList.add("hidden");
    byId("registerForm").classList.remove("hidden");
    byId("changePasswordForm").classList.add("hidden");
    byId("resetRequestForm").classList.add("hidden");
    byId("resetPasswordForm").classList.add("hidden");
  });

  byId("backToLoginButton").addEventListener("click", () => {
    byId("registerForm").classList.add("hidden");
    byId("changePasswordForm").classList.add("hidden");
    byId("resetRequestForm").classList.add("hidden");
    byId("resetPasswordForm").classList.add("hidden");
    byId("loginForm").classList.remove("hidden");
  });

  byId("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = byId("username").value.trim();
    const password = byId("password").value;

    try {
      const { admin } = await signInAdmin(user, password);
      if (admin) {
        companyProfile = {
          id: admin.company_id,
          name_type: admin.name_type,
          name: admin.name,
          sheet_name: admin.sheet_name,
          spreadsheet_id: admin.spreadsheet_id,
          googleSheetId: admin.google_sheet_id,
          webhook_url: admin.webhook_url,
          logo_data_url: admin.logo_data_url,
          email: admin.email || "",
          updated_at: admin.updated_at,
        };
        updateCompanyLabels();
        sessionStorage.setItem("bolao-user", JSON.stringify({ role: "admin", name: admin?.name || "ADM", email: admin?.email || "" }));
        byId("loginError").textContent = "";
        checkSession();
        return;
      }
    } catch (error) {
      byId("loginError").textContent = error.message;
      return;
    }

    const normalizedUserEmail = normalizeEmail(user);
    const participant = participantes.find((item) =>
      item.login === user || (item.email && normalizeEmail(item.email) === normalizedUserEmail)
    );
    if (participant && participantPasswordMatches(participant, password)) {
      companyProfile = {
        id: participant.company_id || activeCompanyId(),
        name: participant.company_name || companyDisplayName(),
        name_type: "",
        logo_data_url: companyProfile?.logo_data_url || "",
      };
      updateCompanyLabels();
      if (participant.must_change_password) {
        pendingPasswordParticipantId = participant.id_participante;
        byId("loginForm").classList.add("hidden");
        byId("registerForm").classList.add("hidden");
        byId("changePasswordForm").classList.remove("hidden");
        byId("changePasswordFeedback").textContent = "";
        return;
      }

      sessionStorage.setItem("bolao-user", JSON.stringify({
        role: "participant",
        name: participantDisplayName(participant),
        email: participant.email || "",
        participantId: participant.id_participante,
      }));
      byId("loginError").textContent = "";
      checkSession();
      return;
    }

    byId("loginError").textContent = "Login ou senha inválidos.";
  });

  byId("changePasswordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = byId("newParticipantPassword").value;
    const confirm = byId("newParticipantPasswordConfirm").value;
    if (password.length < 4 || password !== confirm) {
      byId("changePasswordFeedback").textContent = "Informe senhas iguais com pelo menos 4 caracteres.";
      return;
    }

    let participant = null;
    try {
      participant = await updateParticipant(pendingPasswordParticipantId, {
        password_token: passwordToken(password),
        must_change_password: false,
      });
    } catch (error) {
      byId("changePasswordFeedback").textContent = error.message;
      return;
    }
    if (!participant) {
      byId("changePasswordFeedback").textContent = "Participante não encontrado.";
      return;
    }

    sessionStorage.setItem("bolao-user", JSON.stringify({
      role: "participant",
      name: participantDisplayName(participant),
      email: participant.email || "",
      participantId: participant.id_participante,
    }));
    pendingPasswordParticipantId = null;
    byId("newParticipantPassword").value = "";
    byId("newParticipantPasswordConfirm").value = "";
    checkSession();
  });

  byId("registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const firstName = byId("registerFirstName").value.trim();
    const lastName = byId("registerLastName").value.trim();
    const phone = byId("registerPhone").value.trim();
    const email = normalizeEmail(byId("registerEmail").value);
    const password = byId("registerPassword").value;
    const passwordConfirm = byId("registerPasswordConfirm").value;
    const phoneDigits = digitsOnly(phone);

    if (!firstName || !lastName || phoneDigits.length < 3 || !isValidEmail(email)) {
      byId("registerFeedback").textContent = "Informe nome, sobrenome, telefone e um e-mail valido.";
      return;
    }

    if (password.length < 4 || password !== passwordConfirm) {
      byId("registerFeedback").textContent = "Informe senhas iguais com pelo menos 4 caracteres.";
      return;
    }

    const login = loginForParticipant(firstName, phone);
    if (participantes.some((participant) => participant.login === login)) {
      byId("registerFeedback").textContent = `Login ${login} ja cadastrado. Ajuste o telefone ou nome.`;
      return;
    }
    if (participantes.some((participant) => normalizeEmail(participant.email) === email)) {
      byId("registerFeedback").textContent = "E-mail ja cadastrado para participante.";
      return;
    }

    let currentCompany = null;
    try {
      currentCompany = await syncCurrentCompany();
    } catch (error) {
      byId("registerFeedback").textContent = error.message;
      return;
    }

    const participant = {
      id_participante: nextParticipantId(),
      company_id: currentCompany.id,
      company_name: currentCompany.name,
      nome: firstName,
      sobrenome: lastName,
      telefone: phone,
      email,
      login,
      password_token: passwordToken(password),
      must_change_password: false,
      apelido: `${firstName} ${lastName}`,
      data_cadastro: new Date().toISOString().slice(0, 10),
      ativo: "True",
    };

    try {
      const savedParticipant = await persistParticipant(participant);
      participantes.push(savedParticipant);
    } catch (error) {
      byId("registerFeedback").textContent = error.message;
      return;
    }
    renderDashboard();
    renderParticipantsSheet();
    populateParticipantForms();
    byId("registerFeedback").textContent = `Cadastro criado. Login: ${login}`;
  });

  byId("logoutButton").addEventListener("click", async () => {
    await signOutAdmin().catch(() => {});
    sessionStorage.removeItem("bolao-user");
    checkSession();
    activateSection("dashboard");
  });

  byId("showResetPasswordButton").addEventListener("click", () => {
    byId("loginForm").classList.add("hidden");
    byId("registerForm").classList.add("hidden");
    byId("changePasswordForm").classList.add("hidden");
    byId("resetPasswordForm").classList.add("hidden");
    byId("resetRequestForm").classList.remove("hidden");
  });

  byId("backToLoginFromResetButton").addEventListener("click", () => {
    byId("resetRequestForm").classList.add("hidden");
    byId("resetPasswordForm").classList.add("hidden");
    byId("loginForm").classList.remove("hidden");
  });

  byId("resetRequestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = normalizeEmail(byId("resetEmail").value);
    if (!isValidEmail(email)) {
      byId("resetFeedback").textContent = "Informe um e-mail valido.";
      return;
    }
    try {
      await postJson("/api/request-password-reset", { email });
      byId("resetFeedback").textContent = "Se o e-mail existir, enviaremos as instrucoes de recuperacao.";
    } catch (error) {
      byId("resetFeedback").textContent = error.message;
    }
  });

  byId("resetPasswordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = byId("resetToken").value;
    const password = byId("resetNewPassword").value;
    const confirm = byId("resetNewPasswordConfirm").value;
    if (password.length < 6 || password !== confirm) {
      byId("resetPasswordFeedback").textContent = "Informe senhas iguais com pelo menos 6 caracteres.";
      return;
    }
    try {
      await postJson("/api/reset-password", { token, newPassword: password });
      byId("resetPasswordFeedback").textContent = "Senha alterada. Entre novamente.";
      byId("resetNewPassword").value = "";
      byId("resetNewPasswordConfirm").value = "";
      window.history.replaceState({}, "", window.location.pathname);
      byId("resetPasswordForm").classList.add("hidden");
      byId("loginForm").classList.remove("hidden");
      byId("loginError").textContent = "Senha alterada. Entre novamente.";
    } catch (error) {
      byId("resetPasswordFeedback").textContent = error.message;
    }
  });
}

function setupNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.dataset.section) return;
      if (button.disabled) return;
      activateSection(button.dataset.section);
    });
  });
}

function setupCompanyAdmin() {
  byId("saveCompanyButton").addEventListener("click", async () => {
    const name = byId("companyName").value.trim();
    const email = normalizeEmail(byId("adminEmail").value);
    if (!name) {
      byId("companyFeedback").textContent = "Informe o nome da empresa ou responsável.";
      return;
    }
    if (!isValidEmail(email)) {
      byId("companyFeedback").textContent = "Informe um e-mail valido para o ADM.";
      return;
    }

    let logoDataUrl = "";
    try {
      logoDataUrl = await readCompanyLogoFile();
    } catch (error) {
      byId("companyFeedback").textContent = error.message;
      return;
    }

    const previousId = activeCompanyId();
    companyProfile = {
      id: slugify(name),
      name_type: byId("companyNameType").value,
      name,
      sheet_name: companyProfile?.sheet_name || name,
      spreadsheet_id: companyProfile?.spreadsheet_id || "",
      googleSheetId: companyProfile?.googleSheetId || "",
      webhook_url: companyProfile?.webhook_url || "",
      logo_data_url: logoDataUrl,
      email,
      updated_at: new Date().toISOString(),
    };
    try {
      await saveAdminProfile(companyProfile);
      updateCompanyLabels();
      byId("companyLogoFile").value = "";
    } catch (error) {
      byId("companyFeedback").textContent = error.message;
      return;
    }

    if (previousId !== companyProfile.id) {
      resetCompanyRuntimeData();
    }

    byId("companyFeedback").textContent = "Cadastro ADM salvo no Supabase. Os dados desta empresa estão isolados.";
  });

  byId("changeAdminPasswordButton")?.addEventListener("click", async () => {
    const currentPassword = byId("adminCurrentPassword").value;
    const newPassword = byId("adminNewPassword").value;
    const confirmPassword = byId("adminNewPasswordConfirm").value;

    if (currentUser?.role !== "admin") {
      byId("adminPasswordFeedback").textContent = "Entre como ADM para alterar a senha.";
      return;
    }

    if (newPassword.length < 6 || newPassword !== confirmPassword) {
      byId("adminPasswordFeedback").textContent = "Informe senhas iguais com pelo menos 6 caracteres.";
      return;
    }

    try {
      await changeAdminPassword(currentPassword, newPassword);
      byId("adminCurrentPassword").value = "";
      byId("adminNewPassword").value = "";
      byId("adminNewPasswordConfirm").value = "";
      byId("adminPasswordFeedback").textContent = "Senha ADM alterada com sucesso.";
    } catch (error) {
      byId("adminPasswordFeedback").textContent = error.message;
    }
  });

  byId("syncSheetsButton")?.addEventListener("click", syncGoogleSheets);
}

async function syncGoogleSheets() {
  const webhookUrl = googleSheetsWebhookUrl("companyFeedback");
  if (!webhookUrl) return;

  byId("companyFeedback").textContent = "Enviando dados para o Google Sheets...";
  try {
    await fetch(webhookUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(googleSheetsPayload("full")),
    });
    byId("companyFeedback").textContent = "Envio solicitado ao Google Sheets. Verifique a planilha configurada.";
  } catch (error) {
    byId("companyFeedback").textContent = `Erro ao enviar para Google Sheets: ${error.message}`;
  }
}

function activateSection(sectionId) {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  document.querySelectorAll(".section").forEach((section) => section.classList.remove("active"));
  const button = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (button && !button.classList.contains("hidden")) button.classList.add("active");
  byId(sectionId).classList.add("active");
}

function setSectionControlsDisabled(sectionId, disabled) {
  const section = byId(sectionId);
  section.classList.toggle("locked-section", disabled);
  section.querySelectorAll("input, button").forEach((control) => {
    control.disabled = disabled;
  });
}

function setNavItemDisabled(sectionId, disabled) {
  const button = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (!button) return;
  button.disabled = disabled;
  button.title = disabled ? "Outra forma de preenchimento de palpites ja foi escolhida." : "";
}

function updatePredictionModeLock() {
  const lockedByDate = worldCupStarted();

  setSectionControlsDisabled("palpitesLinha", lockedByDate);

  if (lockedByDate) {
    setFeedback(
      ["linePredictionsFeedback", "linePredictionsFeedbackTop"],
      "A partir de 11/06/2026 não será mais permitida alteração nos placares dos palpites."
    );
  } else if (byId("linePredictionsFeedback").textContent.includes("bloqueada")) {
    setFeedback(["linePredictionsFeedback", "linePredictionsFeedbackTop"], "");
  }
}

function canEditPredictions() {
  if (worldCupStarted()) {
    updatePredictionModeLock();
    return false;
  }
  if (currentUser?.role !== "participant") {
    return currentUser?.role === "admin";
  }
  return true;
}

function setupPredictionModeLock() {
  updatePredictionModeLock();
}

function setupResultImportSettings() {
  const savedApiKey = localStorage.getItem("ball-api-key") || "";
  const autoFetch = localStorage.getItem("ball-auto-fetch") !== "off";

  byId("ballApiKey").value = savedApiKey;
  byId("autoBallResults").checked = autoFetch;

  byId("ballApiKey").addEventListener("input", (event) => {
    localStorage.setItem("ball-api-key", event.target.value.trim());
  });

  byId("autoBallResults").addEventListener("change", (event) => {
    localStorage.setItem("ball-auto-fetch", event.target.checked ? "on" : "off");
  });
}

function worldCupStarted() {
  const today = new Date();
  const startDate = new Date(`${WORLD_CUP_START_DATE}T00:00:00`);
  return today >= startDate;
}

function renderDashboard() {
  const groups = [...new Set(jogos.map((game) => game.grupo))].sort();
  byId("totalJogos").textContent = jogos.length;
  byId("totalGrupos").textContent = groups.length;
  byId("totalSelecoes").textContent = selecoes.length;
  byId("totalPalpites").textContent = participantes.filter((participant) => participant.ativo === "True").length;

  byId("groupsGrid").innerHTML = groups
    .map((group) => {
      const teams = selecoes.filter((team) => team.grupo === group);
      return `<article class="group-card">
        <strong>Grupo ${group}</strong>
        <ul>${teams.map((team) => `<li>${teamLabel(team.selecao)}</li>`).join("")}</ul>
      </article>`;
    })
    .join("");
}

function renderGroupFilter() {
  const groups = ["Todos", ...new Set(jogos.map((game) => game.grupo))].sort();
  byId("groupFilter").innerHTML = groups.map((group) => `<option>${group}</option>`).join("");
  byId("groupFilter").addEventListener("change", () => {
    currentGamesPage = 0;
    renderGames();
  });
}

function filteredGames() {
  const filter = byId("groupFilter").value || "Todos";
  return filter === "Todos" ? jogos : jogos.filter((game) => game.grupo === filter);
}

function updateGamesPager(totalGames) {
  const pageCount = Math.max(Math.ceil(totalGames / GAMES_PAGE_SIZE), 1);
  currentGamesPage = Math.min(currentGamesPage, pageCount - 1);
  byId("gamesPageInfo").textContent = `Página ${currentGamesPage + 1} de ${pageCount}`;
  byId("prevGamesPage").disabled = currentGamesPage === 0;
  byId("nextGamesPage").disabled = currentGamesPage >= pageCount - 1;
}

function renderGames() {
  const filtered = filteredGames();
  updateGamesPager(filtered.length);
  const start = currentGamesPage * GAMES_PAGE_SIZE;
  byId("gamesTable").innerHTML = filtered
    .slice(start, start + GAMES_PAGE_SIZE)
    .map((game) => {
      const result = simulatedResults.get(game.id_jogo);
      const score = result ? `${result.placar_real_casa} x ${result.placar_real_fora}` : "-";
      const status = result?.status_jogo || game.status_jogo;
      return `<tr>
        <td>${game.id_jogo}</td>
        <td>${formatGameDate(game.data_hora)}</td>
        <td>${game.grupo}</td>
        <td>${teamLabel(game.time_casa)} x ${teamLabel(game.time_fora)}</td>
        <td>${status}</td>
        <td class="score">${score}</td>
      </tr>`;
    })
    .join("");
}

function renderPredictions() {
  const rows = filteredSortedPredictions();
  byId("predictionsTable").innerHTML = rows.length ? rows
    .map((prediction) => {
      const result = simulatedResults.get(prediction.id_jogo);
      const game = gameById(prediction.id_jogo);
      const calculated = result ? calculatePoints(prediction, result) : { points: prediction.pontos_obtidos || 0, criteria: "-" };
      return `<tr>
        <td>${prediction.id_jogo}</td>
        <td>${prediction.apelido}</td>
        <td>${game ? formatGameDate(game.data_hora) : "-"}</td>
        <td>${teamLabel(prediction.time_casa)} x ${teamLabel(prediction.time_fora)}</td>
        <td>${prediction.palpite_casa} x ${prediction.palpite_fora}</td>
        <td class="score">${officialResultFor(prediction.id_jogo)}</td>
        <td class="score">${calculated.points}</td>
        <td>${calculated.criteria}</td>
      </tr>`;
    })
    .join("") : `<tr><td colspan="8">Nenhum palpite encontrado para o filtro selecionado.</td></tr>`;
}

function predictionGameDateValue(prediction) {
  const game = gameById(prediction.id_jogo);
  return game ? String(game.data_hora || "") : "";
}

function predictionParticipantName(prediction) {
  const participant = participantes.find((item) => item.id_participante === prediction.id_participante);
  return participant ? participantDisplayName(participant) : prediction.apelido || "";
}

function filteredSortedPredictions() {
  const participantFilter = byId("predictionParticipantFilter")?.value || "Todos";
  const gameFilter = byId("predictionGameFilter")?.value || "Todos";
  const order = byId("predictionOrderFilter")?.value || "gameDate";
  return palpites
    .filter((prediction) => participantFilter === "Todos" || prediction.id_participante === participantFilter)
    .filter((prediction) => gameFilter === "Todos" || prediction.id_jogo === gameFilter)
    .slice()
    .sort((a, b) => {
      const participantCompare = predictionParticipantName(a).localeCompare(predictionParticipantName(b), "pt-BR");
      const gameCompare = predictionGameDateValue(a).localeCompare(predictionGameDateValue(b))
        || Number(a.id_jogo) - Number(b.id_jogo);

      if (order === "participant") {
        return participantCompare || gameCompare;
      }

      if (gameFilter !== "Todos") {
        return participantCompare;
      }

      return gameCompare || participantCompare;
    });
}

function renderPredictionFilters() {
  const participantSelect = byId("predictionParticipantFilter");
  const gameSelect = byId("predictionGameFilter");
  if (!participantSelect || !gameSelect) return;

  const currentParticipant = participantSelect.value || "Todos";
  const currentGame = gameSelect.value || "Todos";
  const participantsWithPredictions = participantes
    .filter((participant) => participant.ativo === "True" && palpites.some((prediction) => prediction.id_participante === participant.id_participante))
    .sort((a, b) => participantDisplayName(a).localeCompare(participantDisplayName(b), "pt-BR"));
  const gamesWithPredictions = jogos
    .filter((game) => palpites.some((prediction) => prediction.id_jogo === game.id_jogo))
    .sort((a, b) => String(a.data_hora || "").localeCompare(String(b.data_hora || ""))
      || Number(a.id_jogo) - Number(b.id_jogo));

  participantSelect.innerHTML = [
    `<option value="Todos">Todos os participantes</option>`,
    ...participantsWithPredictions.map((participant) =>
      `<option value="${participant.id_participante}">${participantDisplayName(participant)}</option>`
    ),
  ].join("");
  participantSelect.value = [...participantSelect.options].some((option) => option.value === currentParticipant) ? currentParticipant : "Todos";

  gameSelect.innerHTML = [
    `<option value="Todos">Todos os jogos</option>`,
    ...gamesWithPredictions.map((game) =>
      `<option value="${game.id_jogo}">Jogo ${game.id_jogo} - ${formatGameDate(game.data_hora)} - ${teamName(game.time_casa)} x ${teamName(game.time_fora)}</option>`
    ),
  ].join("");
  gameSelect.value = [...gameSelect.options].some((option) => option.value === currentGame) ? currentGame : "Todos";
}

function renderManualGames() {
  byId("manualGamesGrid").innerHTML = jogos
    .slice(0, SIMULATION_LIMIT)
    .map((game) => {
      return `<article class="manual-game">
        <strong>${teamLabel(game.time_casa)} x ${teamLabel(game.time_fora)}</strong>
        <span>Jogo ${game.id_jogo}</span>
        <label>
          Resultado ${teamLabel(game.time_casa)}
          <input id="realHome-${game.id_jogo}" type="number" min="0" value="0" />
        </label>
        <label>
          Resultado ${teamLabel(game.time_fora)}
          <input id="realAway-${game.id_jogo}" type="number" min="0" value="0" />
        </label>
      </article>`;
    })
    .join("");
}

function renderMyPredictionGames() {
  if (!byId("myPredictionsGrid")) return;
  byId("myPredictionsGrid").innerHTML = jogos
    .slice(0, SIMULATION_LIMIT)
    .map((game) => {
      return `<article class="manual-game">
        <strong>${teamLabel(game.time_casa)} x ${teamLabel(game.time_fora)}</strong>
        <span>Jogo ${game.id_jogo} - ${formatGameDate(game.data_hora)}</span>
        <span>Resultado oficial: ${officialResultFor(game.id_jogo)}</span>
        <label>
          Palpite ${teamLabel(game.time_casa)}
          <input id="myPredHome-${game.id_jogo}" type="number" min="0" />
        </label>
        <label>
          Palpite ${teamLabel(game.time_fora)}
          <input id="myPredAway-${game.id_jogo}" type="number" min="0" />
        </label>
      </article>`;
    })
    .join("");
}

function currentPageGames() {
  const start = currentPredictionPage * PREDICTION_PAGE_SIZE;
  return jogos.slice(start, start + PREDICTION_PAGE_SIZE);
}

function selectedLineParticipant() {
  const sessionParticipantId = activeParticipantId();
  if (sessionParticipantId) {
    return participantes.find((item) => item.id_participante === sessionParticipantId) || null;
  }

  const typedName = byId("lineParticipantName").value.trim().toLowerCase();
  if (!typedName) return null;
  return participantes.find((participant) => {
    const names = [
      participantDisplayName(participant),
      participant.apelido,
      participant.nome,
      participant.login,
    ].filter(Boolean).map((value) => String(value).trim().toLowerCase());
    return names.includes(typedName);
  }) || null;
}

function existingFinalPredictionFor(participantId = selectedLineParticipant()?.id_participante) {
  if (!participantId) return null;
  return faseFinal.find((prediction) => prediction.id_participante === participantId) || null;
}

function existingPredictionFor(gameId) {
  const participantId = selectedLineParticipant()?.id_participante;
  if (!participantId) return null;
  return palpites.find((prediction) =>
    prediction.id_participante === participantId && prediction.id_jogo === String(gameId)
  );
}

function predictionInputValue(existing, field) {
  return existing ? existing[field] : "";
}

function selectTeamByKey(selectId, value) {
  const select = byId(selectId);
  const matchingOption = [...select.options].find((option) => teamKey(option.value) === teamKey(value));
  select.value = matchingOption ? matchingOption.value : select.options[0]?.value || "";
}

function defaultFinalTeam(value) {
  return selecoes.find((team) => teamKey(team.selecao) === teamKey(value))?.selecao || selecoes[0]?.selecao || "";
}

function renderFinalPredictionOptions() {
  const options = selecoes
    .map((team) => `<option value="${team.selecao}">${teamName(team.selecao)}</option>`)
    .join("");
  ["linePredFinal1", "linePredFinal2", "linePredFinal3", "linePredFinal4"].forEach((selectId) => {
    byId(selectId).innerHTML = options;
  });
  renderLineFinalPrediction();
}

function updateFinalPredictionOptionLocks() {
  const selectIds = ["linePredFinal1", "linePredFinal2", "linePredFinal3", "linePredFinal4"];
  const selectedById = Object.fromEntries(selectIds.map((selectId) => [selectId, teamKey(byId(selectId).value)]));

  selectIds.forEach((selectId) => {
    const currentValue = selectedById[selectId];
    [...byId(selectId).options].forEach((option) => {
      const optionValue = teamKey(option.value);
      option.disabled = optionValue !== currentValue && Object.values(selectedById).includes(optionValue);
    });
  });
}

function renderLineFinalPrediction() {
  const existing = existingFinalPredictionFor();
  selectTeamByKey("linePredFinal1", existing?.palpite_1_lugar || defaultFinalTeam("Brazil"));
  selectTeamByKey("linePredFinal2", existing?.palpite_2_lugar || defaultFinalTeam("France"));
  selectTeamByKey("linePredFinal3", existing?.palpite_3_lugar || defaultFinalTeam("Argentina"));
  selectTeamByKey("linePredFinal4", existing?.palpite_4_lugar || defaultFinalTeam("England"));
  updateFinalPredictionOptionLocks();
}

function updatePredictionPager() {
  const pageCount = Math.max(Math.ceil(jogos.length / PREDICTION_PAGE_SIZE), 1);
  ["predictionsPageInfo", "predictionsPageInfoTop"].forEach((id) => {
    if (byId(id)) byId(id).textContent = `Página ${currentPredictionPage + 1} de ${pageCount}`;
  });
  ["prevPredictionsPage", "prevPredictionsPageTop"].forEach((id) => {
    if (byId(id)) byId(id).disabled = currentPredictionPage === 0;
  });
  ["nextPredictionsPage", "nextPredictionsPageTop"].forEach((id) => {
    if (byId(id)) byId(id).disabled = currentPredictionPage >= pageCount - 1;
  });
}

function renderLinePredictionGames() {
  byId("linePredictionsTable").innerHTML = jogos
    .slice(currentPredictionPage * PREDICTION_PAGE_SIZE, currentPredictionPage * PREDICTION_PAGE_SIZE + PREDICTION_PAGE_SIZE)
    .map((game) => {
      const existing = existingPredictionFor(game.id_jogo);
      const result = simulatedResults.get(game.id_jogo);
      const calculated = existing && result ? calculatePoints(existing, result).points : "-";
      return `<tr>
        <td>${game.id_jogo}</td>
        <td>${formatGameDate(game.data_hora)}</td>
        <td>${game.grupo}</td>
        <td>${teamLabel(game.time_casa)} x ${teamLabel(game.time_fora)}</td>
        <td>
          <div class="line-score-inputs">
            <label>
              ${teamName(game.time_casa)}
              <input id="linePredHome-${game.id_jogo}" type="number" min="0" value="${predictionInputValue(existing, "palpite_casa")}" />
            </label>
            <span>x</span>
            <label>
              ${teamName(game.time_fora)}
              <input id="linePredAway-${game.id_jogo}" type="number" min="0" value="${predictionInputValue(existing, "palpite_fora")}" />
            </label>
          </div>
        </td>
        <td class="score">${officialResultFor(game.id_jogo)}</td>
        <td class="score">${calculated}</td>
      </tr>`;
    })
    .join("");
  updatePredictionPager();
  renderLineFinalPrediction();
  updatePredictionModeLock();
}

function outcome(home, away) {
  if (Number(home) > Number(away)) return "home";
  if (Number(away) > Number(home)) return "away";
  return "draw";
}

function isBrazilGame(gameId) {
  const game = jogos.find((item) => item.id_jogo === gameId);
  return game && String(game.eh_jogo_do_brasil).toLowerCase() === "true";
}

function calculatePoints(prediction, result) {
  const exact = Number(prediction.palpite_casa) === Number(result.placar_real_casa)
    && Number(prediction.palpite_fora) === Number(result.placar_real_fora);
  const winner = outcome(prediction.palpite_casa, prediction.palpite_fora) === outcome(result.placar_real_casa, result.placar_real_fora);
  const brazil = isBrazilGame(prediction.id_jogo);

  if (exact) return { points: brazil ? 10 : 5, criteria: brazil ? "placar exato Brasil" : "placar exato" };
  if (winner) return { points: brazil ? 5 : 3, criteria: brazil ? "vencedor ou empate Brasil" : "vencedor ou empate" };
  return { points: 0, criteria: "perdeu" };
}

function seededScore(seed) {
  const scores = [0, 1, 1, 2, 2, 3, 0, 1, 2, 4];
  return scores[seed % scores.length];
}

function simulate() {
  simulatedResults = new Map();
  jogos.forEach((game) => {
      const id = Number(game.id_jogo);
      simulatedResults.set(game.id_jogo, {
        placar_real_casa: seededScore(id * 7),
        placar_real_fora: seededScore(id * 11 + 3),
        status_jogo: "simulado",
      });
  });
  renderGames();
  renderPredictions();
  renderRanking();
}

function calculateFinalStagePoints(prediction) {
  const result = resultadoFinal[0];
  if (!result) return 0;

  const actualTop4 = [
    result.real_1_lugar,
    result.real_2_lugar,
    result.real_3_lugar,
    result.real_4_lugar,
  ];
  const predictedTop4 = [
    prediction.palpite_1_lugar,
    prediction.palpite_2_lugar,
    prediction.palpite_3_lugar,
    prediction.palpite_4_lugar,
  ];

  return predictedTop4.reduce((total, team, index) => {
    const normalizedTeam = teamKey(team);
    const isInTop4 = actualTop4.some((actualTeam) => teamKey(actualTeam) === normalizedTeam);
    const exactPosition = teamKey(actualTop4[index]) === normalizedTeam;
    if (!isInTop4) return total;
    return total + 10 + (exactPosition ? 5 : 0);
  }, 0);
}

async function applyManualResults() {
  const results = jogos.slice(0, SIMULATION_LIMIT).map((game) => ({
    id_jogo: game.id_jogo,
    placar_real_casa: Number(byId(`realHome-${game.id_jogo}`).value || 0),
    placar_real_fora: Number(byId(`realAway-${game.id_jogo}`).value || 0),
    status_jogo: "finalizado",
  }));

  results.forEach((result) => {
    simulatedResults.set(String(result.id_jogo), {
      placar_real_casa: result.placar_real_casa,
      placar_real_fora: result.placar_real_fora,
      status_jogo: result.status_jogo,
    });
  });

  const finalResult = {
    real_1_lugar: byId("realFinal1").value.trim(),
    real_2_lugar: byId("realFinal2").value.trim(),
    real_3_lugar: byId("realFinal3").value.trim(),
    real_4_lugar: byId("realFinal4").value.trim(),
  };

  try {
    await saveMatchResults(results, finalResult);
  } catch (error) {
    setFeedback(["manualFeedback", "manualFeedbackTop"], error.message);
    return;
  }

  results.forEach((result) => {
    const game = gameById(result.id_jogo);
    if (!game) return;
    game.placar_real_casa = result.placar_real_casa;
    game.placar_real_fora = result.placar_real_fora;
    game.status_jogo = result.status_jogo;
  });
  resultadoFinal = [finalResult];

  renderGames();
  renderPredictions();
  renderRanking();
  setFeedback(["manualFeedback", "manualFeedbackTop"], "Os 10 resultados foram salvos no Supabase.");
}

async function fetchBallDontLieResults(options = {}) {
  const { silent = false } = options;
  const apiKey = byId("ballApiKey").value.trim();
  if (!apiKey) {
    if (!silent) setFeedback(["manualFeedback", "manualFeedbackTop"], "Informe a chave da API Ball Don't Lie.");
    return;
  }

  setFeedback(["manualFeedback", "manualFeedbackTop"], "Buscando resultados na Ball Don't Lie...");

  try {
    const response = await fetch(
      "https://api.balldontlie.io/fifa/worldcup/v1/matches?seasons[]=2026&per_page=100",
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Ball Don't Lie retornou HTTP ${response.status}`);
    }

    const payload = await response.json();
    const matchesByNumber = new Map(
      (payload.data || []).map((match) => [String(match.match_number), match])
    );
    let imported = 0;
    const importedResults = [];

    jogos.slice(0, SIMULATION_LIMIT).forEach((game) => {
      const match = matchesByNumber.get(String(game.id_jogo));
      if (!match || match.home_score === null || match.away_score === null) return;

      byId(`realHome-${game.id_jogo}`).value = match.home_score;
      byId(`realAway-${game.id_jogo}`).value = match.away_score;
      simulatedResults.set(game.id_jogo, {
        placar_real_casa: Number(match.home_score),
        placar_real_fora: Number(match.away_score),
        status_jogo: "finalizado",
      });
      importedResults.push({
        id_jogo: game.id_jogo,
        placar_real_casa: Number(match.home_score),
        placar_real_fora: Number(match.away_score),
        status_jogo: "finalizado",
      });
      imported += 1;
    });

    if (importedResults.length) {
      await saveMatchResults(importedResults);
      importedResults.forEach((result) => {
        const game = gameById(result.id_jogo);
        if (!game) return;
        game.placar_real_casa = result.placar_real_casa;
        game.placar_real_fora = result.placar_real_fora;
        game.status_jogo = result.status_jogo;
      });
    }

    renderGames();
    renderPredictions();
    renderRanking();
    setFeedback(
      ["manualFeedback", "manualFeedbackTop"],
      imported
        ? `${imported} resultados importados da Ball Don't Lie.`
        : "Nenhum dos 10 jogos possui placar disponível na Ball Don't Lie."
    );
  } catch (error) {
    setFeedback(["manualFeedback", "manualFeedbackTop"], `Erro ao buscar Ball Don't Lie: ${error.message}`);
  }
}

function fetchBallResultsWhenCupStarts() {
  const autoFetch = byId("autoBallResults").checked;
  if (!autoFetch || !worldCupStarted()) return;
  fetchBallDontLieResults({ silent: true });
}

function participantHasPredictions(participantId) {
  return palpites.some((prediction) => prediction.id_participante === participantId);
}

function participantForNewPrediction(nameInputId, feedbackId) {
  const sessionParticipantId = activeParticipantId();
  if (sessionParticipantId) {
    const participant = participantes.find((item) =>
      item.id_participante === sessionParticipantId && item.company_id === activeCompanyId()
    );
    if (!participant) {
      setFeedback([feedbackId, "linePredictionsFeedbackTop"], "Sessão do participante desatualizada. Saia e entre novamente.");
      return null;
    }
    return participant;
  }

  const participant = selectedLineParticipant();
  if (participant) return participant;

  setFeedback([feedbackId, "linePredictionsFeedbackTop"], "Selecione um participante cadastrado para salvar os palpites.");
  return null;
}

function buildMatchPredictions(participant, source) {
  return currentPageGames().reduce((items, game, index) => {
    const homeInput = byId(`${source}Home-${game.id_jogo}`).value;
    const awayInput = byId(`${source}Away-${game.id_jogo}`).value;
    if (homeInput === "" && awayInput === "") return items;
    const existing = existingPredictionFor(game.id_jogo);
    items.push({
      id_palpite: existing ? existing.id_palpite : String(palpites.length + index + 1),
      company_id: activeCompanyId(),
      company_name: companyDisplayName(),
      id_participante: participant.id_participante,
      apelido: participantDisplayName(participant),
      id_jogo: game.id_jogo,
      time_casa: game.time_casa,
      time_fora: game.time_fora,
      palpite_casa: Number(homeInput),
      palpite_fora: Number(awayInput),
      pontos_obtidos: 0,
      criterio_pontuacao: "",
    });
    return items;
  }, []);
}

function validateMatchPredictionInputs(source, feedbackId) {
  const missingGame = currentPageGames().find((game) => {
    const home = byId(`${source}Home-${game.id_jogo}`).value;
    const away = byId(`${source}Away-${game.id_jogo}`).value;
    return (home === "" && away !== "") || (home !== "" && away === "");
  });

  if (!missingGame) return true;

  setFeedback(
    [feedbackId, "linePredictionsFeedbackTop"],
    `Preencha os dois placares do jogo ${missingGame.id_jogo} antes de salvar.`
  );
  return false;
}

function buildFinalPrediction(participant, source) {
  return {
    company_id: activeCompanyId(),
    company_name: companyDisplayName(),
    id_participante: participant.id_participante,
    apelido: participantDisplayName(participant),
    palpite_1_lugar: byId(`${source}Final1`).value.trim(),
    palpite_2_lugar: byId(`${source}Final2`).value.trim(),
    palpite_3_lugar: byId(`${source}Final3`).value.trim(),
    palpite_4_lugar: byId(`${source}Final4`).value.trim(),
    pontos_fase_final: 0,
  };
}

function hasRepeatedFinalTeams(finalPrediction) {
  const teams = [
    finalPrediction.palpite_1_lugar,
    finalPrediction.palpite_2_lugar,
    finalPrediction.palpite_3_lugar,
    finalPrediction.palpite_4_lugar,
  ].map(teamKey);
  return new Set(teams).size !== teams.length;
}

async function savePredictionSet(participant, matchPredictions, finalPrediction) {
  palpites = palpites.filter((prediction) => !matchPredictions.some((item) =>
    item.id_participante === prediction.id_participante && item.id_jogo === prediction.id_jogo
  ));
  faseFinal = faseFinal.filter((prediction) => prediction.id_participante !== finalPrediction.id_participante);
  await persistPredictions(matchPredictions, finalPrediction);
  palpites.push(...matchPredictions);
  faseFinal.push(finalPrediction);
  renderPredictionFilters();
  renderDashboard();
  renderPredictions();
  renderLinePredictionGames();
  renderRanking();
  renderParticipantsSheet();
  renderMyScore();
  updatePredictionModeLock();
}

async function addLinePredictions() {
  if (!canEditPredictions()) return;
  try {
    await syncCurrentCompany();
  } catch (error) {
    setFeedback(["linePredictionsFeedback", "linePredictionsFeedbackTop"], error.message);
    return;
  }

  const participant = participantForNewPrediction("lineParticipantName", "linePredictionsFeedback");
  if (!participant) return;
  const sessionParticipantId = activeParticipantId();
  if (sessionParticipantId && participant.id_participante !== sessionParticipantId) {
    setFeedback(
      ["linePredictionsFeedback", "linePredictionsFeedbackTop"],
      "Você só pode salvar palpites do participante logado."
    );
    return;
  }
  if (!validateMatchPredictionInputs("linePred", "linePredictionsFeedback")) return;
  const matchPredictions = buildMatchPredictions(participant, "linePred");
  if (!matchPredictions.length) {
    setFeedback(
      ["linePredictionsFeedback", "linePredictionsFeedbackTop"],
      "Altere ou preencha pelo menos um jogo antes de salvar."
    );
    return;
  }
  const finalPrediction = buildFinalPrediction(participant, "linePred");
  if (hasRepeatedFinalTeams(finalPrediction)) {
    setFeedback(["linePredictionsFeedback", "linePredictionsFeedbackTop"], "Selecione quatro seleções diferentes para a fase final.");
    return;
  }
  try {
    await savePredictionSet(participant, matchPredictions, finalPrediction);
  } catch (error) {
    setFeedback(["linePredictionsFeedback", "linePredictionsFeedbackTop"], error.message);
    return;
  }
  setFeedback(
    ["linePredictionsFeedback", "linePredictionsFeedbackTop"],
    `${participantDisplayName(participant)}: palpites desta página salvos.`
  );
}

function selectedRankingFilters() {
  return {
    round: byId("rankingRoundFilter")?.value || "Todas",
    group: byId("rankingGroupFilter")?.value || "Todos",
  };
}

function predictionMatchesFilters(prediction, filters) {
  const game = gameById(prediction.id_jogo);
  if (!game) return false;
  if (filters.round !== "Todas" && gameRound(game) !== filters.round) return false;
  if (filters.group !== "Todos" && game.grupo !== filters.group) return false;
  return true;
}

function calculateRanking(filters = { round: "Todas", group: "Todos" }) {
  const totals = new Map();
  palpites.forEach((prediction) => {
    if (!predictionMatchesFilters(prediction, filters)) return;
    const result = simulatedResults.get(prediction.id_jogo);
    const current = totals.get(prediction.id_participante) || 0;
    totals.set(prediction.id_participante, current + (result ? calculatePoints(prediction, result).points : 0));
  });

  const includeFinalStage = filters.round === "Todas" && filters.group === "Todos";
  return participantes
    .filter((participant) => participant.ativo === "True")
    .map((participant) => {
      const finalPrediction = faseFinal.find((prediction) => prediction.id_participante === participant.id_participante);
      const pointsGames = totals.get(participant.id_participante) || 0;
      const pointsFinal = includeFinalStage && finalPrediction ? calculateFinalStagePoints(finalPrediction) : 0;
      return {
        id: participant.id_participante,
        name: participantDisplayName(participant),
        pointsGames,
        pointsFinal,
        pointsTotal: pointsGames + pointsFinal,
      };
    })
    .sort((a, b) => b.pointsTotal - a.pointsTotal || b.pointsGames - a.pointsGames);
}

function canPersistRanking() {
  return ![...simulatedResults.values()].some((result) => result.status_jogo === "simulado");
}

function renderRanking() {
  const ranking = calculateRanking({ round: "Todas", group: "Todos" });
  if (canPersistRanking()) {
    saveRanking(ranking, activeCompanyId()).catch((error) => console.error(error));
  }
  byId("rankingTable").innerHTML = ranking.length
    ? ranking
      .map((participant, index) => `<tr>
        <td class="score">${index + 1}</td>
        <td>${participant.name}</td>
        <td class="score">${participant.pointsGames}</td>
        <td class="score">${participant.pointsFinal}</td>
        <td class="score">${participant.pointsTotal}</td>
        <td>${index === 0 ? "ganhou" : "simulacao"}</td>
      </tr>`)
      .join("")
    : `<tr><td colspan="6">Clique em simular resultados.</td></tr>`;

  renderRankingPanel();
  renderMyScore();
}

function renderRankingPanel() {
  const filters = selectedRankingFilters();
  const ranking = calculateRanking(filters);
  const top10 = ranking.slice(0, 10);
  const maxPoints = Math.max(...top10.map((participant) => participant.pointsTotal), 1);

  byId("rankingChart").innerHTML = top10.length
    ? top10.map((participant, index) => {
      const width = Math.max((participant.pointsTotal / maxPoints) * 100, 4);
      return `<div class="bar-row">
        <span>${index + 1}. ${participant.name}</span>
        <div class="bar-track"><div class="bar-fill" style="width: ${width}%"></div></div>
        <strong>${participant.pointsTotal}</strong>
      </div>`;
    }).join("")
    : `<p>Nenhum participante no ranking.</p>`;

  byId("rankingFullTable").innerHTML = ranking.length
    ? ranking.map((participant, index) => `<tr>
      <td class="score">${index + 1}</td>
      <td>${participant.name}</td>
      <td class="score">${participant.pointsGames}</td>
      <td class="score">${participant.pointsFinal}</td>
      <td class="score">${participant.pointsTotal}</td>
    </tr>`).join("")
    : `<tr><td colspan="5">Nenhum participante no ranking.</td></tr>`;
}

function renderMyScore() {
  const participantId = activeParticipantId();
  const ranking = calculateRanking({ round: "Todas", group: "Todos" });
  if (!participantId) {
    byId("myScoreCard").innerHTML = "<p>Entre como participante para ver sua posição no ranking.</p>";
    return;
  }

  const index = ranking.findIndex((participant) => participant.id === participantId);
  if (index < 0) {
    byId("myScoreCard").innerHTML = "<p>Você ainda não aparece no ranking.</p>";
    return;
  }

  const participant = ranking[index];
  byId("myScoreCard").innerHTML = `<div class="score-summary">
    <article><span>Posição</span><strong>${index + 1}</strong></article>
    <article><span>Pontos jogos</span><strong>${participant.pointsGames}</strong></article>
    <article><span>Fase final</span><strong>${participant.pointsFinal}</strong></article>
    <article><span>Total</span><strong>${participant.pointsTotal}</strong></article>
  </div>`;
}

function renderParticipantsSheet() {
  byId("participantsSheetTable").innerHTML = participantes
    .filter((participant) => participant.ativo === "True")
    .map((participant) => `<tr>
      <td>${participant.id_participante}</td>
      <td>${participant.nome || participant.apelido}</td>
      <td>${participant.sobrenome || "-"}</td>
      <td>${participant.telefone || "-"}</td>
      <td>
        <input class="table-input" type="email" value="${participant.email || ""}" data-participant-email="${participant.id_participante}" placeholder="email@dominio.com" />
      </td>
      <td>${participant.login || "-"}</td>
      <td>${participant.data_cadastro || "-"}</td>
      <td>
        <button class="small-table-button" type="button" data-save-email="${participant.id_participante}">Salvar e-mail</button>
        ${participant.login
          ? `<button class="small-table-button" type="button" data-reset-password="${participant.id_participante}">Resetar senha</button>`
          : "-"}
      </td>
    </tr>`)
    .join("");
}

function googleSheetsPayload(exportType = "full") {
  return {
    export_type: exportType,
    company: {
      id: activeCompanyId(),
      name: companyProfile?.name || companyDisplayName(),
      name_type: companyProfile?.name_type || "",
      sheet_name: companyProfile?.sheet_name || companyDisplayName(),
      spreadsheet_id: companyProfile?.spreadsheet_id || DEFAULT_GOOGLE_SHEETS_SPREADSHEET_ID,
      googleSheetId: companyProfile?.googleSheetId || DEFAULT_GOOGLE_SHEETS_SPREADSHEET_ID,
    },
    participants: participantes.filter((participant) => participant.ativo === "True"),
    predictions: palpites,
    final_predictions: faseFinal,
    ranking: calculateRanking({ round: "Todas", group: "Todos" }),
    exported_at: new Date().toISOString(),
  };
}

function validGoogleSheetsWebhookUrl(value) {
  const webhookUrl = String(value || "").trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(webhookUrl) ? webhookUrl : "";
}

function googleSheetsWebhookUrl(feedbackId) {
  const webhookUrl = validGoogleSheetsWebhookUrl(
    byId("googleSheetsWebhookUrl")?.value || companyProfile?.webhook_url || GOOGLE_APPS_SCRIPT_WEBHOOK_URL
  );
  if (!companyProfile) {
    byId(feedbackId).textContent = "Salve o cadastro ADM antes de exportar para o Google Sheets.";
    return "";
  }
  if (!byId("googleSheetsSpreadsheetId")?.value?.trim() && !companyProfile?.spreadsheet_id && !companyProfile?.googleSheetId && !DEFAULT_GOOGLE_SHEETS_SPREADSHEET_ID) {
    byId(feedbackId).textContent = "Google Sheets não configurado: preencha o ID da planilha no Cadastro ADM e salve.";
    return "";
  }
  if (!webhookUrl) {
    byId(feedbackId).textContent = "Google Sheets não configurado: cole a URL técnica /exec do Apps Script no Cadastro ADM e salve.";
    return "";
  }
  return webhookUrl;
}

function exportParticipantsToGoogleSheets() {
  const feedbackId = "participantsSheetFeedback";
  const webhookUrl = googleSheetsWebhookUrl(feedbackId);
  if (!webhookUrl) return;

  const form = document.createElement("form");
  const payloadInput = document.createElement("input");
  form.method = "POST";
  form.action = webhookUrl;
  form.target = "_blank";
  form.style.display = "none";
  payloadInput.type = "hidden";
  payloadInput.name = "payload";
  payloadInput.value = JSON.stringify(googleSheetsPayload("participants"));
  form.appendChild(payloadInput);
  document.body.appendChild(form);
  form.submit();
  form.remove();

  byId(feedbackId).textContent = "Planilha enviada. O Google Sheets será aberto em uma nova aba.";
}

function setupParticipantPasswordReset() {
  byId("participantsSheetTable").addEventListener("click", async (event) => {
    const saveEmailButton = event.target.closest("[data-save-email]");
    if (saveEmailButton) {
      const participantId = saveEmailButton.dataset.saveEmail;
      const input = byId("participantsSheetTable").querySelector(`[data-participant-email="${participantId}"]`);
      const email = normalizeEmail(input?.value);
      const participant = participantes.find((item) => item.id_participante === participantId);
      if (!participant) return;
      if (!isValidEmail(email)) {
        byId("participantsSheetFeedback").textContent = "Informe um e-mail valido para o participante.";
        return;
      }
      if (participantes.some((item) => item.id_participante !== participantId && normalizeEmail(item.email) === email)) {
        byId("participantsSheetFeedback").textContent = "E-mail ja cadastrado em outro participante.";
        return;
      }
      try {
        await updateParticipant(participantId, { email });
        byId("participantsSheetFeedback").textContent = "E-mail do participante salvo.";
      } catch (error) {
        byId("participantsSheetFeedback").textContent = error.message;
      }
      return;
    }

    const button = event.target.closest("[data-reset-password]");
    if (!button) return;

    const participantId = button.dataset.resetPassword;
    const participant = participantes.find((item) => item.id_participante === participantId);
    if (!participant) return;

    const tempPassword = temporaryPassword();
    try {
      await updateParticipant(participantId, {
        password_token: passwordToken(tempPassword),
        must_change_password: true,
      });
    } catch (error) {
      byId("participantsSheetFeedback").textContent = error.message;
      return;
    }
    button.closest("td").innerHTML = `<strong>Senha temporária:</strong> ${tempPassword}`;
  });
  byId("exportParticipantsButton").addEventListener("click", exportParticipantsToGoogleSheets);
}

function setupRankingFilters() {
  byId("rankingRoundFilter").innerHTML = ["Todas", "1", "2", "3"]
    .map((round) => `<option value="${round}">${round === "Todas" ? "Todas as rodadas" : `Rodada ${round}`}</option>`)
    .join("");
  byId("rankingGroupFilter").innerHTML = ["Todos", ...new Set(jogos.map((game) => game.grupo))].sort()
    .map((group) => `<option value="${group}">${group === "Todos" ? "Todos os grupos" : `Grupo ${group}`}</option>`)
    .join("");
  byId("rankingRoundFilter").addEventListener("change", renderRankingPanel);
  byId("rankingGroupFilter").addEventListener("change", renderRankingPanel);
}

function setupPredictionFilters() {
  byId("predictionParticipantFilter").addEventListener("change", renderPredictions);
  byId("predictionGameFilter").addEventListener("change", renderPredictions);
  byId("predictionOrderFilter").addEventListener("change", renderPredictions);
}

function setupPredictionPager() {
  ["prevPredictionsPage", "prevPredictionsPageTop"].forEach((id) => {
    byId(id)?.addEventListener("click", () => {
      currentPredictionPage = Math.max(currentPredictionPage - 1, 0);
      renderLinePredictionGames();
    });
  });
  ["nextPredictionsPage", "nextPredictionsPageTop"].forEach((id) => {
    byId(id)?.addEventListener("click", () => {
      const pageCount = Math.max(Math.ceil(jogos.length / PREDICTION_PAGE_SIZE), 1);
      currentPredictionPage = Math.min(currentPredictionPage + 1, pageCount - 1);
      renderLinePredictionGames();
    });
  });
}

function setupLineParticipantSelection() {
  byId("lineParticipantName").addEventListener("change", () => {
    renderLinePredictionGames();
    renderLineFinalPrediction();
  });
  byId("lineParticipantName").addEventListener("blur", () => {
    renderLinePredictionGames();
    renderLineFinalPrediction();
  });
  ["linePredFinal1", "linePredFinal2", "linePredFinal3", "linePredFinal4"].forEach((selectId) => {
    byId(selectId).addEventListener("change", updateFinalPredictionOptionLocks);
  });
}

function setupGamesPager() {
  byId("prevGamesPage").addEventListener("click", () => {
    currentGamesPage = Math.max(currentGamesPage - 1, 0);
    renderGames();
  });
  byId("nextGamesPage").addEventListener("click", () => {
    const pageCount = Math.max(Math.ceil(filteredGames().length / GAMES_PAGE_SIZE), 1);
    currentGamesPage = Math.min(currentGamesPage + 1, pageCount - 1);
    renderGames();
  });
}

function populateParticipantForms() {
  byId("lineParticipantsList").innerHTML = participantes
    .filter((participant) => participant.ativo === "True")
    .map((participant) => `<option value="${participantDisplayName(participant)}"></option>`)
    .join("");

  const participantId = activeParticipantId();
  byId("lineParticipantName").readOnly = Boolean(participantId);
  if (!participantId) return;
  const participant = participantes.find((item) => item.id_participante === participantId);
  if (!participant) return;
  const name = participantDisplayName(participant);
  byId("lineParticipantName").value = name;
  renderLinePredictionGames();
  renderLineFinalPrediction();
}

async function boot() {
  const data = await loadBolaoData();
  jogos = data.jogos;
  selecoes = data.selecoes;
  participantes = data.participantes;
  palpites = data.palpites;
  faseFinal = data.faseFinal;
  resultadoFinal = data.resultadoFinal;
  hydrateOfficialResults();

  loadCompanyProfile();
  await syncCurrentCompany();
  mergeStoredData();
  setupAuth();
  setupNavigation();
  setupCompanyAdmin();
  checkSession();
  updateCompanyLabels();
  setupRankingFilters();
  renderDashboard();
  renderGroupFilter();
  renderGames();
  renderPredictionFilters();
  renderPredictions();
  renderManualGames();
  renderFinalPredictionOptions();
  renderLinePredictionGames();
  renderParticipantsSheet();
  renderRanking();
  populateParticipantForms();
  setupPredictionModeLock();
  setupPredictionPager();
  setupLineParticipantSelection();
  setupGamesPager();
  setupPredictionFilters();
  setupParticipantPasswordReset();
  setupResultImportSettings();
  byId("simulateButton").addEventListener("click", simulate);
  byId("manualCalculateButton").addEventListener("click", applyManualResults);
  byId("fetchBallResultsButton").addEventListener("click", fetchBallDontLieResults);
  byId("linePredictionsButton").addEventListener("click", addLinePredictions);
  fetchBallResultsWhenCupStarts();
}

boot().catch((error) => {
  document.body.innerHTML = `<pre>Erro ao carregar aplicacao: ${error.message}</pre>`;
});
