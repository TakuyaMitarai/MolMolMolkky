<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'

const router = useRouter()
const store = useDataStore()
const fileInput = ref(null)
const message = ref('')

const menu = [
  { title: 'ユーザー登録', icon: '👤', to: 'users' },
  { title: '対戦開始', icon: '🎯', to: 'setup' },
  { title: '投擲記録', icon: '✏️', to: 'record' },
  { title: '統計', icon: '📊', to: 'stats' },
  { title: '投げ方管理', icon: '🤾', to: 'throwTypes' },
]

function exportCsv() {
  const csv = store.exportCsv()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `molkky_records_${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
  message.value = `${store.users.length}人分の戦績をエクスポートしました`
}

function triggerImport() {
  fileInput.value?.click()
}

function onFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const { usersAdded, usersMerged, recordsAdded } = store.importCsv(String(reader.result))
    message.value = `マージ完了: 新規${usersAdded}人 / 既存更新${usersMerged}人 / 記録${recordsAdded}件追加`
  }
  reader.readAsText(file)
  e.target.value = ''
}
</script>

<template>
  <div class="page home">
    <div class="title-band">
      <h1>Super Mölkky</h1>
    </div>

    <div class="menu">
      <button
        v-for="item in menu"
        :key="item.to"
        class="menu-btn"
        @click="router.push({ name: item.to })"
      >
        <span class="icon">{{ item.icon }}</span>
        <span class="label">{{ item.title }}</span>
        <span class="chevron">›</span>
      </button>
    </div>

    <div class="data-band">
      <h2 class="section-title">データ (CSV)</h2>
      <div class="row pad">
        <button class="btn btn-ghost" @click="exportCsv">⬇️ エクスポート</button>
        <button class="btn btn-ghost" @click="triggerImport">⬆️ インポート(マージ)</button>
      </div>
      <p class="center muted small-note">インポートは既存データに差分を追加します（上書きしません）</p>
      <p v-if="message" class="center msg">{{ message }}</p>
      <input
        ref="fileInput"
        type="file"
        accept=".csv,text/csv"
        style="display: none"
        @change="onFile"
      />
    </div>
  </div>
</template>

<style scoped>
.home {
  justify-content: flex-start;
}
.title-band {
  background: var(--navy);
  padding: 3rem 0 1.5rem;
  text-align: center;
}
.title-band h1 {
  margin: 0;
  font-size: 2.2rem;
  font-weight: 800;
  color: #fff;
}
.menu {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 2rem 1.25rem;
}
.menu-btn {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: #fff;
  color: var(--navy);
  border: 3px solid var(--navy);
  border-radius: 12px;
  padding: 0.9rem 1rem;
  min-height: 56px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
  transition: transform 0.08s ease;
}
.menu-btn:active {
  transform: scale(0.97);
}
.menu-btn .icon {
  font-size: 1.4rem;
  width: 2rem;
  text-align: center;
}
.menu-btn .label {
  font-size: 1.1rem;
  font-weight: 700;
  flex: 1;
  text-align: left;
}
.menu-btn .chevron {
  font-size: 1.4rem;
  opacity: 0.6;
}
.data-band {
  margin-top: auto;
  padding: 1rem 0 1.5rem;
}
.msg {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  opacity: 0.85;
}
.small-note {
  margin-top: 0.5rem;
  font-size: 0.75rem;
}
</style>
