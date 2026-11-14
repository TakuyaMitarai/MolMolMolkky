<script setup>
// Charts for one set of records of one throw type: the pin-count histogram
// for ガシャ, success rate by distance for everything else. Used by both
// statistics tabs ("これまでの統計" and the expandable rows of
// "ゲームごとの成功率"). `flat` drops the card frame when nested in a card.
import { computed } from 'vue'

const props = defineProps({
  records: { type: Array, required: true },
  throwTypeName: { type: String, required: true },
  flat: { type: Boolean, default: false },
})

const isGasha = computed(() => props.throwTypeName === 'ガシャ')

// Gasha: pin-count histogram 0..12
const scoreData = computed(() => {
  const data = {}
  for (let s = 0; s <= 12; s++) data[s] = 0
  for (const r of props.records) data[r.score] = (data[r.score] ?? 0) + 1
  const max = Math.max(1, ...Object.values(data))
  return { data, max, total: props.records.length }
})

// Non-gasha: success rate per distance. The 4–12m axis is always drawn in
// full so a distance keeps its position whether or not it has data yet.
const distanceData = computed(() => {
  const map = new Map()
  for (let d = 4; d <= 12; d++) map.set(d, { success: 0, total: 0 })
  for (const r of props.records) {
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
  const total = props.records.length
  const success = props.records.filter((r) => r.isSuccessful).length
  return { total, success, rate: total ? Math.round((success / total) * 100) : 0 }
})

const BAR_AREA = 104 // px, must match .plot height below
</script>

<template>
  <!-- gasha: how many pins fell -->
  <section v-if="isGasha" :class="['chart-card', { card: !flat, flat }]">
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
  <section v-else :class="['chart-card', { card: !flat, flat }]">
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

<style scoped>
.chart-card {
  padding: 16px 14px 14px;
}
.chart-card.flat {
  padding: 4px 0 0;
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
