import { describe, it, expect } from 'vitest'
import { groupRecordsByGame, summarizeRecords } from '../gameStats.js'
import { serializeCsv, parseCsv } from '../csv.js'

const rec = (o) => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  date: o.date ?? '2026-11-14T12:00:00.000Z',
  throwTypeName: o.type ?? '横投げ',
  distance: 4,
  score: o.score ?? 5,
  isSuccessful: o.ok ?? true,
  notes: null,
  matchId: o.matchId ?? null,
  matchDate: o.matchDate ?? null,
  gameNumber: o.gameNumber ?? null,
})

describe('summarizeRecords', () => {
  it('rates success without gasha and averages gasha pins', () => {
    const s = summarizeRecords(
      [rec({ ok: true }), rec({ ok: false }), rec({ type: 'ガシャ', score: 3 }), rec({ type: 'ガシャ', score: 6 })],
      ['横投げ', 'ガシャ']
    )
    expect(s.total).toBe(4)
    expect(s.ratedTotal).toBe(2)
    expect(s.rate).toBe(50)
    expect(s.types.map((t) => t.name)).toEqual(['横投げ', 'ガシャ'])
    expect(s.types[1].avgPins).toBe(4.5)
  })
})

describe('groupRecordsByGame', () => {
  it('groups by match and game, newest first, and keeps the rest apart', () => {
    const recs = [
      rec({ matchId: 'A', matchDate: '2026-11-13T10:00:00Z', gameNumber: 1, date: '2026-11-13T10:05:00Z' }),
      rec({ matchId: 'A', matchDate: '2026-11-13T10:00:00Z', gameNumber: 2, date: '2026-11-13T10:30:00Z', ok: false }),
      rec({ matchId: 'B', matchDate: '2026-11-14T10:00:00Z', gameNumber: 1, date: '2026-11-14T10:05:00Z' }),
      rec({ date: '2026-11-12T10:00:00Z' }),
    ]
    const { matches, other } = groupRecordsByGame(recs)
    expect(matches.map((m) => m.matchId)).toEqual(['B', 'A'])
    expect(matches[1].games.map((g) => g.gameNumber)).toEqual([2, 1])
    expect(matches[1].games[0].rate).toBe(0)
    expect(other.total).toBe(1)
  })

  it('finds the game of older untagged records through the turn history', () => {
    const r = rec({ id: 'r1' })
    const game = {
      id: 'M',
      date: '2026-11-10T09:00:00Z',
      gameNumber: 3,
      teams: [{ turnHistory: [{ throwRecordId: 'r1' }] }],
    }
    const { matches, other } = groupRecordsByGame([r], [game])
    expect(other).toBeNull()
    expect(matches[0].matchId).toBe('M')
    expect(matches[0].games[0].gameNumber).toBe(3)
  })
})

describe('csv keeps the game of a record', () => {
  it('round-trips matchId / matchDate / gameNumber and reads old files', () => {
    const users = [
      {
        name: '山田',
        registrationDate: '2026-11-01T00:00:00Z',
        throwRecords: [rec({ matchId: 'A', matchDate: '2026-11-13T10:00:00Z', gameNumber: 2 }), rec({})],
      },
    ]
    const back = parseCsv(serializeCsv(users))[0].throwRecords
    expect(back[0]).toMatchObject({ matchId: 'A', matchDate: '2026-11-13T10:00:00Z', gameNumber: 2 })
    expect(back[1]).toMatchObject({ matchId: null, gameNumber: null })

    const old = 'name,registrationDate,recordDate,throwTypeName,distance,score,isSuccessful,notes\n山田,2026-11-01,2026-11-02T00:00:00Z,横投げ,4,1,true,\n'
    expect(parseCsv(old)[0].throwRecords[0]).toMatchObject({ matchId: null, gameNumber: null })
  })
})
