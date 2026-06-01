// Pinia store — the Vue equivalent of DataManager (ObservableObject).
// Holds users / currentGame / gameHistory / throwTypes, autosaves to
// localStorage, and provides CSV import/export.

import { defineStore } from 'pinia'
import {
  createUser,
  createGameRecord,
  defaultThrowTypes,
  createThrowType,
} from '../lib/models.js'
import { getRecommendations } from '../lib/recommendations.js'
import { serializeCsv, parseCsv, mergeUsers } from '../lib/csv.js'
import { loadState, saveState, clearState } from '../lib/persistence.js'

export const useDataStore = defineStore('data', {
  state: () => ({
    users: [],
    currentGame: null,
    gameHistory: [],
    throwTypes: defaultThrowTypes(),
    loaded: false,
  }),

  actions: {
    // ----- persistence -----
    loadFromStorage() {
      if (this.loaded) return
      const saved = loadState()
      if (saved) {
        this.users = saved.users ?? []
        this.currentGame = saved.currentGame ?? null
        this.gameHistory = saved.gameHistory ?? []
        this.throwTypes =
          saved.throwTypes && saved.throwTypes.length ? saved.throwTypes : defaultThrowTypes()
        this.ensureDefaults()
      }
      this.loaded = true
    },
    persist() {
      saveState({
        users: this.users,
        currentGame: this.currentGame,
        gameHistory: this.gameHistory,
        throwTypes: this.throwTypes,
      })
    },
    clearAll() {
      this.users = []
      this.currentGame = null
      this.gameHistory = []
      this.throwTypes = defaultThrowTypes()
      clearState()
    },

    // ----- users -----
    addUser(name) {
      this.users.push(createUser(name))
      this.persist()
    },
    updateUser(user) {
      const i = this.users.findIndex((u) => u.id === user.id)
      if (i >= 0) {
        this.users[i] = user
        this.persist()
      }
    },
    deleteUser(user) {
      this.users = this.users.filter((u) => u.id !== user.id)
      this.persist()
    },
    userByName(name) {
      return this.users.find((u) => u.name === name)
    },

    // ----- throw records -----
    addThrowRecord(user, record) {
      const i = this.users.findIndex((u) => u.id === user.id)
      if (i >= 0) {
        this.users[i].throwRecords.push(record)
        this.persist()
      }
    },
    // Remove a stats record by its id (used when an undo reverts a throw).
    removeThrowRecordById(userId, recordId) {
      const i = this.users.findIndex((u) => u.id === userId)
      if (i < 0) return
      this.users[i].throwRecords = this.users[i].throwRecords.filter((r) => r.id !== recordId)
      this.persist()
    },
    // Overwrite a stats record's score (and details when provided). Used when a
    // turn is edited and when an edit is undone (reconcileStats 'update' op).
    applyRecordUpdate(userId, recordId, score, details) {
      const i = this.users.findIndex((u) => u.id === userId)
      if (i < 0) return
      const rec = this.users[i].throwRecords.find((r) => r.id === recordId)
      if (!rec) return
      rec.score = score
      if (details) {
        rec.throwTypeName = details.throwTypeName
        rec.distance = details.distance
        rec.isSuccessful = details.isSuccessful
        if (details.notes !== undefined) rec.notes = details.notes
      } else {
        rec.isSuccessful = score !== 0
      }
      this.persist()
    },

    // ----- game -----
    startNewGame(teams) {
      this.currentGame = createGameRecord(teams)
      this.persist()
    },
    updateCurrentGame(game) {
      this.currentGame = game
      this.persist()
    },
    finishGame() {
      if (this.currentGame) {
        this.gameHistory.push(this.currentGame)
        this.currentGame = null
        this.persist()
      }
    },
    clearCurrentGame() {
      this.currentGame = null
      this.persist()
    },

    // ----- recommendations -----
    getRecommendations(currentScore, maxMoves = 3) {
      return getRecommendations(currentScore, maxMoves)
    },

    // ----- throw types -----
    addThrowType(name) {
      this.throwTypes.push(createThrowType(name, { isDefault: false, isDeletable: true }))
      this.persist()
    },
    deleteThrowType(throwType) {
      if (throwType.isDeletable) {
        this.throwTypes = this.throwTypes.filter((t) => t.id !== throwType.id)
        this.persist()
      }
    },
    reorderThrowTypes(newList) {
      this.throwTypes = newList
      this.persist()
    },
    // Ensure default throw types exist for users with older saved data.
    ensureDefaults() {
      if (!this.throwTypes.some((t) => t.name === '飛ばし')) {
        this.throwTypes.splice(2, 0, createThrowType('飛ばし', { isDefault: true }))
      }
      if (!this.throwTypes.some((t) => t.name === 'ふわ投げ')) {
        this.throwTypes.push(createThrowType('ふわ投げ', { isDefault: true }))
      }
    },

    // ----- CSV import / export -----
    exportCsv() {
      return serializeCsv(this.users)
    },
    // Merge imported CSV into existing data (non-destructive). Returns stats.
    importCsv(text) {
      const imported = parseCsv(text)
      const { users, stats } = mergeUsers(this.users, imported)
      this.users = users
      this.persist()
      return stats
    },
    // Replace all users with the CSV contents (kept for an explicit overwrite).
    replaceFromCsv(text) {
      this.users = parseCsv(text)
      this.persist()
      return this.users.length
    },
  },
})
