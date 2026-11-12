<script setup>
import { useDataStore } from './stores/dataStore'

// Load persisted state from localStorage before any view reads the store.
const store = useDataStore()
store.loadFromStorage()
</script>

<template>
  <!-- .app-frame is the full-bleed sky backdrop; .app-shell is the
       mobile-width column centered on PC (pseudo-device frame). -->
  <div class="app-frame">
    <div class="app-shell">
      <router-view />
    </div>
  </div>
</template>
