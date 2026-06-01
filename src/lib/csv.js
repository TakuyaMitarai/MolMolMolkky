// Single-CSV serialization for users + their throw records (RFC4180-ish).
// Columns: name,registrationDate,recordDate,throwTypeName,distance,score,isSuccessful,notes
// A user with no throws is written as one row with empty recordDate onward,
// so registered-but-unused players survive an export/import round-trip.

import { uuid, deepClone } from './models.js'

const HEADER = [
  'name',
  'registrationDate',
  'recordDate',
  'throwTypeName',
  'distance',
  'score',
  'isSuccessful',
  'notes',
]

function escapeField(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

export function serializeCsv(users) {
  const lines = [HEADER.join(',')]
  for (const user of users) {
    if (user.throwRecords.length === 0) {
      lines.push(
        [escapeField(user.name), escapeField(user.registrationDate), '', '', '', '', '', ''].join(',')
      )
      continue
    }
    for (const r of user.throwRecords) {
      lines.push(
        [
          escapeField(user.name),
          escapeField(user.registrationDate),
          escapeField(r.date),
          escapeField(r.throwTypeName),
          escapeField(r.distance),
          escapeField(r.score),
          escapeField(r.isSuccessful),
          escapeField(r.notes),
        ].join(',')
      )
    }
  }
  return lines.join('\n') + '\n'
}

// Minimal RFC4180 parser that handles quoted fields with embedded commas/quotes/newlines.
function parseRows(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let i = 0
  const n = text.length

  while (i < n) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\n' || c === '\r') {
      // handle CRLF
      if (c === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += c
    i += 1
  }
  // flush trailing field/row if any content
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

// Returns an array of users reconstructed from CSV text.
export function parseCsv(text) {
  const rows = parseRows(text).filter((r) => r.some((c) => c.trim() !== ''))
  if (rows.length === 0) return []

  // skip header if present
  let start = 0
  const first = rows[0].map((c) => c.trim().toLowerCase())
  if (first[0] === 'name' && first.includes('throwtypename')) start = 1

  const byName = new Map()
  const order = []

  for (let r = start; r < rows.length; r++) {
    const [name, registrationDate, recordDate, throwTypeName, distance, score, isSuccessful, notes] =
      rows[r]
    const trimmedName = (name || '').trim()
    if (!trimmedName) continue

    if (!byName.has(trimmedName)) {
      byName.set(trimmedName, {
        id: uuid(),
        name: trimmedName,
        registrationDate: registrationDate || new Date().toISOString(),
        throwRecords: [],
      })
      order.push(trimmedName)
    }
    const user = byName.get(trimmedName)

    // user-only row → no throw record
    if (!recordDate || recordDate.trim() === '') continue

    user.throwRecords.push({
      id: uuid(),
      date: recordDate,
      throwTypeName: throwTypeName || '',
      distance: distance === '' || distance == null ? 0 : Number(distance),
      score: score === '' || score == null ? 0 : Number(score),
      isSuccessful: String(isSuccessful).toLowerCase() !== 'false',
      notes: notes && notes.length ? notes : null,
    })
  }

  return order.map((nm) => byName.get(nm))
}

// Content-based identity for a throw record (ids are not stable across a
// CSV export/import round-trip, so we dedupe by the meaningful fields).
export function recordKey(r) {
  return [r.date, r.throwTypeName, r.distance, r.score, r.isSuccessful, r.notes ?? ''].join('|')
}

/**
 * Merge imported users into existing users (non-destructive):
 *   - users matched by name; new users are appended
 *   - throw records deduped by recordKey, only new ones added
 *   - existing users absent from the import are kept untouched
 * Returns { users, stats:{ usersAdded, usersMerged, recordsAdded } } (pure).
 */
export function mergeUsers(existingUsers, importedUsers) {
  const users = deepClone(existingUsers)
  const byName = new Map(users.map((u) => [u.name, u]))
  let usersAdded = 0
  let usersMerged = 0
  let recordsAdded = 0

  for (const iu of importedUsers) {
    const existing = byName.get(iu.name)
    if (!existing) {
      const clone = deepClone(iu)
      users.push(clone)
      byName.set(clone.name, clone)
      usersAdded += 1
      recordsAdded += clone.throwRecords.length
    } else {
      usersMerged += 1
      const keys = new Set(existing.throwRecords.map(recordKey))
      for (const r of iu.throwRecords) {
        const k = recordKey(r)
        if (!keys.has(k)) {
          existing.throwRecords.push(deepClone(r))
          keys.add(k)
          recordsAdded += 1
        }
      }
    }
  }

  return { users, stats: { usersAdded, usersMerged, recordsAdded } }
}
