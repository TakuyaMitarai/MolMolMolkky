import { describe, it, expect } from 'vitest'
import { serializeCsv, parseCsv, mergeUsers } from '../csv.js'
import { createUser, createThrowRecord } from '../models.js'

describe('CSV round-trip', () => {
  it('preserves users and throw records', () => {
    const u1 = createUser('山田')
    u1.throwRecords.push(
      createThrowRecord({ throwTypeName: '横投げ', distance: 5, score: 8, isSuccessful: true })
    )
    u1.throwRecords.push(
      createThrowRecord({ throwTypeName: 'ガシャ', distance: 4, score: 12, isSuccessful: true, notes: 'メモ, あり' })
    )
    const u2 = createUser('田中') // no throws

    const csv = serializeCsv([u1, u2])
    const parsed = parseCsv(csv)

    expect(parsed.map((u) => u.name)).toEqual(['山田', '田中'])
    expect(parsed[0].throwRecords).toHaveLength(2)
    expect(parsed[1].throwRecords).toHaveLength(0) // user-only row survives
    expect(parsed[0].throwRecords[1].notes).toBe('メモ, あり') // comma in quoted field
    expect(parsed[0].throwRecords[0].score).toBe(8)
  })
})

describe('mergeUsers', () => {
  function userWith(name, recs) {
    const u = createUser(name)
    u.throwRecords = recs.map((r) => createThrowRecord(r))
    return u
  }

  it('adds new users, merges records, dedupes, and keeps untouched users', () => {
    const recA = { throwTypeName: '横投げ', distance: 5, score: 8, date: '2026-01-01T00:00:00.000Z' }
    const recB = { throwTypeName: '縦投げ', distance: 6, score: 4, date: '2026-01-02T00:00:00.000Z' }
    const recC = { throwTypeName: 'ガシャ', distance: 4, score: 12, date: '2026-01-03T00:00:00.000Z' }

    const existing = [userWith('山田', [recA]), userWith('佐藤', [recC])]
    const imported = [userWith('山田', [recA, recB]), userWith('田中', [recB])]

    const { users, stats } = mergeUsers(existing, imported)

    const yamada = users.find((u) => u.name === '山田')
    expect(yamada.throwRecords).toHaveLength(2) // recA kept (dedup), recB added
    expect(users.find((u) => u.name === '佐藤')).toBeTruthy() // untouched
    expect(users.find((u) => u.name === '田中')).toBeTruthy() // new
    expect(stats).toEqual({ usersAdded: 1, usersMerged: 1, recordsAdded: 2 })
  })

  it('does not mutate the input arrays', () => {
    const existing = [userWith('山田', [{ throwTypeName: '横投げ', distance: 5, score: 8, date: 'x' }])]
    const imported = [userWith('山田', [{ throwTypeName: '縦投げ', distance: 6, score: 4, date: 'y' }])]
    mergeUsers(existing, imported)
    expect(existing[0].throwRecords).toHaveLength(1) // original untouched
  })
})
