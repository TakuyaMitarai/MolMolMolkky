<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'

const router = useRouter()
const store = useDataStore()

const selectedUserId = ref(store.users[0]?.id ?? null)
const throwTypeName = ref(store.throwTypes[0]?.name ?? '横投げ')
const dateFilter = ref('all') // 'all' | 'today'

const selectedUser = computed(() => store.users.find((u) => u.id === selectedUserId.value) || null)
const isGasha = computed(() => throwTypeName.value === 'ガシャ')

const filteredRecords = computed(() => {
  if (!selectedUser.value) return []
  let records = selectedUser.value.throwRecords
  if (dateFilter.value === 'today') {
    const today = new Date().toDateString()
    records = records.filter((r) => new Date(r.date).toDateString() === today)
  }
  return records.filter((r) => r.throwTypeName === throwTypeName.value)
})

// Gasha: pin-count histogram 0..12
const scoreData = computed(() => {
  const data = {}
  for (let s = 0; s <= 12; s++) data[s] = 0
  for (const r of filteredRecords.value) data[r.score] = (data[r.score] ?? 0) + 1
  const max = Math.max(1, ...Object.values(data))
  return { data, max, total: filteredRecords.value.length }
})

// Non-gasha: distance success rate
const distanceData = computed(() => {
  const map = new Map()
  for (const r of filteredRecords.value) {
    const cur = map.get(r.distance) ?? { success: 0, total: 0 }
    cur.total += 1
    if (r.isSuccessful) cur.success += 1
    map.set(r.distance, cur)
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([distance, { success, total }]) => ({
      distance,
      total,
      rate: total ? Math.round((success / total) * 100) : 0,
    }))
})
</script>

<template>
  <div class="page">
    <div class="navbar">
      <span class="spacer" />
      <button class="btn-inline" @click="router.back()">完了</button>
    </div>
    <h1 class="page-title">統計情報</h1>

    <div class="page-scroll pad col">
      <h2 class="section-title">プレイヤー</h2>
      <div class="scroll-x">
        <div class="chip-row">
          <button
            v-for="u in store.users"
            :key="u.id"
            :class="['chip', { selected: selectedUserId === u.id }]"
            @click="selectedUserId = u.id"
          >
            {{ u.name }}
          </button>
          <span v-if="!store.users.length" class="muted">ユーザーを登録してください</span>
        </div>
      </div>

      <h2 class="section-title">期間</h2>
      <div class="row">
        <button :class="['chip', { selected: dateFilter === 'today' }]" @click="dateFilter = 'today'">今日</button>
        <button :class="['chip', { selected: dateFilter === 'all' }]" @click="dateFilter = 'all'">総合</button>
      </div>

      <template v-if="selectedUser">
        <h2 class="section-title">投げ方別統計</h2>
        <div class="scroll-x">
          <div class="chip-row">
            <button
              v-for="t in store.throwTypes"
              :key="t.id"
              :class="['chip', { selected: throwTypeName === t.name }]"
              @click="throwTypeName = t.name"
            >
              {{ t.name }}
            </button>
          </div>
        </div>

        <!-- gasha: pin count -->
        <div v-if="isGasha" class="card">
          <h3 class="center">ピン数別統計</h3>
          <div v-if="!scoreData.total" class="center muted">データがありません</div>
          <div v-else class="scroll-x">
            <div class="bar-chart">
              <div v-for="s in 13" :key="s - 1" class="bar-col">
                <span class="cnt">{{ scoreData.data[s - 1] }}</span>
                <div class="bar" :style="{ height: (scoreData.data[s - 1] / scoreData.max) * 80 + 'px' }" />
                <span class="lbl">{{ s - 1 }}</span>
                <span class="den muted">/{{ scoreData.total }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- non-gasha: distance success rate -->
        <div v-else class="card">
          <h3 class="center">距離別成功率</h3>
          <div v-if="!distanceData.length" class="center muted">データがありません</div>
          <div v-else class="scroll-x">
            <div class="bar-chart">
              <div v-for="d in distanceData" :key="d.distance" class="bar-col">
                <span class="cnt">{{ d.rate }}%</span>
                <div class="bar" :style="{ height: d.rate * 0.8 + 'px' }" />
                <span class="lbl">{{ d.distance }}m</span>
                <span class="den muted">({{ d.total }})</span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <div v-else class="center muted empty">👆 プレイヤーを選択してください</div>
    </div>
  </div>
</template>

<style scoped>
.chip-row {
  display: flex;
  gap: 0.5rem;
  padding-bottom: 0.25rem;
}
.chip-row .chip {
  white-space: nowrap;
  width: auto;
}
.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.5rem 0;
  min-height: 130px;
}
.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.bar {
  width: 24px;
  min-height: 2px;
  background: var(--navy);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 2px;
}
.cnt,
.lbl {
  font-size: 0.7rem;
}
.den {
  font-size: 0.65rem;
}
.empty {
  padding: 3rem 0;
}
h3 {
  margin: 0.3rem 0;
}
</style>
