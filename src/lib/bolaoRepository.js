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

export async function loadBolaoData() {
  const client = await getSupabaseClient();
  const [games, teams, participants, predictions, finalPredictions, finalResult] = await Promise.all([
    client.from("jogos").select("*").order("id_jogo"),
    client.from("selecoes").select("*").order("grupo").order("posicao"),
    client.from("participantes").select("*").order("id_participante"),
    client.from("palpites").select("*").order("id_jogo"),
    client.from("fase_final").select("*").order("id_participante"),
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
  const { data, error } = await client.auth.signInWithPassword({ email: login, password });
  if (error) throw new Error(formatSupabaseError(error, "Login de administrador invalido."));

  const { data: admin, error: profileError } = await client
    .from("admins")
    .select("*")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (profileError) throw new Error(formatSupabaseError(profileError, "Falha ao carregar perfil ADM."));

  return {
    user: data.user,
    admin,
  };
}

export async function signOutAdmin() {
  const client = await getSupabaseClient();
  await client.auth.signOut();
}

export async function saveAdminProfile(profile) {
  const client = await getSupabaseClient();
  const { data: authData, error: userError } = await client.auth.getUser();
  if (userError || !authData?.user) {
    throw new Error("Entre com uma conta de administrador do Supabase Auth antes de salvar o ADM.");
  }

  const { data, error } = await client
    .from("admins")
    .upsert({
      user_id: authData.user.id,
      company_id: profile.id,
      name_type: profile.name_type,
      name: profile.name,
      sheet_name: profile.sheet_name,
      spreadsheet_id: profile.spreadsheet_id,
      google_sheet_id: profile.googleSheetId,
      webhook_url: profile.webhook_url,
      logo_data_url: profile.logo_data_url,
      updated_at: profile.updated_at,
    }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw new Error(formatSupabaseError(error, "Falha ao salvar ADM."));
  return data;
}

export async function saveParticipant(participant) {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("participantes")
    .upsert(participantPayload(participant), { onConflict: "company_id,id_participante" })
    .select()
    .single();
  if (error) throw new Error(formatSupabaseError(error, "Falha ao salvar participante."));
  return normalizeParticipant(data);
}

export async function savePredictionSetToSupabase(matchPredictions, finalPrediction) {
  const client = await getSupabaseClient();
  const { error: predictionsError } = await client
    .from("palpites")
    .upsert(matchPredictions.map(predictionPayload), { onConflict: "company_id,id_participante,id_jogo" });
  if (predictionsError) throw new Error(formatSupabaseError(predictionsError, "Falha ao salvar palpites."));

  const { error: finalError } = await client
    .from("fase_final")
    .upsert(finalPredictionPayload(finalPrediction), { onConflict: "company_id,id_participante" });
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
  const payload = ranking.map((item, index) => ({
    company_id: companyId,
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
