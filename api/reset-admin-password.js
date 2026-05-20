module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!supabaseUrl || !serviceRoleKey || !bootstrapPassword) {
    response.status(500).json({ error: "Reset de ADM nao configurado no ambiente." });
    return;
  }

  let body;
  try {
    body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  } catch {
    response.status(400).json({ error: "JSON invalido." });
    return;
  }
  if (body.bootstrapPassword !== bootstrapPassword) {
    response.status(401).json({ error: "Bootstrap invalido." });
    return;
  }

  const newPassword = String(body.newPassword || "");
  if (newPassword.length < 6) {
    response.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
    return;
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reset_admin_password_by_service`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_login: "adm",
      p_new_password: newPassword,
    }),
  });

  if (!rpcResponse.ok) {
    const errorText = await rpcResponse.text();
    response.status(500).json({ error: "Falha ao redefinir senha ADM.", details: errorText });
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ ok: true });
};
