import json
import subprocess


def run_access_check(participant, participants=None, participant_id=None):
    script = f"""
import {{
  findParticipantById,
  normalizeParticipantAccessRecord,
  participantCanAccess,
}} from './src/lib/participantAccess.mjs';
const participant = {json.dumps(participant)};
const participants = {json.dumps(participants or [])};
const normalized = normalizeParticipantAccessRecord(participant);
const found = findParticipantById(participants, {json.dumps(participant_id)});
console.log(JSON.stringify({{
  normalized,
  canAccess: participantCanAccess(normalized),
  found,
  foundCanAccess: participantCanAccess(found),
}}));
"""
    completed = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(completed.stdout)


def test_active_unblocked_auth_profile_can_access():
    data = run_access_check(
        {
            "id_participante": 1,
            "ativo": True,
            "access_blocked": False,
            "company_id": "prosperity",
        }
    )

    assert data["normalized"]["id_participante"] == "1"
    assert data["normalized"]["ativo"] == "True"
    assert data["normalized"]["access_blocked"] is False
    assert data["canAccess"] is True


def test_participant_normalization_accepts_id_fallback():
    data = run_access_check(
        {
            "id": 19,
            "ativo": True,
            "access_blocked": False,
            "company_id": "prosperity",
        }
    )

    assert data["normalized"]["id_participante"] == "19"
    assert data["canAccess"] is True


def test_participant_lookup_accepts_numeric_auth_id_and_string_loaded_id():
    data = run_access_check(
        None,
        participants=[
            {
                "id_participante": "1",
                "ativo": "True",
                "access_blocked": False,
                "company_id": "prosperity",
            }
        ],
        participant_id=1,
    )

    assert data["found"]["id_participante"] == "1"
    assert data["foundCanAccess"] is True


def test_blocked_or_inactive_participant_cannot_access():
    blocked = run_access_check(
        {"id_participante": 1, "ativo": True, "access_blocked": True}
    )
    inactive = run_access_check(
        {"id_participante": 1, "ativo": False, "access_blocked": False}
    )

    assert blocked["canAccess"] is False
    assert inactive["canAccess"] is False
