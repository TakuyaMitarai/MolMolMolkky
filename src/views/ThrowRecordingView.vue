<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import { createThrowRecord } from '../lib/models.js'
import AppIcon from '../components/AppIcon.vue'
import PageHeader from '../components/PageHeader.vue'
import DistancePicker from '../components/DistancePicker.vue'

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
  message.value = `${user.name}の記録を追加しました（${user.throwRecords.length}件目）`
  if (isGasha.value) score.value = 1
  else isSuccessful.value = true
}

function deleteRecord(record) {
  const user = selectedUser.value
  if (!user) return
  const updated = { ...user, throwRecords: user.throwRecords.filter((r) => r.id !== record.id) }
  store.updateUser(updated)
  message.value = ''
}

function fmt(iso) {
  return new Date(iso).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })
}
// What the record says, in one line.
function summary(r) {
  if (r.throwTypeName === 'ガシャ') return `${r.score}本`
  return `${r.distance}m　${r.isSuccessful ? '成功' : '失敗'}　${r.score}点`
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="投擲記録"
      sub="練習の1投を統計に残します"
      backLabel="ホームに戻る"
      @back="router.push({ name: 'home' })"
    />

    <div class="page-body">
      <div v-if="!store.users.length" class="empty">
        <strong>まだプレイヤーが登録されていません</strong>
        ホームの「プレイヤー登録」で追加すると、ここで記録できます。
      </div>

      <template v-else>
        <section class="group">
          <h2 class="label">プレイヤー</h2>
          <div class="chips" role="radiogroup" aria-label="プレイヤー">
            <button
              v-for="u in store.users"
              :key="u.id"
              type="button"
              role="radio"
              :aria-checked="selectedUserId === u.id"
              :class="['chip', { selected: selectedUserId === u.id }]"
              @click="selectedUserId = u.id"
            >
              {{ u.name }}
            </button>
          </div>
        </section>

        <section class="group">
          <h2 class="label">投げ方</h2>
          <div class="chips" role="radiogroup" aria-label="投げ方">
            <button
              v-for="t in store.throwTypes"
              :key="t.id"
              type="button"
              role="radio"
              :aria-checked="throwTypeName === t.name"
              :class="['chip', { selected: throwTypeName === t.name }]"
              @click="selectType(t.name)"
            >
              {{ t.name }}
            </button>
          </div>
        </section>

        <section v-if="isGasha" class="group">
          <h2 class="label">倒したピン数</h2>
          <div class="pin-grid" role="radiogroup" aria-label="倒したピン数">
            <button
              v-for="n in 12"
              :key="n"
              type="button"
              role="radio"
              :aria-checked="score === n"
              :class="['pin-key', 'pick', { selected: score === n }]"
              @click="score = n"
            >
              {{ n }}
            </button>
          </div>
          <button
            type="button"
            role="radio"
            :aria-checked="score === 0"
            :class="['chip', 'zero-chip', { selected: score === 0 }]"
            @click="score = 0"
          >
            0本（1本も倒れなかった）
          </button>
        </section>

        <template v-else>
          <section class="group">
            <h2 class="label">結果</h2>
            <div class="seg" role="radiogroup" aria-label="結果">
              <button
                type="button"
                role="radio"
                :aria-checked="isSuccessful"
                :class="['seg-btn', { on: isSuccessful }]"
                @click="isSuccessful = true"
              >
                成功
              </button>
              <button
                type="button"
                role="radio"
                :aria-checked="!isSuccessful"
                :class="['seg-btn', { on: !isSuccessful }]"
                @click="isSuccessful = false"
              >
                失敗
              </button>
            </div>
          </section>
          <DistancePicker v-model="distance" />
        </template>

        <section v-if="history.length" class="group">
          <h2 class="label">{{ selectedUser?.name }}の最近の記録（新しい順・10件まで）</h2>
          <ul class="card history">
            <li v-for="r in history" :key="r.id" class="hist-item">
              <div class="hd">
                <div class="hd-main num"><strong>{{ r.throwTypeName }}</strong>{{ summary(r) }}</div>
                <div class="hd-sub num">{{ fmt(r.date) }}</div>
              </div>
              <button class="icon-btn" :aria-label="`${fmt(r.date)}の記録を削除`" @click="deleteRecord(r)">
                <AppIcon name="trash" :size="20" />
              </button>
            </li>
          </ul>
        </section>
      </template>
    </div>

    <div v-if="store.users.length" class="page-foot">
      <p v-if="message" class="notice" role="status">{{ message }}</p>
      <button class="btn btn-primary" @click="addRecord">この内容で記録する</button>
    </div>
  </div>
</template>

<style scoped>
.zero-chip {
  width: 100%;
}
.history {
  list-style: none;
  margin: 0;
  padding: 4px 6px 4px 14px;
}
.hist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.hist-item + .hist-item {
  border-top: 1px solid var(--line);
}
.hd {
  flex: 1;
  min-width: 0;
}
.hd-main {
  font-size: 0.9375rem;
  font-weight: 600;
}
.hd-main strong {
  font-weight: 700;
  margin-right: 10px;
}
.hd-sub {
  font-size: 0.75rem;
  color: var(--ink-2);
}
</style>
