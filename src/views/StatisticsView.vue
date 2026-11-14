<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import PageHeader from '../components/PageHeader.vue'
import { groupRecordsByGame } from '../lib/gameStats.js'
import ThrowChart from '../components/ThrowChart.vue'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const store = useDataStore()

const selectedUserId = ref(store.users[0]?.id ?? null)
const throwTypeName = ref(store.throwTypes[0]?.name ?? '横投げ')
const dateFilter = ref('all') // 'all' | 'today'
const tab = ref('overall') // 'overall' = これまでの統計 | 'games' = ゲームごとの成功率

const selectedUser = computed(() => store.users.find((u) => u.id === selectedUserId.value) || null)

const filteredRecords = computed(() => {
  if (!selectedUser.value) return []
  let records = selectedUser.value.throwRecords
  if (dateFilter.value === 'today') {
    const today = new Date().toDateString()
    records = records.filter((r) => new Date(r.date).toDateString() === today)
  }
  return records.filter((r) => r.throwTypeName === throwTypeName.value)
})

// ----- ゲームごとの成功率 -----
const byGame = computed(() => {
  if (!selectedUser.value) return { matches: [], other: null }
  const games = [store.currentGame, ...store.gameHistory].filter(Boolean)
  return groupRecordsByGame(
    selectedUser.value.throwRecords,
    games,
    store.throwTypes.map((t) => t.name)
  )
})
const hasGameData = computed(() => byGame.value.matches.length > 0 || !!byGame.value.other)

// Tapping a throw-type row opens the usual bar chart for that game's throws
const openRows = ref(new Set())
function isOpen(scope, name) {
  return openRows.value.has(`${scope}|${name}`)
}
function toggleOpen(scope, name) {
  const key = `${scope}|${name}`
  const next = new Set(openRows.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openRows.value = next
}

function isLive(matchId, gameNumber) {
  const g = store.currentGame
  return !!g && !g.isFinished && g.id === matchId && g.gameNumber === gameNumber
}

const WEEK = ['日', '月', '火', '水', '木', '金', '土']
function formatMatchDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEK[d.getDay()]}）${hh}:${mm}`
}


function goBack() {
  if (window.history.state?.back) router.back()
  else router.push({ name: 'home' })
}
</script>

<template>
  <div class="page">
    <PageHeader title="統計" @back="goBack" />

    <div class="page-body">
      <div v-if="!store.users.length" class="empty">
        <strong>まだプレイヤーが登録されていません</strong>
        ホームの「プレイヤー登録」で追加すると、投げ方ごとの成績がここに出ます。
      </div>

      <template v-else>
        <div class="seg tabs" role="tablist" aria-label="統計の種類">
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'overall'"
            :class="['seg-btn', { on: tab === 'overall' }]"
            @click="tab = 'overall'"
          >
            これまでの統計
          </button>
          <button
            type="button"
            role="tab"
            :aria-selected="tab === 'games'"
            :class="['seg-btn', { on: tab === 'games' }]"
            @click="tab = 'games'"
          >
            ゲームごとの成功率
          </button>
        </div>

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

        <section v-if="tab === 'overall'" class="group">
          <h2 class="label">期間</h2>
          <div class="seg" role="radiogroup" aria-label="期間">
            <button
              type="button"
              role="radio"
              :aria-checked="dateFilter === 'today'"
              :class="['seg-btn', { on: dateFilter === 'today' }]"
              @click="dateFilter = 'today'"
            >
              今日
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="dateFilter === 'all'"
              :class="['seg-btn', { on: dateFilter === 'all' }]"
              @click="dateFilter = 'all'"
            >
              総合
            </button>
          </div>
        </section>

        <div v-if="!selectedUser" class="empty">
          <strong>プレイヤーを選んでください</strong>
          上の名前をタップすると成績を表示します。
        </div>

        <!-- ===== ゲームごとの成功率 ===== -->
        <template v-else-if="tab === 'games'">
          <div v-if="!hasGameData" class="empty">
            <strong>{{ selectedUser.name }}さんの記録はまだありません</strong>
            対戦中に「投擲詳細」をオンにして投げ方を記録すると、ゲームごとの成功率がここに出ます。
          </div>

          <template v-else>
            <p class="games-note">
              成功率はガシャを除いた投擲で計算しています。ガシャは倒したピン数の平均です。投げ方をタップすると、そのゲームのグラフが開きます。
            </p>

            <section v-for="m in byGame.matches" :key="m.matchId" class="match">
              <header class="match-head">
                <h3>{{ formatMatchDate(m.matchDate) }} からの対戦</h3>
                <p class="num">
                  {{ m.games.length }}ゲーム・{{ m.total }}投<template v-if="m.ratedTotal">・成功率 {{ m.rate }}%</template>
                </p>
              </header>

              <article v-for="g in m.games" :key="g.gameNumber" class="card game-card">
                <header class="game-head">
                  <div class="game-title">
                    <h4>第{{ g.gameNumber }}ゲーム</h4>
                    <span v-if="isLive(m.matchId, g.gameNumber)" class="tag">対戦中</span>
                  </div>
                  <div v-if="g.ratedTotal" class="game-rate">
                    <b class="num">{{ g.rate }}<small>%</small></b>
                    <span class="num">{{ g.ratedTotal }}投中 {{ g.success }}回成功</span>
                  </div>
                  <div v-else class="game-rate">
                    <span class="num">{{ g.total }}投</span>
                  </div>
                </header>
                <ul class="type-rows">
                  <li v-for="t in g.types" :key="t.name" :class="['type-item', { open: isOpen(`${m.matchId}|${g.gameNumber}`, t.name) }]">
                    <button
                      type="button"
                      class="type-row"
                      :aria-expanded="isOpen(`${m.matchId}|${g.gameNumber}`, t.name)"
                      @click="toggleOpen(`${m.matchId}|${g.gameNumber}`, t.name)"
                    >
                      <span class="type-name ellipsis">{{ t.name }}</span>
                      <span :class="['type-bar', { gasha: t.isGasha }]" aria-hidden="true">
                        <i :style="{ width: (t.isGasha ? (t.avgPins / 12) * 100 : t.rate) + '%' }" />
                      </span>
                      <span v-if="t.isGasha" class="type-val num">平均 {{ t.avgPins }}本<small>{{ t.total }}投</small></span>
                      <span v-else class="type-val num">{{ t.rate }}%<small>{{ t.success }}/{{ t.total }}</small></span>
                      <AppIcon class="type-chev" name="down" :size="16" />
                    </button>
                    <div v-if="isOpen(`${m.matchId}|${g.gameNumber}`, t.name)" class="type-chart">
                      <ThrowChart :records="t.records" :throw-type-name="t.name" flat />
                    </div>
                  </li>
                </ul>
              </article>
            </section>

            <section v-if="byGame.other" class="match">
              <header class="match-head">
                <h3>ゲーム外の記録（練習など）</h3>
                <p class="num">
                  {{ byGame.other.total }}投<template v-if="byGame.other.ratedTotal">・成功率 {{ byGame.other.rate }}%</template>
                </p>
              </header>
              <article class="card game-card">
                <ul class="type-rows">
                  <li v-for="t in byGame.other.types" :key="t.name" :class="['type-item', { open: isOpen('other', t.name) }]">
                    <button
                      type="button"
                      class="type-row"
                      :aria-expanded="isOpen('other', t.name)"
                      @click="toggleOpen('other', t.name)"
                    >
                      <span class="type-name ellipsis">{{ t.name }}</span>
                      <span :class="['type-bar', { gasha: t.isGasha }]" aria-hidden="true">
                        <i :style="{ width: (t.isGasha ? (t.avgPins / 12) * 100 : t.rate) + '%' }" />
                      </span>
                      <span v-if="t.isGasha" class="type-val num">平均 {{ t.avgPins }}本<small>{{ t.total }}投</small></span>
                      <span v-else class="type-val num">{{ t.rate }}%<small>{{ t.success }}/{{ t.total }}</small></span>
                      <AppIcon class="type-chev" name="down" :size="16" />
                    </button>
                    <div v-if="isOpen('other', t.name)" class="type-chart">
                      <ThrowChart :records="t.records" :throw-type-name="t.name" flat />
                    </div>
                  </li>
                </ul>
                <p class="other-note">投擲記録の画面で付けた記録や、この機能より前の対戦の記録です。</p>
              </article>
            </section>
          </template>
        </template>

        <!-- ===== これまでの統計 ===== -->
        <template v-else>
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
                @click="throwTypeName = t.name"
              >
                {{ t.name }}
              </button>
            </div>
          </section>

          <ThrowChart :records="filteredRecords" :throw-type-name="throwTypeName" />
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ----- tabs ----- */
.tabs {
  flex: none;
}
.tabs .seg-btn {
  white-space: nowrap;
}

/* ----- ゲームごとの成功率 ----- */
.games-note {
  font-size: 0.75rem;
  color: var(--ink-2);
  line-height: 1.5;
}
.match {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.match-head h3 {
  font-size: 0.9375rem;
  font-weight: 700;
}
.match-head p {
  font-size: 0.75rem;
  color: var(--ink-2);
}
.game-card {
  padding: 14px 14px 12px;
}
.game-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line);
}
.game-title {
  display: flex;
  align-items: center;
  gap: 8px;
}
.game-title h4 {
  font-size: 1rem;
  font-weight: 700;
}
.game-rate {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.1;
}
.game-rate b {
  font-size: 1.75rem;
  font-weight: 700;
}
.game-rate b small {
  font-size: 0.875rem;
  margin-left: 1px;
}
.game-rate span {
  font-size: 0.6875rem;
  color: var(--ink-2);
}
.type-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.type-item + .type-item {
  border-top: 1px solid var(--line);
}
.type-row {
  width: 100%;
  display: grid;
  grid-template-columns: 4.5em 1fr 6.5em 16px;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0;
  text-align: left;
  color: inherit;
  background: none;
}
.type-row:focus-visible {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
  border-radius: 8px;
}
.type-chev {
  color: var(--ink-2);
  transition: transform 0.18s var(--ease-out, ease);
}
.type-item.open .type-chev {
  transform: rotate(180deg);
}
.type-chart {
  padding: 4px 0 12px;
}
.type-name {
  font-size: 0.8125rem;
  font-weight: 600;
}
.type-bar {
  height: 10px;
  border-radius: 999px;
  background: var(--sky-100);
  overflow: hidden;
}
.type-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--navy);
}
.type-bar.gasha i {
  background: var(--sky);
}
.type-val {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: 5px;
  font-size: 0.875rem;
  font-weight: 700;
  white-space: nowrap;
}
.type-val small {
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--ink-2);
}
.other-note {
  margin-top: 10px;
  font-size: 0.6875rem;
  color: var(--ink-2);
}

</style>
