<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import { teamLabel } from '../lib/teamLabel.js'
import AppIcon from '../components/AppIcon.vue'
import SkittleFormation from '../components/SkittleFormation.vue'

const router = useRouter()
const store = useDataStore()
const fileInput = ref(null)
const message = ref('')

const menu = [
  { title: '投擲記録', sub: '練習の1投を残す', icon: 'pencil', to: 'record' },
  { title: '統計', sub: '投げ方ごとの成績', icon: 'chart', to: 'stats' },
  { title: 'プレイヤー登録', sub: '記録を残す人を追加', icon: 'user', to: 'users' },
  { title: '投げ方の管理', sub: '種類の追加と並び順', icon: 'sliders', to: 'throwTypes' },
]

// A match that was left part-way (or just finished) can be picked up again.
const resumable = computed(() => {
  const g = store.currentGame
  if (!g || !g.teams?.length) return null
  return {
    gameNumber: g.gameNumber,
    teams: g.teams.map((t) => teamLabel(t)).join(' / '),
  }
})

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
  message.value = `${store.users.length}人分の戦績を書き出しました`
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
    message.value = `読み込みました。新規${usersAdded}人、既存の更新${usersMerged}人、記録${recordsAdded}件を追加`
  }
  reader.readAsText(file)
  e.target.value = ''
}
</script>

<template>
  <div class="page home">
    <div class="home-scroll">
      <header class="hero">
        <div class="wordmark">
          <h1>Super<br />Mölkky</h1>
          <p>モルックの得点と<br />投げ方の記録</p>
        </div>
        <SkittleFormation />
      </header>

      <main class="home-sheet">
        <button v-if="resumable" class="resume" @click="router.push({ name: 'game' })">
          <span class="resume-icon"><AppIcon name="play" :size="20" /></span>
          <span class="resume-text">
            <strong>対戦を再開</strong>
            <span class="ellipsis">第{{ resumable.gameNumber }}ゲーム　{{ resumable.teams }}</span>
          </span>
          <AppIcon name="forward" :size="20" />
        </button>

        <button class="btn btn-primary start" @click="router.push({ name: 'setup' })">
          {{ resumable ? '新しい対戦をはじめる' : '対戦をはじめる' }}
        </button>

        <div class="tiles">
          <button v-for="item in menu" :key="item.to" class="tile" @click="router.push({ name: item.to })">
            <span class="tile-icon"><AppIcon :name="item.icon" /></span>
            <span class="tile-title">{{ item.title }}</span>
            <span class="tile-sub">{{ item.sub }}</span>
          </button>
        </div>

        <section class="data">
          <h2 class="label">戦績データ（CSV）</h2>
          <div class="row">
            <button class="btn btn-soft data-btn" @click="exportCsv">
              <AppIcon name="download" :size="20" />書き出す
            </button>
            <button class="btn btn-soft data-btn" @click="triggerImport">
              <AppIcon name="upload" :size="20" />読み込む
            </button>
          </div>
          <p class="hint">読み込みは今のデータに追加します。上書きはしません。</p>
          <p v-if="message" class="notice" role="status">
            <AppIcon name="check" :size="18" /><span>{{ message }}</span>
          </p>
          <input ref="fileInput" type="file" accept=".csv,text/csv" hidden @change="onFile" />
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.home {
  background: var(--sky);
}
.home-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}

/* ----- hero: wordmark beside the skittle rack ----- */
.hero {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: calc(36px + env(safe-area-inset-top)) 26px 34px 24px;
}
.wordmark h1 {
  font-size: clamp(2.125rem, 11.2vw, 2.75rem);
  font-weight: 800;
  line-height: 0.98;
  letter-spacing: -0.02em;
}
.wordmark p {
  margin-top: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.45;
}

/* ----- white sheet ----- */
.home-sheet {
  flex: 1;
  background: var(--white);
  border-radius: 28px 28px 0 0;
  padding: 20px 16px calc(28px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.resume {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  padding: 10px 12px 10px 12px;
  border-radius: 16px;
  background: var(--sky-100);
  text-align: left;
  transition: transform 0.08s ease, background-color 0.15s ease;
}
.resume:active {
  transform: scale(0.98);
  background: var(--sky-200);
}
.resume-icon {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--navy);
  color: var(--white);
  padding-left: 2px;
}
.resume-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  font-size: 0.8125rem;
  color: var(--ink-2);
}
.resume-text strong {
  font-size: 1rem;
  color: var(--navy);
}

.start {
  min-height: 60px;
  font-size: 1.125rem;
  border-radius: 16px;
}

.tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 14px 14px 14px;
  border-radius: 16px;
  background: var(--sky-50);
  box-shadow: inset 0 0 0 1px var(--sky-200);
  text-align: left;
  transition: transform 0.08s ease, background-color 0.15s ease;
}
.tile:active {
  transform: scale(0.97);
  background: var(--sky-100);
}
.tile-icon {
  margin-bottom: 8px;
  display: flex;
}
.tile-title {
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.35;
}
.tile-sub {
  font-size: 0.75rem;
  color: var(--ink-2);
}

.data {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.data-btn {
  min-height: 48px;
  font-size: 0.9375rem;
}
</style>
