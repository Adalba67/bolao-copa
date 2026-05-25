const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function appBaseUrl(request) {
  const configured = process.env.APP_BASE_URL || process.env.VERCEL_URL;
  if (configured) return configured.startsWith("http") ? configured : `https://${configured}`;
  const protocol = request.headers["x-forwarded-proto"] || "https";
  return `${protocol}://${request.headers.host}`;
}

async function sendResetEmail(to, resetUrl) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESET_EMAIL_FROM;

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Recuperacao de senha - Bolao Copa",
      html: `<p>Use o link abaixo para criar uma nova senha. Ele expira em 30 minutos.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    }),
  });

  if (!resendResponse.ok) {
    const details = await resendResponse.text();
    throw new Error(`Falha ao enviar e-mail de recuperacao: ${details}`);
  }
  return true;
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendApiKey = process.env.RESEND_API_KEY;
  const resetEmailFrom = process.env.RESET_EMAIL_FROM;
  if (!supabaseUrl || !serviceRoleKey) {
    response.status(500).json({ error: "Recuperacao de senha nao configurada no ambiente." });
    return;
  }
  if (!resendApiKey || !resetEmailFrom) {
    response.status(500).json({ error: "Envio de e-mail de recuperacao nao configurado no ambiente." });
    return;
  }

  let body;
  try {
    body = typeof request.body === "string" ? JSON.parse(request.body || "{}") : request.body || {};
  } catch {
    response.status(400).json({ error: "JSON invalido." });
    return;
  }
  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    response.status(400).json({ error: "E-mail invalido." });
    return;
  }

  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_password_reset_token`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_email: email }),
  });

  if (!rpcResponse.ok) {
    const details = await rpcResponse.text();
    response.status(500).json({ error: "Falha ao solicitar recuperacao de senha.", details });
    return;
  }

  const data = await rpcResponse.json();
  const reset = Array.isArray(data) ? data[0] : data;
  if (reset?.token) {
    const resetUrl = `${appBaseUrl(request)}/?reset_token=${encodeURIComponent(reset.token)}`;
    try {
      await sendResetEmail(email, resetUrl);
    } catch (error) {
      response.status(500).json({ error: error.message });
      return;
    }
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ ok: true });
};
