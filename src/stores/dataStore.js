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
import { serializeCsv, parseCsv } from '../lib/csv.js'
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
        this.ensureFuwatoge()
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
    removeLastThrowRecord(user, score) {
      const i = this.users.findIndex((u) => u.id === user.id)
      if (i < 0) return
      const records = this.users[i].throwRecords
      let idx = -1
      for (let k = records.length - 1; k >= 0; k--) {
        if (records[k].score === score) {
          idx = k
          break
        }
      }
      if (idx >= 0) records.splice(idx, 1)
      else if (records.length) records.pop() // fallback: remove latest
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
    ensureFuwatoge() {
      if (!this.throwTypes.some((t) => t.name === 'ふわ投げ')) {
        this.throwTypes.splice(2, 0, createThrowType('ふわ投げ', { isDefault: true }))
      }
    },

    // ----- CSV import / export -----
    exportCsv() {
      return serializeCsv(this.users)
    },
    importCsv(text) {
      const imported = parseCsv(text)
      this.users = imported
      this.persist()
      return imported.length
    },
  },
})
