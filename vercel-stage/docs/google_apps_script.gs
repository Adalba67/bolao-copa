const SPREADSHEET_ID = "1wEG1rdXUuRC00YkRtuQeuOEPeZYyijFu8Sj_nHu2SXQ";

function doPost(e) {
  const payload = readPayload(e);
  const company = payload.company || {};
  const ss = getSpreadsheet(company);
  const prefix = sanitizeSheetName(company.name || company.id || "Empresa");
  const exportType = payload.export_type || "full";

  writeRows(ss, `${prefix} - Cadastro`, [
    ["Empresa ID", "Tipo", "Nome", "Planilha", "Spreadsheet ID", "Exportado em"],
    [company.id || "", company.name_type || "", company.name || "", company.sheet_name || "", company.spreadsheet_id || company.googleSheetId || "", payload.exported_at || ""],
  ]);

  writeRows(ss, `${prefix} - Participantes`, [
    ["ID", "Nome", "Sobrenome", "Telefone", "Login", "Cadastro"],
    ...(payload.participants || []).map((item) => [
      item.id_participante || "",
      item.nome || "",
      item.sobrenome || "",
      item.telefone || "",
      item.login || "",
      item.data_cadastro || "",
    ]),
  ]);

  if (exportType !== "participants") {
    writeRows(ss, `${prefix} - Palpites`, [
      ["Participante", "Jogo", "Casa", "Fora", "Palpite casa", "Palpite fora"],
      ...(payload.predictions || []).map((item) => [
        item.apelido || "",
        item.id_jogo || "",
        item.time_casa || "",
        item.time_fora || "",
        item.palpite_casa || 0,
        item.palpite_fora || 0,
      ]),
    ]);

    writeRows(ss, `${prefix} - Ranking`, [
      ["Posição", "Participante", "Pontos jogos", "Pontos fase final", "Total"],
      ...(payload.ranking || []).map((item, index) => [
        index + 1,
        item.name || "",
        item.pointsGames || 0,
        item.pointsFinal || 0,
        item.pointsTotal || 0,
      ]),
    ]);
  }

  return HtmlService.createHtmlOutput(
    `<html><head><meta http-equiv="refresh" content="0;url=${ss.getUrl()}"></head>` +
    `<body><p>Planilha criada. <a href="${ss.getUrl()}" target="_top">Abrir no Google Sheets</a></p></body></html>`
  );
}

function readPayload(e) {
  if (e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }
  return JSON.parse((e.postData && e.postData.contents) || "{}");
}

function getSpreadsheet(company) {
  const companySpreadsheetId = String(company.spreadsheet_id || company.googleSheetId || "").trim();
  if (companySpreadsheetId) {
    return SpreadsheetApp.openById(companySpreadsheetId);
  }

  const configuredId = String(SPREADSHEET_ID || "").trim();
  if (configuredId && configuredId !== "COLE_AQUI_O_ID_DA_PLANILHA") {
    return SpreadsheetApp.openById(configuredId);
  }

  const key = `spreadsheet:${company.id || sanitizeSheetName(company.name || "empresa")}`;
  const properties = PropertiesService.getScriptProperties();
  const storedId = properties.getProperty(key);
  if (storedId) {
    return SpreadsheetApp.openById(storedId);
  }

  const ss = SpreadsheetApp.create(company.sheet_name || company.name || "Bolao da Copa");
  properties.setProperty(key, ss.getId());
  return ss;
}

function writeRows(ss, sheetName, rows) {
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clearContents();
  if (rows.length) {
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function sanitizeSheetName(name) {
  return String(name).replace(/[\\/?*[\]:]/g, " ").slice(0, 40).trim() || "Empresa";
}
