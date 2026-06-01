import { describe, it, expect } from 'vitest'
import { recordScore, resetForNextGame, editTurn, undoLastThrow } from '../gameEngine.js'
import { createGameRecord, createTeam, createPlayer, createUser } from '../models.js'

function twoTeamGame() {
  return createGameRecord([
    createTeam('A', [createPlayer('a')]),
    createTeam('B', [createPlayer('b')]),
  ])
}

describe('recordScore', () => {
  it('adds points and advances to the next team', () => {
    const g0 = twoTeamGame()
    const { game, teamChanged } = recordScore(g0, 5)
    expect(game.teams[0].currentGameScore).toBe(5)
    expect(game.teams[0].turnHistory).toHaveLength(1)
    expect(game.currentTeamIndex).toBe(1)
    expect(teamChanged).toBe(true)
  })

  it('over 50 resets to 25', () => {
    const g = twoTeamGame()
    g.teams[0].currentGameScore = 45
    const { game } = recordScore(g, 10) // 55 -> 25
    expect(game.teams[0].currentGameScore).toBe(25)
  })

  it('exactly 50 wins the game and records the winning throw (fix ①)', () => {
    const g = twoTeamGame()
    g.teams[0].currentGameScore = 44
    const { game, ended } = recordScore(g, 6)
    expect(ended).toBe(true)
    expect(game.isFinished).toBe(true)
    expect(game.winner.name).toBe('A')
    expect(game.teams[0].gameResults).toHaveLength(1)
    // the winning throw appears in turnHistory
    expect(game.teams[0].turnHistory.at(-1)).toMatchObject({ score: 6, isMiss: false })
  })

  it('three consecutive misses eliminate the team', () => {
    let g = twoTeamGame()
    // team A misses three times (team B fills between)
    g = recordScore(g, 0).game // A miss 1, -> B
    g = recordScore(g, 3).game // B scores -> A
    g = recordScore(g, 0).game // A miss 2 -> B
    g = recordScore(g, 3).game // B -> A
    const res = recordScore(g, 0) // A miss 3 -> eliminated, only B left => ended
    expect(res.game.teams[0].isEliminated).toBe(true)
    expect(res.ended).toBe(true)
    expect(res.game.winner.name).toBe('B')
  })
})

describe('editTurn (fix ②)', () => {
  it('recomputes score after editing a turn', () => {
    let g = twoTeamGame()
    g = recordScore(g, 5).game // A: 5 -> B
    g = recordScore(g, 3).game // B: 3 -> A
    // edit A's first turn from 5 to 10
    const { game } = editTurn(g, 0, 0, 10)
    expect(game.teams[0].currentGameScore).toBe(10)
  })

  it('eliminates a team when an edit creates 3 consecutive misses', () => {
    let g = twoTeamGame()
    g = recordScore(g, 2).game // A miss-free, score 2 -> B
    g = recordScore(g, 3).game // B -> A
    g = recordScore(g, 0).game // A miss1 -> B
    g = recordScore(g, 3).game // B -> A
    g = recordScore(g, 0).game // A miss2 -> B
    g = recordScore(g, 3).game // B -> A
    // A turns so far: [2, miss, miss]. Edit the first (2) into a miss => 3 misses.
    const { game, ended } = editTurn(g, 0, 0, 0)
    expect(game.teams[0].isEliminated).toBe(true)
    expect(ended).toBe(true) // only B remains
    expect(game.winner.name).toBe('B')
  })

  it('can un-finish a game when the winning throw is edited away', () => {
    let g = twoTeamGame()
    g.teams[0].currentGameScore = 44
    g = recordScore(g, 6).game // A wins at 50
    expect(g.isFinished).toBe(true)
    const { game, ended } = editTurn(g, 0, g.teams[0].turnHistory.length - 1, 3) // 6 -> 3
    expect(ended).toBe(false)
    expect(game.isFinished).toBe(false)
    expect(game.winner).toBe(null)
  })
})

describe('stats linkage (edit + undo)', () => {
  function registeredTwoTeam() {
    const u = createUser('登録花子')
    return createGameRecord([
      createTeam('A', [createPlayer('登録花子', { isRegistered: true, user: u })]),
      createTeam('B', [createPlayer('b')]),
    ])
  }

  it('editTurn reports a statUpdate (score + details) when linked to a record', () => {
    let g = registeredTwoTeam()
    g = recordScore(g, 5).game
    g.teams[0].turnHistory[0].throwRecordId = 'rec-1' // simulate a saved stats record
    const newDetails = { throwTypeName: '縦投げ', distance: 7, isSuccessful: true, notes: null }
    const { statUpdate } = editTurn(g, 0, 0, 9, newDetails)
    expect(statUpdate).toMatchObject({ recordId: 'rec-1', score: 9, details: newDetails })
  })

  it('editTurn returns null statUpdate for a turn with no linked record', () => {
    let g = registeredTwoTeam()
    g = recordScore(g, 5).game // no throwRecordId set
    const { statUpdate } = editTurn(g, 0, 0, 9)
    expect(statUpdate).toBe(null)
  })

  it('undoLastThrow reports the linked stats record to remove', () => {
    let g = registeredTwoTeam()
    g = recordScore(g, 5).game // A throws
    g.teams[0].turnHistory[0].throwRecordId = 'rec-1'
    g = recordScore(g, 3).game // B throws (latest)
    // latest throw is B's (no record) -> no stat removal
    let res = undoLastThrow(g)
    expect(res.statRemoval).toBe(null)
    expect(res.game.teams[1].turnHistory).toHaveLength(0)
    // now A's throw is latest -> undoing it removes rec-1
    res = undoLastThrow(res.game)
    expect(res.statRemoval).toMatchObject({ recordId: 'rec-1' })
    expect(res.game.teams[0].turnHistory).toHaveLength(0)
  })
})

describe('undoLastThrow (game-progress order)', () => {
  function twoTeam() {
    return createGameRecord([
      createTeam('A', [createPlayer('a')]),
      createTeam('B', [createPlayer('b')]),
    ])
  }

  it('removes the latest throw, not an edited older one', () => {
    let g = twoTeam()
    g = recordScore(g, 5).game // T1 A=5
    g = recordScore(g, 3).game // T2 B=3
    g = recordScore(g, 4).game // T3 A=9 (latest is A's 4)
    // edit A's FIRST turn (older) from 5 -> 2
    g = editTurn(g, 0, 0, 2).game
    expect(g.teams[0].currentGameScore).toBe(6) // 2 + 4

    // undo should remove A's latest throw (the 4), not revert the edit
    const { game } = undoLastThrow(g)
    expect(game.teams[0].turnHistory.map((t) => t.score)).toEqual([2]) // edit kept, last removed
    expect(game.teams[0].currentGameScore).toBe(2)
    expect(game.currentTeamIndex).toBe(0) // A throws again
  })

  it('un-finishes the game when the winning throw is undone', () => {
    let g = twoTeam()
    g.teams[0].currentGameScore = 44
    // give the team a prior turn so currentGameScore reflects history on rederive
    g.teams[0].turnHistory.push({ id: 'x', playerName: 'a', playerIndex: 0, timestamp: '2026-01-01T00:00:00.000Z', score: 44, isMiss: false, throwRecordId: null, details: null })
    g = recordScore(g, 6).game // wins at 50
    expect(g.isFinished).toBe(true)
    const { game } = undoLastThrow(g)
    expect(game.isFinished).toBe(false)
    expect(game.teams[0].currentGameScore).toBe(44)
  })
})

describe('resetForNextGame', () => {
  it('keeps cumulative results but clears the current game', () => {
    const g = twoTeamGame()
    g.teams[0].gameResults.push({ gameNumber: 1, finalScore: 50, isWinner: true, completedAt: '' })
    g.teams[0].cumulativeScore = 50
    g.teams[0].currentGameScore = 50
    const next = resetForNextGame(g)
    expect(next.gameNumber).toBe(2)
    expect(next.teams[0].currentGameScore).toBe(0)
    expect(next.teams[0].gameResults).toHaveLength(1)
    expect(next.isFinished).toBe(false)
  })
})
