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

    assert "async function authHeaders()" in repository
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
