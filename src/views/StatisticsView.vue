<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import PageHeader from '../components/PageHeader.vue'
import { groupRecordsByGame } from '../lib/gameStats.js'

const router = useRouter()
const store = useDataStore()

const selectedUserId = ref(store.users[0]?.id ?? null)
const throwTypeName = ref(store.throwTypes[0]?.name ?? '横投げ')
const dateFilter = ref('all') // 'all' | 'today'
const tab = ref('overall') // 'overall' = これまでの統計 | 'games' = ゲームごとの成功率

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

// Non-gasha: success rate per distance. The 4–12m axis is always drawn in
// full so a distance keeps its position whether or not it has data yet.
const distanceData = computed(() => {
  const map = new Map()
  for (let d = 4; d <= 12; d++) map.set(d, { success: 0, total: 0 })
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
      success,
      rate: total ? Math.round((success / total) * 100) : 0,
    }))
})

const distanceSummary = computed(() => {
  const total = filteredRecords.value.length
  const success = filteredRecords.value.filter((r) => r.isSuccessful).length
  return { total, success, rate: total ? Math.round((success / total) * 100) : 0 }
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

const BAR_AREA = 104 // px, must match .plot height below

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
              成功率はガシャを除いた投擲で計算しています。ガシャは倒したピン数の平均です。
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
                  <li v-for="t in g.types" :key="t.name" class="type-row">
                    <span class="type-name ellipsis">{{ t.name }}</span>
                    <template v-if="t.isGasha">
                      <span class="type-bar gasha" aria-hidden="true">
                        <i :style="{ width: (t.avgPins / 12) * 100 + '%' }" />
                      </span>
                      <span class="type-val num">平均 {{ t.avgPins }}本<small>{{ t.total }}投</small></span>
                    </template>
                    <template v-else>
                      <span
                        class="type-bar"
                        role="img"
                        :aria-label="`${t.name} 成功率 ${t.rate}%（${t.total}投中${t.success}回）`"
                      >
                        <i :style="{ width: t.rate + '%' }" />
                      </span>
                      <span class="type-val num">{{ t.rate }}%<small>{{ t.success }}/{{ t.total }}</small></span>
                    </template>
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
                  <li v-for="t in byGame.other.types" :key="t.name" class="type-row">
                    <span class="type-name ellipsis">{{ t.name }}</span>
                    <template v-if="t.isGasha">
                      <span class="type-bar gasha" aria-hidden="true">
                        <i :style="{ width: (t.avgPins / 12) * 100 + '%' }" />
                      </span>
                      <span class="type-val num">平均 {{ t.avgPins }}本<small>{{ t.total }}投</small></span>
                    </template>
                    <template v-else>
                      <span class="type-bar" aria-hidden="true"><i :style="{ width: t.rate + '%' }" /></span>
                      <span class="type-val num">{{ t.rate }}%<small>{{ t.success }}/{{ t.total }}</small></span>
                    </template>
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

          <!-- gasha: how many pins fell -->
          <section v-if="isGasha" class="card chart-card">
            <header class="chart-head">
              <h3>倒したピン数の回数</h3>
              <p class="num">全{{ scoreData.total }}投</p>
            </header>
            <div v-if="!scoreData.total" class="no-data">この条件の記録はまだありません</div>
            <div v-else class="chart" role="img" :aria-label="`ガシャ投げで倒したピン数ごとの回数。全${scoreData.total}投`">
              <div class="plot">
                <div
                  v-for="s in 13"
                  :key="s - 1"
                  class="col"
                  :title="`${s - 1}本: ${scoreData.data[s - 1]}回 / ${scoreData.total}投`"
                >
                  <span v-if="scoreData.data[s - 1]" class="val num">{{ scoreData.data[s - 1] }}</span>
                  <span
                    class="bar"
                    :class="{ zero: !scoreData.data[s - 1] }"
                    :style="{ height: (scoreData.data[s - 1] / scoreData.max) * BAR_AREA + 'px' }"
                  />
                </div>
              </div>
              <div class="axis">
                <span v-for="s in 13" :key="s - 1" class="tick num">{{ s - 1 }}</span>
              </div>
              <p class="axis-title">倒したピン数（本）</p>
            </div>
          </section>

          <!-- other throws: success rate by distance -->
          <section v-else class="card chart-card">
            <header class="chart-head">
              <h3>距離ごとの成功率</h3>
              <p class="num">
                {{ distanceSummary.total }}投中 {{ distanceSummary.success }}回成功（{{ distanceSummary.rate }}%）
              </p>
            </header>
            <div v-if="!distanceSummary.total" class="no-data">この条件の記録はまだありません</div>
            <div v-else class="chart with-gutter" role="img" :aria-label="`${throwTypeName}の距離ごとの成功率`">
              <div class="plot rate">
                <span class="grid g100"><em class="num">100%</em></span>
                <span class="grid g50"><em class="num">50%</em></span>
                <div
                  v-for="d in distanceData"
                  :key="d.distance"
                  class="col"
                  :title="`${d.distance}m: ${d.total ? d.rate + '%（' + d.success + '/' + d.total + '）' : '記録なし'}`"
                >
                  <span v-if="d.total" class="val num">{{ d.rate }}</span>
                  <span class="bar" :class="{ zero: !d.total || !d.rate }" :style="{ height: (d.rate / 100) * BAR_AREA + 'px' }" />
                </div>
              </div>
              <div class="axis">
                <span v-for="d in distanceData" :key="d.distance" class="tick num">
                  {{ d.distance }}
                  <small>{{ d.total ? d.total + '投' : '' }}</small>
                </span>
              </div>
              <p class="axis-title">距離（m）と投数。棒の上の数字は成功率（%）</p>
            </div>
          </section>
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
  gap: 8px;
}
.type-row {
  display: grid;
  grid-template-columns: 4.5em 1fr 6.5em;
  align-items: center;
  gap: 10px;
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

.chart-card {
  padding: 16px 14px 14px;
}
.chart-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}
.chart-head h3 {
  font-size: 1rem;
  font-weight: 700;
}
.chart-head p {
  font-size: 0.8125rem;
  color: var(--ink-2);
}
.no-data {
  padding: 28px 0;
  text-align: center;
  font-size: 0.875rem;
  color: var(--ink-2);
}

/* One series, one colour. Values sit on the column caps because the screen
   is touch-first and has no hover. */
.plot {
  position: relative;
  display: flex;
  align-items: flex-end;
  height: 128px; /* 104px of bar + room for the cap label */
  border-bottom: 1px solid var(--line-strong);
}
.col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  position: relative;
}
.bar {
  width: 100%;
  max-width: 18px;
  background: var(--navy);
  border-radius: 4px 4px 0 0;
}
.bar.zero {
  height: 0 !important;
}
.val {
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1;
}
.grid {
  position: absolute;
  left: 0;
  right: 0;
  height: 0;
  border-top: 1px solid var(--line);
}
.grid.g100 {
  bottom: 104px;
}
.grid.g50 {
  bottom: 52px;
}
.grid em {
  position: absolute;
  right: 0;
  top: -0.5em;
  line-height: 1;
  font-style: normal;
  font-size: 0.625rem;
  color: var(--ink-2);
  background: var(--white);
  padding-left: 4px;
}
/* the rate chart keeps a right-hand gutter for the 50% / 100% labels */
.with-gutter .plot,
.with-gutter .axis {
  padding-right: 34px;
}
.axis {
  display: flex;
  margin-top: 5px;
}
.tick {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
}
.tick small {
  min-height: 0.8rem;
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--ink-2);
  white-space: nowrap;
}
.axis-title {
  margin-top: 6px;
  font-size: 0.6875rem;
  color: var(--ink-2);
  text-align: center;
}
</style>
