// Room versions and rounds come from PostgreSQL, never from peer broadcasts.
export function roomRound(room) {
  const round = room?.state?.round
  return Number.isSafeInteger(round) && round > 0 ? round : 1
}

export function acceptsRoomSnapshot(current, incoming) {
  return !current || current.id !== incoming.id || incoming.version >= current.version
}

export function isCurrentRoundPayload(room, payload) {
  return Boolean(room && payload && typeof payload === 'object' && payload.round === roomRound(room))
}

export function onlineErrorMessage(error) {
  if (error && typeof error === 'object' && typeof error.message === 'string') return error.message
  return typeof error === 'string' ? error : ''
}
