// Domain model factory functions — plain JS objects mirroring the Swift structs.
// IDs use crypto.randomUUID(). Dates are ISO 8601 strings (JSON/CSV friendly).

export function uuid() {
  return crypto.randomUUID()
}

export function nowIso() {
  return new Date().toISOString()
}

// ----- User & throw records -----
export function createUser(name) {
  return {
    id: uuid(),
    name,
    registrationDate: nowIso(),
    throwRecords: [],
  }
}

export function createThrowRecord({
  throwTypeName,
  distance,
  score,
  isSuccessful = true,
  notes = null,
  date = nowIso(),
  id = uuid(),
}) {
  return { id, date, throwTypeName, distance, score, isSuccessful, notes }
}

// ----- Throw types -----
export function createThrowType(name, { isDefault = false, isDeletable = true } = {}) {
  return { id: uuid(), name, isDefault, isDeletable }
}

export function defaultThrowTypes() {
  return [
    createThrowType('横投げ', { isDefault: true, isDeletable: true }),
    createThrowType('縦投げ', { isDefault: true, isDeletable: true }),
    createThrowType('ふわ投げ', { isDefault: true, isDeletable: true }),
    createThrowType('バック', { isDefault: true, isDeletable: true }),
    createThrowType('ガシャ', { isDefault: true, isDeletable: false }),
  ]
}

// ----- Game / team / player -----
export function createPlayer(name, { isRegistered = false, user = null } = {}) {
  return { id: uuid(), name, isRegistered, user }
}

export function createTeam(name, players) {
  return {
    id: uuid(),
    name,
    players,
    currentGameScore: 0,
    turnHistory: [],
    missCount: 0,
    currentPlayerIndex: 0,
    gameResults: [], // { gameNumber, finalScore, isWinner, completedAt }
    cumulativeScore: 0,
    isEliminated: false,
    selectedSkittles: [], // Set serialized as array
  }
}

export function createTurnRecord({ playerName, playerIndex, score, isMiss = false }) {
  return {
    id: uuid(),
    playerName,
    playerIndex,
    score,
    timestamp: nowIso(),
    isMiss,
    throwRecordId: null, // links to a User.throwRecords entry (stats) when one was saved
  }
}

export function createGameRecord(teams) {
  return {
    id: uuid(),
    date: nowIso(),
    teams,
    currentTeamIndex: 0,
    currentPlayerIndex: 0,
    gameNumber: 1,
    isFinished: false,
    winner: null,
  }
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
