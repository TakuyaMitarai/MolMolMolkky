import { describe, it, expect } from 'vitest'
import { serializeCsv, parseCsv } from '../csv.js'
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
