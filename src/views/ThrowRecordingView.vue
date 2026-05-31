<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import { createThrowRecord } from '../lib/models.js'

const router = useRouter()
const store = useDataStore()

const selectedUserId = ref(store.users[0]?.id ?? null)
const throwTypeName = ref(store.throwTypes[0]?.name ?? '横投げ')
const distance = ref(4)
const score = ref(1)
const isSuccessful = ref(true)
const message = ref('')

const selectedUser = computed(() => store.users.find((u) => u.id === selectedUserId.value) || null)
const isGasha = computed(() => throwTypeName.value === 'ガシャ')

const history = computed(() => {
  if (!selectedUser.value) return []
  return [...selectedUser.value.throwRecords].slice(-10).reverse()
})

function selectType(name) {
  throwTypeName.value = name
  if (name === 'ガシャ') score.value = 1
  else {
    distance.value = 4
    isSuccessful.value = true
  }
}

function addRecord() {
  const user = selectedUser.value
  if (!user) {
    message.value = 'プレイヤーを選択してください'
    return
  }
  const record = createThrowRecord({
    throwTypeName: throwTypeName.value,
    distance: distance.value,
    score: isGasha.value ? score.value : 1,
    isSuccessful: isGasha.value ? true : isSuccessful.value,
    notes: null,
  })
  store.addThrowRecord(user, record)
  message.value = '記録を追加しました'
  if (isGasha.value) score.value = 1
  else isSuccessful.value = true
}

function deleteRecord(record) {
  const user = selectedUser.value
  if (!user) return
  const updated = { ...user, throwRecords: user.throwRecords.filter((r) => r.id !== record.id) }
  store.updateUser(updated)
}

function icon(name) {
  return { 横投げ: '↔️', 縦投げ: '↕️', バック: '🔄', ガシャ: '💥' }[name] ?? '🎯'
}
function fmt(iso) {
  return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div class="page">
    <div class="navbar">
      <span class="spacer" />
      <button class="btn-inline" @click="router.push({ name: 'home' })">完了</button>
    </div>
    <h1 class="page-title">投擲記録</h1>

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

      <h2 class="section-title">投げ方</h2>
      <div class="scroll-x">
        <div class="chip-row">
          <button
            v-for="t in store.throwTypes"
            :key="t.id"
            :class="['chip', { selected: throwTypeName === t.name }]"
            @click="selectType(t.name)"
          >
            {{ t.name }}
          </button>
        </div>
      </div>

      <template v-if="isGasha">
        <h2 class="section-title">得点（ピン数）</h2>
        <div class="score-grid">
          <button
            v-for="n in 13"
            :key="n - 1"
            :class="['chip', { selected: score === n - 1 }]"
            @click="score = n - 1"
          >
            {{ n - 1 }}
          </button>
        </div>
      </template>
      <template v-else>
        <h2 class="section-title">結果</h2>
        <div class="row">
          <button :class="['chip', { selected: isSuccessful }]" @click="isSuccessful = true">成功</button>
          <button :class="['chip', { selected: !isSuccessful }]" @click="isSuccessful = false">失敗</button>
        </div>
        <h2 class="section-title">距離</h2>
        <div class="slider-row">
          <span class="muted">4m</span>
          <input type="range" min="4" max="12" step="1" v-model.number="distance" />
          <span class="muted">12m</span>
        </div>
        <p class="center big">{{ distance }}m</p>
      </template>

      <div v-if="history.length" class="card">
        <h2 class="section-title">投擲履歴</h2>
        <div v-for="r in history" :key="r.id" class="hist-item">
          <span class="ico">{{ icon(r.throwTypeName) }}</span>
          <div class="hd">
            <div>{{ r.throwTypeName }} ・ 得点 {{ r.score }}</div>
            <div class="muted small" v-if="r.throwTypeName !== 'ガシャ'">
              距離 {{ r.distance }}m ・ {{ r.isSuccessful ? '成功' : '失敗' }}
            </div>
            <div class="muted small">{{ fmt(r.date) }}</div>
          </div>
          <button class="trash" @click="deleteRecord(r)">🗑️</button>
        </div>
      </div>
    </div>

    <div class="pad footer">
      <p v-if="message" class="center muted">{{ message }}</p>
      <button class="btn btn-primary" @click="addRecord">記録を追加</button>
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
.score-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.4rem;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.slider-row input {
  flex: 1;
}
.big {
  font-size: 1.4rem;
  font-weight: 700;
}
.hist-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}
.ico {
  font-size: 1.3rem;
}
.hd {
  flex: 1;
}
.small {
  font-size: 0.75rem;
}
.trash {
  font-size: 1.1rem;
}
.footer {
  padding-bottom: 1.5rem;
}
</style>
