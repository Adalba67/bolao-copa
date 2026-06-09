from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_sensitive_api_routes_require_auth_helpers():
    sensitive_apis = [
        "server/legacy-api/save-predictions.js",
        "server/legacy-api/save-results.js",
        "server/legacy-api/save-ranking.js",
        "server/legacy-api/save-admin-profile.js",
        "server/legacy-api/change-admin-password.js",
        "server/legacy-api/admins.js",
        "server/legacy-api/set-participant-access.js",
        "server/legacy-api/sync-participant-auth-user.js",
        "server/legacy-api/complete-participant-password-change.js",
        "server/legacy-api/semifinalists-conference.js",
    ]

    for api_file in sensitive_apis:
        source = read(api_file)
        assert "requireAdmin" in source or "requireParticipant" in source or "requireSuperAdmin" in source
        assert "../security" in source


def test_vercel_routes_include_security_api_endpoints():
    vercel_json = read("vercel.json")

    for route in [
        "/api/admin",
        "/api/participant",
        "/api/results",
        "/api/register-participant",
        "/api/complete-participant-password-change",
        "/api/semifinalists-conference",
        "/api/save-predictions",
        "/api/save-results",
        "/api/save-ranking",
        "/api/save-admin-profile",
        "/api/change-admin-password",
        "/api/auth-profile",
        "/api/public-company",
        "/api/admins",
        "/api/set-participant-access",
        "/api/sync-participant-auth-user",
    ]:
        assert route in vercel_json


def test_security_migration_removes_anonymous_critical_writes():
    migration = read("supabase/migrations/20260603090000_security_hardening.sql")

    required_statements = [
        "create table if not exists public.audit_logs",
        "actor_role text not null check (actor_role in ('super_admin', 'admin', 'participant', 'system'))",
        'drop policy if exists "public_insert_palpites_before_deadline"',
        'drop policy if exists "public_update_palpites_before_deadline"',
        'drop policy if exists "anon_write_ranking"',
        "revoke insert, update, delete on public.palpites from anon, authenticated",
        "revoke update on public.jogos from anon, authenticated",
        "revoke insert, update, delete on public.ranking from anon, authenticated",
        "revoke execute on function public.save_admin_profile",
        "revoke execute on function public.change_admin_password",
        "revoke execute on function public.authenticate_admin",
    ]

    for statement in required_statements:
        assert statement in migration


def test_frontend_sends_authorization_to_sensitive_apis():
    repository = read("src/lib/bolaoRepository.js")

    assert 'const accessToken = authData?.session?.access_token' in repository
    assert "const profile = await loadAuthProfile(accessToken)" in repository
    assert 'export async function loadAuthProfile(accessToken = "")' in repository
    assert "async function authHeaders(accessToken = \"\")" in repository
    assert "Authorization: `Bearer ${token}`" in repository
    for action in [
        '"savePredictions"',
        '"saveResults"',
        '"saveRanking"',
        '"saveProfile"',
        '"changePassword"',
        '"setParticipantAccess"',
        '"syncParticipantAuthUser"',
        '"completePasswordChange"',
        "semifinalistsConference",
    ]:
        assert action in repository


def test_super_admin_migration_defines_scoped_roles():
    migration = read("supabase/migrations/20260603100000_super_admin_and_admin_client.sql")

    for statement in [
        "add column if not exists role text not null default 'admin'",
        "admins_role_check check (role in ('super_admin', 'admin'))",
        "super.role = 'super_admin'",
        "a.role = 'super_admin'",
    ]:
        assert statement in migration


def test_frontend_does_not_call_admin_profile_rpc_directly():
    repository = read("src/lib/bolaoRepository.js")

    assert ".rpc(" not in repository
    assert 'rpc("save_admin_profile"' not in repository
    assert "rpc('save_admin_profile'" not in repository
    assert 'rpc("change_admin_password"' not in repository
    assert "rpc('change_admin_password'" not in repository
    assert 'rpc("authenticate_admin"' not in repository
    assert "rpc('authenticate_admin'" not in repository
    assert '"/api/admin"' in repository
    assert '"/api/admin-login"' not in repository
    assert '"/api/auth-profile"' in repository


def test_legacy_admin_login_route_removed():
    assert not (ROOT / "api/admin-login.js").exists()
    assert not (ROOT / "api/reset-admin-password.js").exists()
    assert "/api/admin-login" not in read("vercel.json")
    assert "/api/reset-admin-password" not in read("vercel.json")


def test_admin_password_uses_supabase_auth_not_legacy_rpc():
    source = read("server/legacy-api/change-admin-password.js")

    assert "change_admin_password" not in source
    assert "/auth/v1/token?grant_type=password" in source
    assert "/auth/v1/admin/users/" in source


def test_remove_legacy_admin_auth_migration_drops_rpc_functions():
    migration = read("supabase/migrations/20260604090000_remove_legacy_admin_auth.sql")

    for statement in [
        "drop function if exists public.authenticate_admin",
        "drop function if exists public.change_admin_password",
        "drop function if exists public.reset_admin_password_by_service",
        "drop function if exists public.save_admin_profile",
        "drop function if exists public.get_current_company",
        "drop function if exists public.link_auth_user_by_email",
    ]:
        assert statement in migration


def test_super_admin_management_endpoint_requires_super_admin():
    source = read("server/legacy-api/admins.js")

    assert "requireSuperAdmin" in source
    for action in [
        "admin_client_created",
        "admin_client_linked",
        "admin_client_removed",
        "admin_client_access_reset",
    ]:
        assert action in source


def test_admins_rls_recursion_fix_uses_security_definer_helpers():
    migration = read("supabase/migrations/20260605090000_fix_admins_rls_recursion.sql")

    assert "security definer" in migration
    assert "auth_is_super_admin" in migration
    assert "auth_admin_company_id" in migration
    assert 'drop policy if exists "admins_select_own_profile" on public.admins' in migration
    assert 'drop policy if exists "admins_update_own_profile" on public.admins' in migration
    assert 'drop policy if exists "admins_select_company_audit_logs" on public.audit_logs' in migration

    admins_policy_section = migration.split('create policy "admins_select_own_profile"')[1]
    admins_policy_section = admins_policy_section.split('drop policy if exists "admins_select_company_audit_logs"')[0]
    assert "from public.admins" not in admins_policy_section


def test_participant_session_normalizes_auth_profile_id_before_access_check():
    source = read("app.js")

    assert "participantId: normalizeParticipantId(participant.id_participante)" in source
    assert "async function checkSession()" in source
    assert "const authContext = await getCurrentAuthContext()" in source
    assert 'sessionStorage.removeItem("bolao-user")' in source
    assert 'JSON.parse(sessionStorage.getItem("' not in source
    assert 'const authParticipant = profileType === "participant" ? linkedUser : null;' in source
    assert "setParticipantSession(authParticipant, authUser)" in source
    assert 'Perfil de participante não encontrado. Fale com o ADM.' not in source


def test_temporary_participant_diagnostic_logs_are_removed():
    source = read("app.js")

    for temporary_log in [
        "[AUTH_PROFILE]",
        "[COMPANY_PROFILE]",
        "[SESSION_CHECK]",
        "[participant-auth-debug]",
    ]:
        assert temporary_log not in source


def test_auth_profile_normalizes_participant_access_fields_without_debug_logs():
    source = read("api/auth-profile.js")

    assert "normalizeParticipantProfile(participant)" in source
    assert "auth_user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1" in source
    assert "findParticipantByEmail" not in source
    assert "console.info" not in source
    assert "id_participante: String(participant.id_participante)" in source
    assert "access_blocked:" in source


def test_supabase_client_persists_and_refreshes_auth_session():
    source = read("src/lib/supabaseClient.js")

    assert "persistSession: true" in source
    assert "autoRefreshToken: true" in source


def test_company_is_loaded_before_company_scoped_supabase_queries():
    app_source = read("app.js")
    repository_source = read("src/lib/bolaoRepository.js")

    boot_source = app_source.split("async function boot()")[1]
    assert boot_source.index("await syncCurrentCompany()") < boot_source.index(
        "loadBolaoData(companyProfile.id)"
    )
    assert "id: admin.company_id || admin.id" in repository_source
    assert 'requestedCompanyId === "undefined"' in repository_source
    assert '.eq("company_id", activeCompanyId)' in repository_source


def test_admin_profile_name_change_preserves_company_id():
    app_source = read("app.js")
    handler_source = read("server/legacy-api/save-admin-profile.js")

    assert "id: previousId" in app_source
    assert "id: slugify(name)" not in app_source
    assert "requestedCompanyId !== admin.company_id" in handler_source
    assert "O company_id nao pode ser alterado pelo cadastro ADM." in handler_source


def test_config_accepts_standard_supabase_env_aliases_without_debug_logs():
    source = read("api/config.js")

    for name in [
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ]:
        assert name in source
    assert "console.info" not in source
    assert 'error: "Supabase nao configurado."' in source
    assert "supabaseAnonKey: anonKey.value" in source
    assert "supabaseUrl: url.value" in source


def test_save_predictions_does_not_mask_supabase_write_failures():
    source = read("server/legacy-api/save-predictions.js")

    assert "/rest/v1/palpites?on_conflict" not in source
    assert "/rest/v1/fase_final?on_conflict" not in source
    assert "saveMatchPrediction" in source
    assert "assertSavedRows" in source
    assert 'log(requestId, "supabase_write_failed"' in source
    assert "public.palpites: gravacao incompleta" in source
    assert "public.fase_final: gravacao incompleta" in source
