// localStorage persistence — transparent autosave so a refresh doesn't lose
// state. CSV import/export (csv.js) is the portable, cross-device mechanism.

const KEY = 'molmolmolkky:v1'

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch (e) {
    console.warn('Failed to load state from localStorage', e)
    return null
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save state to localStorage', e)
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
  } catch (e) {
    console.warn('Failed to clear state', e)
  }
}
