import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

let supabase = null;
let loadedConfig = null;

async function loadConfig() {
  if (loadedConfig) return loadedConfig;

  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Nao foi possivel carregar a configuracao do Supabase (HTTP ${response.status}).`);
  }

  const config = await response.json();
  loadedConfig = {
    url: config.supabaseUrl,
    anonKey: config.supabaseAnonKey,
  };
  return loadedConfig;
}

export async function getSupabaseClient() {
  if (supabase) return supabase;

  const config = await loadConfig();
  if (!config.url || !config.anonKey) {
    throw new Error("Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_ANON_KEY na Vercel.");
  }

  supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return supabase;
}

export function formatSupabaseError(error, fallback = "Erro ao acessar o Supabase.") {
  if (!error) return fallback;
  return error.message ? `${fallback} ${error.message}` : fallback;
}
