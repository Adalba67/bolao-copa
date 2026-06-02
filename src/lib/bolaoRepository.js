import { formatSupabaseError, getSupabaseClient } from "./supabaseClient.js";

function asString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function asBoolean(value) {
  return value === true || String(value).toLowerCase() === "true";
}

function normalizeParticipant(participant) {
  return {
    ...participant,
    id_participante: asString(participant.id_participante),
    ativo: participant.ativo === true || participant.ativo === "True" ? "True" : "False",
    access_blocked: asBoolean(participant.access_blocked),
  };
}

function normalizeGame(game) {
  return {
    ...game,
    id_jogo: asString(game.id_jogo),
    placar_real_casa: game.placar_real_casa ?? "",
    placar_real_fora: game.placar_real_fora ?? "",
    eh_jogo_do_brasil: game.eh_jogo_do_brasil ? "True" : "False",
  };
}

function normalizePrediction(prediction) {
  return {
    ...prediction,
    id_palpite: asString(prediction.id_palpite || prediction.id),
    id_participante: asString(prediction.id_participante),
    id_jogo: asString(prediction.id_jogo),
  };
}

function normalizeFinalPrediction(prediction) {
  return {
    ...prediction,
    id_participante: asString(prediction.id_participante),
  };
}

function participantDisplayNameForRepository(participant) {
  return [participant.nome, participant.sobrenome].filter(Boolean).join(" ") || participant.apelido || participant.nome;
}

function participantPayload(participant) {
  return {
    id_participante: Number(participant.id_participante),
    company_id: participant.company_id,
    company_name: participant.company_name,
    nome: participant.nome,
    sobrenome: participant.sobrenome,
    telefone: participant.telefone,
    email: participant.email,
    login: participant.login,
    password_token: participant.password_token,
    must_change_password: Boolean(participant.must_change_password),
    apelido: participant.apelido,
    data_cadastro: participant.data_cadastro,
    ativo: participant.ativo === true || participant.ativo === "True",
    access_blocked: asBoolean(participant.access_blocked),
  };
}

function predictionPayload(prediction) {
  return {
    id_palpite: prediction.id_palpite ? Number(prediction.id_palpite) : null,
    company_id: prediction.company_id,
    company_name: prediction.company_name,
    id_participante: Number(prediction.id_participante),
    apelido: prediction.apelido,
    id_jogo: Number(prediction.id_jogo),
    time_casa: prediction.time_casa,
    time_fora: prediction.time_fora,
    palpite_casa: Number(prediction.palpite_casa),
    palpite_fora: Number(prediction.palpite_fora),
    pontos_obtidos: Number(prediction.pontos_obtidos || 0),
    criterio_pontuacao: prediction.criterio_pontuacao || "",
  };
}

function finalPredictionPayload(prediction) {
  return {
    company_id: prediction.company_id,
    company_name: prediction.company_name,
    id_participante: Number(prediction.id_participante),
    apelido: prediction.apelido,
    palpite_1_lugar: prediction.palpite_1_lugar,
    palpite_2_lugar: prediction.palpite_2_lugar,
    palpite_3_lugar: prediction.palpite_3_lugar,
    palpite_4_lugar: prediction.palpite_4_lugar,
    pontos_fase_final: Number(prediction.pontos_fase_final || 0),
  };
}

function normalizeCompany(admin) {
  return {
    id: admin.company_id,
    name_type: admin.name_type,
    name: admin.name,
    email: admin.email,
    sheet_name: admin.sheet_name,
    spreadsheet_id: admin.spreadsheet_id,
    googleSheetId: admin.google_sheet_id,
    webhook_url: admin.webhook_url,
    logo_data_url: admin.logo_data_url,
    updated_at: admin.updated_at,
  };
}

function firstRecord(data) {
  return Array.isArray(data) ? data[0] : data;
}

export async function getCurrentCompany() {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("get_current_company");
  if (error) throw new Error(formatSupabaseError(error, "Falha ao carregar empresa atual."));

  const company = Array.isArray(data) ? data[0] : data;
  if (!company) throw new Error("Empresa atual nao encontrada no Supabase.");
  return normalizeCompany(company);
}

export async function loadBolaoData() {
  const client = await getSupabaseClient();
  const company = await getCurrentCompany();
  const [games, teams, participants, predictions, finalPredictions, finalResult] = await Promise.all([
    client.from("jogos").select("*").order("id_jogo"),
    client.from("selecoes").select("*").order("grupo").order("posicao"),
    client.from("participantes").select("*").eq("company_id", company.id).order("id_participante"),
    client.from("palpites").select("*").eq("company_id", company.id).order("id_jogo"),
    client.from("fase_final").select("*").eq("company_id", company.id).order("id_participante"),
    client.from("resultado_final").select("*").order("id", { ascending: false }).limit(1),
  ]);

  const failed = [games, teams, participants, predictions, finalPredictions, finalResult].find((result) => result.error);
  if (failed) throw new Error(formatSupabaseError(failed.error, "Falha ao carregar dados."));

  return {
    jogos: (games.data || []).map(normalizeGame),
    selecoes: teams.data || [],
    participantes: (participants.data || []).map(normalizeParticipant),
    palpites: (predictions.data || []).map(normalizePrediction),
    faseFinal: (finalPredictions.data || []).map(normalizeFinalPrediction),
    resultadoFinal: finalResult.data || [],
  };
}

export async function signInAdmin(login, password) {
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("authenticate_admin", {
    p_login: login,
    p_password: password,
  });
  if (error) throw new Error(formatSupabaseError(error, "Login de administrador invalido."));

  const admin = Array.isArray(data) ? data[0] : data;
  if (!admin) return { user: null, admin: null };

  return {
    user: null,
    admin,
  };
}

export async function signInWithAuth(login, password) {
  const client = await getSupabaseClient();
  const { data: authData, error: authError } = await client.auth.signInWithPassword({
    email: login,
    password,
  });
  if (authError) throw new Error(formatSupabaseError(authError, "Login Supabase Auth invalido."));

  const { data: linkData, error: linkError } = await client.rpc("link_auth_user_by_email");
  if (linkError) throw new Error(formatSupabaseError(linkError, "Falha ao vincular usuario Auth."));

  return {
    session: authData?.session || null,
    user: authData?.user || null,
    linkedUser: firstRecord(linkData) || null,
  };
}

export async function signOutSupabaseAuth() {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw new Error(formatSupabaseError(error, "Falha ao sair do Supabase Auth."));
}

export async function signOutAdmin() {
  return Promise.resolve();
}

function passwordResetRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}?reset_password=1`;
}

export async function requestSupabasePasswordReset(email) {
  const client = await getSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: passwordResetRedirectUrl(),
  });
  if (error) throw new Error(formatSupabaseError(error, "Falha ao enviar recuperacao de senha."));
}

export async function prepareSupabasePasswordRecovery() {
  const client = await getSupabaseClient();
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  const code = searchParams.get("code");

  if (accessToken && refreshToken) {
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw new Error(formatSupabaseError(error, "Link de recuperacao invalido ou expirado."));
    window.history.replaceState({}, "", `${window.location.pathname}?reset_password=1`);
    return true;
  }

  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw new Error(formatSupabaseError(error, "Link de recuperacao invalido ou expirado."));
    window.history.replaceState({}, "", `${window.location.pathname}?reset_password=1`);
    return true;
  }

  if (searchParams.get("reset_password") === "1") {
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(formatSupabaseError(error, "Falha ao validar sessao de recuperacao."));
    return Boolean(data?.session);
  }

  return false;
}

export async function updateSupabasePassword(password) {
  const client = await getSupabaseClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw new Error(formatSupabaseError(error, "Falha ao alterar senha."));
}

export async function syncParticipantAuthUser({ companyId, participantId, email }) {
  console.info("[syncParticipantAuthUser] chamando endpoint", { companyId, participantId, email });
  const response = await fetch("/api/sync-participant-auth-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, participantId, email }),
  });
  const data = await response.json().catch(() => ({}));
  console.info("[syncParticipantAuthUser] resposta do endpoint", {
    status: response.status,
    ok: response.ok,
    created: data.created,
    authUserId: data.auth_user_id,
    requestId: data.requestId,
  });
  if (!response.ok) {
    throw new Error(data.details ? `${data.error} ${data.details}` : data.error || "Falha ao sincronizar usuario Auth.");
  }
  if (data.participant) data.participant = normalizeParticipant(data.participant);
  return data;
}

export async function setParticipantAccessBlocked({ companyId, participantId, accessBlocked }) {
  const response = await fetch("/api/set-participant-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyId, participantId, accessBlocked }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.details ? `${data.error} ${data.details}` : data.error || "Falha ao alterar acesso do participante.");
  }
  if (data.participant) data.participant = normalizeParticipant(data.participant);
  return data;
}

export async function changeAdminPassword(currentPassword, newPassword) {
  const client = await getSupabaseClient();
  const { error } = await client.rpc("change_admin_password", {
    p_login: "adm",
    p_current_password: currentPassword,
    p_new_password: newPassword,
  });

  if (error) throw new Error(formatSupabaseError(error, "Falha ao alterar senha ADM."));
}

export async function saveAdminProfile(profile) {
  const client = await getSupabaseClient();
  const { error } = await client.rpc("save_admin_profile", {
    p_company_id: profile.id,
    p_name_type: profile.name_type,
    p_name: profile.name,
    p_email: profile.email,
    p_sheet_name: profile.sheet_name,
    p_spreadsheet_id: profile.spreadsheet_id,
    p_google_sheet_id: profile.googleSheetId,
    p_webhook_url: profile.webhook_url,
    p_logo_data_url: profile.logo_data_url,
  });

  if (error) throw new Error(formatSupabaseError(error, "Falha ao salvar ADM."));
  return profile;
}

export async function saveParticipant(participant) {
  const client = await getSupabaseClient();
  const company = await getCurrentCompany();
  const participantWithCompany = {
    ...participant,
    company_id: company.id,
    company_name: company.name,
  };
  const { data, error } = await client
    .from("participantes")
    .upsert(participantPayload(participantWithCompany), { onConflict: "company_id,id_participante" })
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error, "Falha ao salvar participante."));
  return normalizeParticipant(data);
}

async function getParticipantInCurrentCompany(participantId) {
  const client = await getSupabaseClient();
  const company = await getCurrentCompany();
  const { data, error } = await client
    .from("participantes")
    .select("*")
    .eq("company_id", company.id)
    .eq("id_participante", Number(participantId))
    .eq("ativo", true)
    .maybeSingle();

  if (error) throw new Error(formatSupabaseError(error, "Falha ao validar participante."));
  if (!data) throw new Error("Participante invalido para a empresa atual.");

  return {
    company,
    participant: normalizeParticipant(data),
  };
}

export async function savePredictionSetToSupabase(matchPredictions, finalPrediction) {
  const predictionParticipantIds = new Set(matchPredictions.map((prediction) => String(prediction.id_participante)));
  predictionParticipantIds.add(String(finalPrediction.id_participante));
  if (predictionParticipantIds.size !== 1) {
    throw new Error("Os palpites devem pertencer a um unico participante.");
  }

  const response = await fetch("/api/save-predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchPredictions, finalPrediction }),
  });
  const data = await response.json().catch(() => ({}));
  console.info("[savePredictionSetToSupabase] resposta do endpoint", {
    status: response.status,
    ok: response.ok,
    savedMatches: Array.isArray(data.matchPredictions) ? data.matchPredictions.length : 0,
    hasFinalPrediction: Boolean(data.finalPrediction),
    requestId: data.requestId,
  });
  if (!response.ok) {
    throw new Error(data.details ? `${data.error} ${data.details}` : data.error || "Falha ao salvar palpites.");
  }
  if (Array.isArray(data.matchPredictions)) {
    data.matchPredictions = data.matchPredictions.map(normalizePrediction);
  }
  if (data.finalPrediction) {
    data.finalPrediction = normalizeFinalPrediction(data.finalPrediction);
  }
  return data;
}

export async function saveMatchResults(results, finalResult) {
  const client = await getSupabaseClient();
  const updates = results.map((result) =>
    client
      .from("jogos")
      .update({
        placar_real_casa: Number(result.placar_real_casa),
        placar_real_fora: Number(result.placar_real_fora),
        status_jogo: result.status_jogo || "finalizado",
      })
      .eq("id_jogo", Number(result.id_jogo))
  );

  const updateResults = await Promise.all(updates);
  const failed = updateResults.find((result) => result.error);
  if (failed) throw new Error(formatSupabaseError(failed.error, "Falha ao salvar resultados."));

  if (finalResult) {
    const { error } = await client
      .from("resultado_final")
      .upsert({ id: 1, ...finalResult }, { onConflict: "id" });
    if (error) throw new Error(formatSupabaseError(error, "Falha ao salvar resultado final."));
  }
}

export async function saveRanking(ranking, companyId) {
  const client = await getSupabaseClient();
  const company = await getCurrentCompany();
  const payload = ranking.map((item, index) => ({
    company_id: company.id || companyId,
    id_participante: Number(item.id),
    apelido: item.name,
    pontos_jogos: Number(item.pointsGames || 0),
    pontos_fase_final: Number(item.pointsFinal || 0),
    pontos_total: Number(item.pointsTotal || 0),
    posicao: index + 1,
  }));

  if (!payload.length) return;

  const { error } = await client
    .from("ranking")
    .upsert(payload, { onConflict: "company_id,id_participante" });
  if (error) throw new Error(formatSupabaseError(error, "Falha ao salvar ranking."));
}
