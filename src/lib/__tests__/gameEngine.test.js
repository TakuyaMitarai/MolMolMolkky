import { describe, it, expect } from 'vitest'
import { recordScore, resetForNextGame, editTurn, reconcileStats } from '../gameEngine.js'
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

  it('editTurn reports a statUpdate when the turn is linked to a record', () => {
    let g = registeredTwoTeam()
    g = recordScore(g, 5).game
    g.teams[0].turnHistory[0].throwRecordId = 'rec-1' // simulate a saved stats record
    const { statUpdate } = editTurn(g, 0, 0, 9)
    expect(statUpdate).toMatchObject({ recordId: 'rec-1', newScore: 9 })
  })

  it('editTurn returns null statUpdate for a turn with no linked record', () => {
    let g = registeredTwoTeam()
    g = recordScore(g, 5).game // no throwRecordId set
    const { statUpdate } = editTurn(g, 0, 0, 9)
    expect(statUpdate).toBe(null)
  })

  it('reconcileStats removes an added throw and reverts an edited score (by id only)', () => {
    let g = registeredTwoTeam()
    g = recordScore(g, 5).game
    g.teams[0].turnHistory[0].throwRecordId = 'rec-1'
    const before = JSON.parse(JSON.stringify(g)) // has 1 linked turn @ score 5
    const after = recordScore(g, 3).game // B throws (no record) -> length grows for B only

    // undo of B's throw: B turn has no throwRecordId -> no stats op
    expect(reconcileStats(after, g)).toHaveLength(0)

    // edit A's turn 5 -> 9, then reconcile back to `before`
    const edited = editTurn(g, 0, 0, 9).game
    const ops = reconcileStats(edited, before)
    expect(ops).toEqual([{ type: 'setScore', userId: expect.any(String), recordId: 'rec-1', newScore: 5 }])
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
