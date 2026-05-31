<script setup>
import { onMounted } from 'vue'
import { useDataStore } from './stores/dataStore'

// Load persisted state from localStorage once at startup.
const store = useDataStore()
onMounted(() => store.loadFromStorage())
</script>

<template>
  <!-- .app-frame is the full-bleed navy background; .app-shell is the
       mobile-width column centered on PC (pseudo-device frame). -->
  <div class="app-frame">
    <div class="app-shell">
      <router-view />
    </div>
  </div>
</template>
