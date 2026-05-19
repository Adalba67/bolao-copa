import { formatSupabaseError, getSupabaseClient } from "./supabaseClient.js";

function asString(value) {
  return value === null || value === undefined ? "" : String(value);
}

function normalizeParticipant(participant) {
  return {
    ...participant,
    id_participante: asString(participant.id_participante),
    ativo: participant.ativo === true || participant.ativo === "True" ? "True" : "False",
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

function participantPayload(participant) {
  return {
    id_participante: Number(participant.id_participante),
    company_id: participant.company_id,
    company_name: participant.company_name,
    nome: participant.nome,
    sobrenome: participant.sobrenome,
    telefone: participant.telefone,
    login: participant.login,
    password_token: participant.password_token,
    must_change_password: Boolean(participant.must_change_password),
    apelido: participant.apelido,
    data_cadastro: participant.data_cadastro,
    ativo: participant.ativo === true || participant.ativo === "True",
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
    sheet_name: admin.sheet_name,
    spreadsheet_id: admin.spreadsheet_id,
    googleSheetId: admin.google_sheet_id,
    webhook_url: admin.webhook_url,
    logo_data_url: admin.logo_data_url,
    updated_at: admin.updated_at,
  };
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
    faseFinal: finalPredictions.data || [],
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
  if (!admin) throw new Error("Login de administrador invalido.");

  return {
    user: null,
    admin,
  };
}

export async function signOutAdmin() {
  return Promise.resolve();
}

export async function saveAdminProfile(profile) {
  const client = await getSupabaseClient();
  const { error } = await client.rpc("save_admin_profile", {
    p_company_id: profile.id,
    p_name_type: profile.name_type,
    p_name: profile.name,
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

export async function savePredictionSetToSupabase(matchPredictions, finalPrediction) {
  const client = await getSupabaseClient();
  const company = await getCurrentCompany();
  const matchPredictionsWithCompany = matchPredictions.map((prediction) => ({
    ...prediction,
    company_id: company.id,
    company_name: company.name,
  }));
  const finalPredictionWithCompany = {
    ...finalPrediction,
    company_id: company.id,
    company_name: company.name,
  };
  const { error: predictionsError } = await client
    .from("palpites")
    .upsert(matchPredictionsWithCompany.map(predictionPayload), { onConflict: "company_id,id_participante,id_jogo" });
  if (predictionsError) throw new Error(formatSupabaseError(predictionsError, "Falha ao salvar palpites."));

  const { error: finalError } = await client
    .from("fase_final")
    .upsert(finalPredictionPayload(finalPredictionWithCompany), { onConflict: "company_id,id_participante" });
  if (finalError) throw new Error(formatSupabaseError(finalError, "Falha ao salvar fase final."));
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
