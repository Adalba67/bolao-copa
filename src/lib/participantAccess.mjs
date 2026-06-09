export function normalizeParticipantId(value) {
  return value === null || value === undefined ? "" : String(value);
}

export function participantIsActive(participant) {
  return participant?.ativo === true || String(participant?.ativo).toLowerCase() === "true";
}

export function participantAccessBlocked(participant) {
  return participant?.access_blocked === true || String(participant?.access_blocked).toLowerCase() === "true";
}

export function participantCanAccess(participant) {
  return Boolean(participant && participantIsActive(participant) && !participantAccessBlocked(participant));
}

export function normalizeParticipantAccessRecord(participant) {
  if (!participant) return null;
  const participantId = participant.id_participante ?? participant.id;
  return {
    ...participant,
    id_participante: normalizeParticipantId(participantId),
    ativo: participantIsActive(participant) ? "True" : "False",
    access_blocked: participantAccessBlocked(participant),
  };
}

export function findParticipantById(participants, participantId) {
  const normalizedId = normalizeParticipantId(participantId);
  if (!normalizedId) return null;
  return participants.find((participant) =>
    normalizeParticipantId(participant.id_participante) === normalizedId
  ) || null;
}
