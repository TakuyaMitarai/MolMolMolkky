<script setup>
import { ref, computed } from 'vue'
import { getRecommendations } from '../lib/recommendations.js'
import { teamLabel } from '../lib/teamLabel.js'
import BottomSheet from './BottomSheet.vue'

const props = defineProps({ game: { type: Object, required: true } })
const emit = defineEmits(['toggle-skittle', 'close'])

const selectedTeamIndex = ref(props.game.currentTeamIndex >= 0 ? props.game.currentTeamIndex : 0)

const selectedTeam = computed(() => props.game.teams[selectedTeamIndex.value])
const selectedSkittles = computed(() => new Set(selectedTeam.value.selectedSkittles))
const recommendations = computed(() => getRecommendations(selectedTeam.value.currentGameScore))
const remaining = computed(() => recommendations.value.targetScore - selectedTeam.value.currentGameScore)

const filtered = computed(() => {
  const sel = selectedSkittles.value
  const normal = []
  const dimmed = []
  for (const combo of recommendations.value.combinations) {
    const overlaps = sel.size > 0 && combo.some((n) => sel.has(n))
    ;(overlaps ? dimmed : normal).push(combo)
  }
  return [...normal.map((c) => ({ combo: c, dimmed: false })), ...dimmed.map((c) => ({ combo: c, dimmed: true }))]
})

function toggle(n) {
  emit('toggle-skittle', { teamIndex: selectedTeamIndex.value, number: n })
}
</script>

<template>
  <BottomSheet title="50点へのおすすめ" sub="3投以内でちょうど50点になる組み合わせ" @close="emit('close')">
    <div class="chips" role="radiogroup" aria-label="チーム">
      <button
        v-for="(t, i) in game.teams"
        :key="t.id"
        type="button"
        role="radio"
        :aria-checked="selectedTeamIndex === i"
        :class="['chip', { selected: selectedTeamIndex === i }]"
        @click="selectedTeamIndex = i"
      >
        {{ teamLabel(t) }}
      </button>
    </div>

    <div class="status">
      <p class="status-now num">いま <strong>{{ selectedTeam.currentGameScore }}</strong>点</p>
      <p class="status-left num">あと <strong>{{ remaining }}</strong>点</p>
    </div>

    <div class="group">
      <span class="label">狙いにくい数字</span>
      <div class="pin-grid">
        <button
          v-for="n in 12"
          :key="n"
          type="button"
          :aria-pressed="selectedSkittles.has(n)"
          :class="['pin-key', 'pick', { selected: selectedSkittles.has(n) }]"
          @click="toggle(n)"
        >
          {{ n }}
        </button>
      </div>
      <p class="hint">タップした数字を使う組み合わせは、薄く表示して後ろに回します。</p>
    </div>

    <div class="group">
      <span class="label">組み合わせ {{ filtered.length }}通り</span>
      <div v-if="!recommendations.combinations.length" class="empty">
        <strong>3投以内では50点に届きません</strong>
        まずは大きい数字で得点を重ねましょう。
      </div>
      <ol v-else class="rec-grid">
        <li v-for="(item, idx) in filtered" :key="idx" :class="['rec', { dimmed: item.dimmed }]">
          <span class="combo">
            <template v-for="(n, ci) in item.combo" :key="ci">
              <span v-if="ci > 0" class="plus" aria-hidden="true">+</span>
              <button
                type="button"
                :aria-pressed="selectedSkittles.has(n)"
                :class="['mini', 'num', { on: selectedSkittles.has(n) }]"
                @click="toggle(n)"
              >
                {{ n }}
              </button>
            </template>
          </span>
        </li>
      </ol>
    </div>
  </BottomSheet>
</template>

<style scoped>
.status {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 10px 16px;
  border-radius: 16px;
  background: var(--navy);
  color: var(--white);
}
.status p {
  font-size: 0.875rem;
  font-weight: 600;
}
.status strong {
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
  margin: 0 2px;
}
.status-now {
  color: var(--sky);
}
.status-now strong {
  font-size: 1.25rem;
}

.rec-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.rec {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 6px 4px;
  border-radius: 12px;
  background: var(--sky-50);
  box-shadow: inset 0 0 0 1px var(--sky-200);
  transition: opacity 0.15s ease;
}
.rec.dimmed {
  opacity: 0.42;
}
.combo {
  display: flex;
  align-items: center;
  gap: 4px;
}
.plus {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--ink-2);
}
.mini {
  flex: none;
  width: clamp(28px, 8.4vw, 34px);
  height: clamp(28px, 8.4vw, 34px);
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 700;
  background: var(--sky);
  color: var(--navy);
  transition: background-color 0.1s ease, color 0.1s ease;
}
.mini.on {
  background: var(--navy);
  color: var(--white);
}
</style>
