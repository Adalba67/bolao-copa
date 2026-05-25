module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: "Recuperacao de senha nao configurada no ambiente." });
    return;
  }

  let body;
  try {
    body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  } catch {
    response.status(400).json({ error: "JSON invalido." });
    return;
  }

  const token = String(body.token || "").trim();
  const newPassword = String(body.newPassword || "");
  if (!token || newPassword.length < 6) {
    response.status(400).json({ error: "Token e nova senha com pelo menos 6 caracteres sao obrigatorios." });
    return;
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_password_reset_token`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_token: token,
      p_new_password: newPassword,
    }),
  });

  if (!rpcResponse.ok) {
    const details = await rpcResponse.text();
    response.status(400).json({ error: "Falha ao redefinir senha.", details });
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ ok: true });
};
