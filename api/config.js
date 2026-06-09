require("dotenv").config({ path: ".env.local" });

function firstEnv(names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return { name, value };
  }
  return { name: "", value: "" };
}

module.exports = function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const url = firstEnv([
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
  ]);
  const anonKey = firstEnv([
    "SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);
  response.setHeader("Cache-Control", "no-store");
  if (!url.value || !anonKey.value) {
    response.status(500).json({
      error: "Supabase nao configurado.",
      missing: {
        supabaseUrl: !url.value,
        supabaseAnonKey: !anonKey.value,
      },
    });
    return;
  }

  response.status(200).json({
    supabaseUrl: url.value,
    supabaseAnonKey: anonKey.value,
  });
};
