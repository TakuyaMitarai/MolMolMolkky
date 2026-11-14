// Per-game statistics for one player ("ゲームごとの成功率" tab).
//
// A throw record knows its game through matchId / matchDate / gameNumber
// (set when it is saved during a game). Records saved before those fields
// existed are matched back through any game that still holds their turn
// (TurnRecord.throwRecordId) — the current game and the archived ones keep
// the turns of their last game. Anything still unmatched (practice records
// from the 投擲記録 screen, or older games) goes into one "other" group.

export const GASHA = 'ガシャ'

function pct(success, total) {
  return total ? Math.round((success / total) * 100) : 0
}

// recordId -> { matchId, matchDate, gameNumber } from the turns we still have
export function indexTurnsByRecord(games) {
  const map = new Map()
  for (const g of games) {
    if (!g) continue
    for (const team of g.teams ?? []) {
      for (const turn of team.turnHistory ?? []) {
        if (turn.throwRecordId) {
          map.set(turn.throwRecordId, { matchId: g.id, matchDate: g.date, gameNumber: g.gameNumber })
        }
      }
    }
  }
  return map
}

/** Summary of a set of records: success rate (ガシャ excluded) and per throw type. */
export function summarizeRecords(records, typeOrder = []) {
  const byType = new Map()
  for (const r of records) {
    if (!byType.has(r.throwTypeName)) byType.set(r.throwTypeName, [])
    byType.get(r.throwTypeName).push(r)
  }
  const rank = (name) => {
    const i = typeOrder.indexOf(name)
    return i < 0 ? typeOrder.length : i
  }
  const types = [...byType.entries()]
    .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'ja'))
    .map(([name, rs]) => {
      const total = rs.length
      if (name === GASHA) {
        const pins = rs.reduce((sum, r) => sum + (Number(r.score) || 0), 0)
        return { name, isGasha: true, total, avgPins: Math.round((pins / total) * 10) / 10 }
      }
      const success = rs.filter((r) => r.isSuccessful).length
      return { name, isGasha: false, total, success, rate: pct(success, total) }
    })
  const rated = records.filter((r) => r.throwTypeName !== GASHA)
  const success = rated.filter((r) => r.isSuccessful).length
  return {
    total: records.length,
    ratedTotal: rated.length,
    success,
    rate: pct(success, rated.length),
    types,
  }
}

/**
 * Group one player's records by match and game, newest first.
 * Returns { matches: [{ matchId, matchDate, games: [{ gameNumber, firstDate, ...summary }] }], other }
 * where `other` is the summary of records with no known game (or null if none).
 */
export function groupRecordsByGame(records, games = [], typeOrder = []) {
  const fromTurns = indexTurnsByRecord(games)
  const matches = new Map()
  const other = []
  for (const r of records) {
    const tag = r.matchId ? r : fromTurns.get(r.id)
    if (!tag || !tag.matchId) {
      other.push(r)
      continue
    }
    if (!matches.has(tag.matchId)) {
      matches.set(tag.matchId, { matchId: tag.matchId, matchDate: tag.matchDate ?? r.date, games: new Map() })
    }
    const m = matches.get(tag.matchId)
    const n = Number(tag.gameNumber) || 1
    if (!m.games.has(n)) m.games.set(n, [])
    m.games.get(n).push(r)
  }
  const latest = (rs) => rs.reduce((max, r) => (r.date > max ? r.date : max), '')
  const list = [...matches.values()].map((m) => {
    const gamesList = [...m.games.entries()]
      .map(([gameNumber, rs]) => ({
        gameNumber,
        firstDate: rs.reduce((min, r) => (!min || r.date < min ? r.date : min), ''),
        lastDate: latest(rs),
        ...summarizeRecords(rs, typeOrder),
      }))
      .sort((a, b) => b.gameNumber - a.gameNumber)
    const all = [...m.games.values()].flat()
    return { matchId: m.matchId, matchDate: m.matchDate, lastDate: latest(all), games: gamesList, ...summarizeRecords(all, typeOrder) }
  })
  list.sort((a, b) => (b.lastDate > a.lastDate ? 1 : b.lastDate < a.lastDate ? -1 : 0))
  return { matches: list, other: other.length ? summarizeRecords(other, typeOrder) : null }
}
