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
 * Faithful to recordScoreInternal: the exact-50 winning throw is NOT appended to
 * turnHistory (matches the Swift early-return), while miss/over-throw turns are.
 */
export function recordScore(inputGame, score) {
  const game = deepClone(inputGame)
  const teamIdx = game.currentTeamIndex
  const team = game.teams[teamIdx]
  const player = team.players[team.currentPlayerIndex]
  const completedAt = new Date().toISOString()

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

/**
 * Edit an already-recorded turn (score 0 = miss), then re-derive the full game
 * state consistently: recompute every team from its turnHistory, recompute
 * cumulative scores, and re-evaluate whether the game is finished (it may even
 * become un-finished if a winning throw is edited away).
 * Returns { game, ended }.
 */
export function editTurn(inputGame, teamIndex, turnIndex, newScore, newDetails) {
  const game = deepClone(inputGame)
  const turn = game.teams[teamIndex]?.turnHistory[turnIndex]
  if (!turn) return { game, ended: game.isFinished, statUpdate: null }

  turn.score = newScore
  turn.isMiss = newScore === 0
  if (newDetails) turn.details = { ...newDetails }

  // recompute all teams (one team's elimination affects "last team standing")
  for (const team of game.teams) recalcTeam(team)

  // drop this game's finish records so cumulative + finish recompute cleanly
  for (const team of game.teams) {
    team.gameResults = team.gameResults.filter((r) => r.gameNumber !== game.gameNumber)
  }
  updateAllCumulative(game)

  const activeIdx = game.teams.map((_, i) => i).filter((i) => !game.teams[i].isEliminated)
  const someAt50 = game.teams.some((t) => t.currentGameScore === TARGET)

  let ended = false
  if (someAt50 || activeIdx.length <= 1) {
    ended = true
    const winnerIndex = activeWinnerIndex(game)
    game.isFinished = true
    game.winner = game.teams[winnerIndex]
    finishAllTeams(game, winnerIndex, new Date().toISOString())
  } else {
    game.isFinished = false
    game.winner = null
    // if the active team pointer landed on an eliminated team, move it
    if (game.teams[game.currentTeamIndex]?.isEliminated && activeIdx.length) {
      game.currentTeamIndex = activeIdx[0]
    }
  }

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
 * Diff a popped snapshot against the restored one and return the stats
 * operations needed to roll the User.throwRecords back. Only turns that carry
 * a throwRecordId (registered player, details saved) produce operations —
 * plain/guest throws are correctly left untouched.
 *   - turns present only in popped (an undone throw) → 'remove'
 *   - turns present in both with the same id but a different score (an undone
 *     edit) → 'setScore' back to the restored value
 */
export function reconcileStats(poppedGame, restoredGame) {
  const ops = []
  poppedGame.teams.forEach((pT, ti) => {
    const rT = restoredGame.teams[ti]
    if (!rT) return

    // removed throws
    for (let k = rT.turnHistory.length; k < pT.turnHistory.length; k++) {
      const turn = pT.turnHistory[k]
      const player = pT.players[turn.playerIndex]
      if (turn.throwRecordId && player?.user) {
        ops.push({ type: 'remove', userId: player.user.id, recordId: turn.throwRecordId })
      }
    }

    // edited throws (same id, different score and/or details)
    const common = Math.min(pT.turnHistory.length, rT.turnHistory.length)
    for (let k = 0; k < common; k++) {
      const pTurn = pT.turnHistory[k]
      const rTurn = rT.turnHistory[k]
      if (
        pTurn.throwRecordId &&
        pTurn.throwRecordId === rTurn.throwRecordId &&
        (pTurn.score !== rTurn.score ||
          JSON.stringify(pTurn.details) !== JSON.stringify(rTurn.details))
      ) {
        const player = rT.players[rTurn.playerIndex]
        if (player?.user) {
          ops.push({
            type: 'update',
            userId: player.user.id,
            recordId: rTurn.throwRecordId,
            score: rTurn.score,
            details: rTurn.details,
          })
        }
      }
    }
  })
  return ops
}
