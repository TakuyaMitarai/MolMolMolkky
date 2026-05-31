<script setup>
import { ref, computed } from 'vue'
import { getRecommendations } from '../lib/recommendations.js'

const props = defineProps({ game: { type: Object, required: true } })
const emit = defineEmits(['toggle-skittle', 'close'])

const selectedTeamIndex = ref(props.game.currentTeamIndex >= 0 ? props.game.currentTeamIndex : 0)

const selectedTeam = computed(() => props.game.teams[selectedTeamIndex.value])
const selectedSkittles = computed(() => new Set(selectedTeam.value.selectedSkittles))
const recommendations = computed(() => getRecommendations(selectedTeam.value.currentGameScore))

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

function teamLabel(team) {
  const names = (team.players || []).map((p) => p.user?.name).filter(Boolean)
  return names.length ? names.join(' & ') : team.name
}
function toggle(n) {
  emit('toggle-skittle', { teamIndex: selectedTeamIndex.value, number: n })
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet page">
      <div class="navbar">
        <span class="spacer" />
        <button class="btn-inline" @click="emit('close')">閉じる ✕</button>
      </div>
      <h1 class="page-title">スキットル推薦</h1>

      <div class="pad col">
        <div class="row team-tabs">
          <button
            v-for="(t, i) in game.teams"
            :key="t.id"
            :class="['chip', { selected: selectedTeamIndex === i }]"
            @click="selectedTeamIndex = i"
          >
            {{ teamLabel(t) }}
          </button>
        </div>
        <p class="center muted">{{ teamLabel(selectedTeam) }}: {{ selectedTeam.currentGameScore }}点</p>

        <div class="skittle-grid">
          <button
            v-for="n in 12"
            :key="n"
            :class="['skittle', { on: selectedSkittles.has(n) }]"
            @click="toggle(n)"
          >
            {{ n }}
          </button>
        </div>
      </div>

      <div class="page-scroll pad">
        <div v-if="!recommendations.combinations.length" class="center muted empty">
          <p style="font-size: 2rem">⚠️</p>
          <p>推薦できる組み合わせがありません</p>
          <p>3手以内で達成できません</p>
        </div>
        <div v-else class="rec-grid">
          <div
            v-for="(item, idx) in filtered"
            :key="idx"
            :class="['rec', { dimmed: item.dimmed }]"
          >
            <span class="rec-no">{{ idx + 1 }}</span>
            <div class="combo">
              <template v-for="(n, ci) in item.combo" :key="ci">
                <button :class="['mini', { on: selectedSkittles.has(n) }]" @click="toggle(n)">{{ n }}</button>
                <span v-if="ci < item.combo.length - 1" class="arrow">→</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.team-tabs .chip {
  flex: 1;
  width: auto;
}
.skittle-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
}
.skittle {
  aspect-ratio: 1;
  border-radius: 8px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.85);
  color: var(--navy);
  border: 2px solid #fff;
}
.skittle.on {
  background: var(--navy);
  color: #fff;
}
.rec-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
}
.rec {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  padding: 0.5rem;
}
.rec.dimmed {
  opacity: 0.4;
}
.rec-no {
  width: 1.3rem;
  height: 1.3rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}
.combo {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  flex-wrap: wrap;
}
.mini {
  min-width: 1.7rem;
  height: 1.5rem;
  border-radius: 5px;
  font-size: 0.8rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  border: 1px solid #fff;
}
.mini.on {
  background: var(--navy);
}
.arrow {
  font-size: 0.7rem;
  opacity: 0.7;
}
.empty {
  padding: 2rem 0;
}
</style>
