// Pure Mölkky game logic — ported from GameView.swift.
// Functions take a `game` object and return a NEW game (immutable style);
// callers replace their reactive state with the result.

import { createTurnRecord, deepClone } from './models.js'

const TARGET = 50

// ----- cumulative score helpers -----
export function updateCumulativeScore(team) {
  const previous = team.gameResults.reduce((s, r) => s + r.finalScore, 0)
  team.cumulativeScore = previous + team.currentGameScore
}

function updateAllCumulative(game) {
  for (const team of game.teams) updateCumulativeScore(team)
}

function finishGameForTeam(team, gameNumber, finalScore, isWinner, completedAt) {
  team.gameResults.push({ gameNumber, finalScore, isWinner, completedAt })
  // On game end cumulative = sum of recorded game results.
  team.cumulativeScore = team.gameResults.reduce((s, r) => s + r.finalScore, 0)
}

function finishAllTeams(game, winnerIndex, completedAt) {
  for (let i = 0; i < game.teams.length; i++) {
    finishGameForTeam(
      game.teams[i],
      game.gameNumber,
      game.teams[i].currentGameScore,
      i === winnerIndex,
      completedAt
    )
  }
}

// Winner = active (non-eliminated) team with the highest cumulative score.
// Falls back to all teams if every team is eliminated.
function activeWinnerIndex(game) {
  const active = game.teams.map((_, i) => i).filter((i) => !game.teams[i].isEliminated)
  const pool = active.length ? active : game.teams.map((_, i) => i)
  let win = pool[0] ?? 0
  for (const i of pool) {
    if (game.teams[i].cumulativeScore > game.teams[win].cumulativeScore) win = i
  }
  return win
}

function eliminate(team) {
  team.isEliminated = true
  team.currentGameScore = 0
  team.missCount = 0
}

// Next monotonic play-order index across all turns in the current game.
function nextSeq(game) {
  let m = 0
  for (const t of game.teams) {
    for (const tr of t.turnHistory) {
      if (typeof tr.seq === 'number' && tr.seq > m) m = tr.seq
    }
  }
  return m + 1
}

// ----- player rotation -----
function turnsSinceLastThrow(team, playerIndex) {
  for (let i = team.turnHistory.length - 1; i >= 0; i--) {
    if (team.turnHistory[i].playerIndex === playerIndex) {
      return team.turnHistory.length - i - 1
    }
  }
  return Infinity // never thrown → highest priority
}

function selectNextPlayerForTeam(team) {
  let best = -1
  let bestTurns = -1
  team.players.forEach((_, idx) => {
    const t = turnsSinceLastThrow(team, idx)
    if (t > bestTurns) {
      bestTurns = t
      best = idx
    }
  })
  if (best >= 0) return best
  return (team.currentPlayerIndex + 1) % team.players.length
}

// Advance to the next active team; auto-rotate players on full lap.
// Returns true if the active team changed.
function moveToNextPlayer(game) {
  const activeOffsets = []
  game.teams.forEach((t, i) => {
    if (!t.isEliminated) activeOffsets.push(i)
  })
  if (activeOffsets.length === 0) return false

  const currentActiveIndex = activeOffsets.indexOf(game.currentTeamIndex)

  if (currentActiveIndex === -1) {
    // current team got eliminated — jump to next active team
    const old = game.currentTeamIndex
    const after = activeOffsets.find((o) => o > game.currentTeamIndex)
    game.currentTeamIndex = after !== undefined ? after : activeOffsets[0]
    return old !== game.currentTeamIndex
  }

  const nextActiveIndex = (currentActiveIndex + 1) % activeOffsets.length
  const nextTeamIndex = activeOffsets[nextActiveIndex]
  const teamWillChange = nextTeamIndex !== game.currentTeamIndex

  if (nextActiveIndex === 0) {
    // full lap completed — auto-select next thrower for each active team
    for (let i = 0; i < game.teams.length; i++) {
      if (!game.teams[i].isEliminated) {
        game.teams[i].currentPlayerIndex = selectNextPlayerForTeam(game.teams[i])
      }
    }
  }

  game.currentTeamIndex = nextTeamIndex
  return teamWillChange
}

/**
 * Record a throw (score 0 = miss). Returns { game, ended, eliminatedName, teamChanged }.
 * Every throw (including the exact-50 winning throw) is appended to turnHistory
 * and stamped with a monotonic play-order seq used by undoLastThrow.
 */
export function recordScore(inputGame, score) {
  const game = deepClone(inputGame)
  const teamIdx = game.currentTeamIndex
  const team = game.teams[teamIdx]
  const player = team.players[team.currentPlayerIndex]
  const completedAt = new Date().toISOString()
  const seq = nextSeq(game)

  let ended = false
  let eliminatedName = null

  if (score === 0) {
    // ----- miss -----
    team.missCount += 1
    team.turnHistory.push(
      createTurnRecord({
        playerName: player.name,
        playerIndex: team.currentPlayerIndex,
        score: 0,
        isMiss: true,
        seq,
      })
    )
    if (team.missCount >= 3) {
      eliminate(team)
      const active = game.teams.filter((t) => !t.isEliminated)
      if (active.length <= 1) {
        ended = true
        updateAllCumulative(game)
        const winnerIndex = game.teams.findIndex((t) => !t.isEliminated)
        const wi = winnerIndex >= 0 ? winnerIndex : 0
        game.isFinished = true
        game.winner = game.teams[wi]
        finishAllTeams(game, wi, completedAt)
      } else {
        eliminatedName = team.name
      }
    }
  } else {
    // ----- scoring throw -----
    const newScore = team.currentGameScore + score
    team.currentGameScore = newScore > 50 ? 25 : newScore
    team.missCount = 0
    // The throw is always recorded in turnHistory — including the exact-50
    // winning throw — so the scoreboard shows it.
    team.turnHistory.push(
      createTurnRecord({
        playerName: player.name,
        playerIndex: team.currentPlayerIndex,
        score,
        isMiss: false,
        seq,
      })
    )
    if (newScore === TARGET) {
      ended = true
      updateAllCumulative(game)
      const winnerIndex = activeWinnerIndex(game)
      game.isFinished = true
      game.winner = game.teams[winnerIndex]
      finishAllTeams(game, winnerIndex, completedAt)
    }
  }

  let teamChanged = false
  if (!ended) {
    teamChanged = moveToNextPlayer(game)
    updateAllCumulative(game)
  }

  return { game, ended, eliminatedName, teamChanged }
}

// Manually set the active team's current player (player switch UI).
export function selectPlayer(inputGame, playerIndex) {
  const game = deepClone(inputGame)
  if (game.currentTeamIndex >= 0 && game.currentTeamIndex < game.teams.length) {
    game.teams[game.currentTeamIndex].currentPlayerIndex = playerIndex
  }
  return game
}

// Recompute a single team's score / missCount / elimination from its
// turnHistory, using the SAME rule as live play: 3 consecutive misses
// eliminate the team (score frozen at 0); turns after elimination are ignored.
function recalcTeam(team) {
  let total = 0
  let miss = 0
  let eliminated = false
  for (const turn of team.turnHistory) {
    if (eliminated) break
    if (turn.isMiss) {
      miss += 1
      if (miss >= 3) {
        eliminated = true
        total = 0
        miss = 0
      }
    } else {
      total += turn.score
      miss = 0
      if (total > 50) total = 25
    }
  }
  team.currentGameScore = total
  team.missCount = miss
  team.isEliminated = eliminated
}

// Re-derive scores, cumulative, finish/winner from the current turnHistory.
// Used after an edit or an undo so the whole game stays consistent.
// Returns true if the game is finished.
function rederive(game) {
  for (const team of game.teams) recalcTeam(team)
  for (const team of game.teams) {
    team.gameResults = team.gameResults.filter((r) => r.gameNumber !== game.gameNumber)
  }
  updateAllCumulative(game)

  const activeIdx = game.teams.map((_, i) => i).filter((i) => !game.teams[i].isEliminated)
  const someAt50 = game.teams.some((t) => t.currentGameScore === TARGET)

  if (someAt50 || activeIdx.length <= 1) {
    const winnerIndex = activeWinnerIndex(game)
    game.isFinished = true
    game.winner = game.teams[winnerIndex]
    finishAllTeams(game, winnerIndex, new Date().toISOString())
    return true
  }
  game.isFinished = false
  game.winner = null
  if (game.teams[game.currentTeamIndex]?.isEliminated && activeIdx.length) {
    game.currentTeamIndex = activeIdx[0]
  }
  return false
}

/**
 * Edit an already-recorded turn (score 0 = miss), then re-derive the full game
 * state consistently. The game may even become un-finished if a winning throw
 * is edited away. Returns { game, ended, statUpdate }.
 */
export function editTurn(inputGame, teamIndex, turnIndex, newScore, newDetails) {
  const game = deepClone(inputGame)
  const turn = game.teams[teamIndex]?.turnHistory[turnIndex]
  if (!turn) return { game, ended: game.isFinished, statUpdate: null }

  turn.score = newScore
  turn.isMiss = newScore === 0
  if (newDetails) turn.details = { ...newDetails }

  const ended = rederive(game)

  // If this turn had a linked stats record (registered player, details saved),
  // report the new score + details so the caller can overwrite that record.
  let statUpdate = null
  const player = game.teams[teamIndex].players[turn.playerIndex]
  if (turn.throwRecordId && player?.user) {
    statUpdate = {
      userId: player.user.id,
      recordId: turn.throwRecordId,
      score: newScore,
      details: turn.details,
    }
  }

  return { game, ended, statUpdate }
}

// Reset for the next game in a series (keeps gameResults & cumulativeScore).
export function resetForNextGame(inputGame, orderedTeams) {
  const game = deepClone(inputGame)
  if (orderedTeams) game.teams = deepClone(orderedTeams)
  for (const team of game.teams) {
    team.currentGameScore = 0
    team.missCount = 0
    team.turnHistory = []
    team.currentPlayerIndex = 0
    team.isEliminated = false
    team.selectedSkittles = []
  }
  game.currentTeamIndex = 0
  game.gameNumber += 1
  game.isFinished = false
  game.winner = null
  return game
}

/**
 * Undo the most recent throw in GAME-PROGRESS order — i.e. the turn with the
 * latest timestamp across all teams — regardless of any edits made meanwhile.
 * Removes that turn, re-derives game state, and makes it that team's turn again
 * with the player who threw it. Returns { game, statRemoval } where statRemoval
 * (or null) is the linked throwRecord to delete from the user's stats.
 */
export function undoLastThrow(inputGame) {
  const game = deepClone(inputGame)

  // find the team whose last turn is globally latest. Prefer the monotonic seq;
  // fall back to timestamp for older saved data without seq.
  let bestTeam = -1
  let best = null // { seq, ts }
  const isLater = (cand, cur) => {
    if (!cur) return true
    const cs = typeof cand.seq === 'number' && cand.seq > 0
    const us = typeof cur.seq === 'number' && cur.seq > 0
    if (cs && us) return cand.seq > cur.seq
    if (cs !== us) return cs // a seq'd turn is newer than a non-seq'd one
    return cand.ts > cur.ts
  }
  game.teams.forEach((t, i) => {
    if (!t.turnHistory.length) return
    const last = t.turnHistory[t.turnHistory.length - 1]
    const cand = { seq: last.seq, ts: last.timestamp }
    if (isLater(cand, best)) {
      best = cand
      bestTeam = i
    }
  })
  if (bestTeam < 0) return { game, statRemoval: null } // nothing to undo

  const team = game.teams[bestTeam]
  const removed = team.turnHistory.pop()

  rederive(game)

  // it's that team's turn again, with the player who threw the removed turn
  game.currentTeamIndex = bestTeam
  team.currentPlayerIndex = removed.playerIndex

  let statRemoval = null
  const player = team.players[removed.playerIndex]
  if (removed.throwRecordId && player?.user) {
    statRemoval = { userId: player.user.id, recordId: removed.throwRecordId }
  }

  return { game, statRemoval }
}
