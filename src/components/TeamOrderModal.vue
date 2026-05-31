<script setup>
import { ref } from 'vue'

const props = defineProps({ teams: { type: Array, required: true } })
const emit = defineEmits(['confirm', 'close'])

const list = ref(props.teams.map((t) => ({ ...t })))

function teamLabel(team) {
  const names = (team.players || []).map((p) => p.user?.name).filter(Boolean)
  return names.length ? names.join(' & ') : team.name
}
function move(i, dir) {
  const j = i + dir
  if (j < 0 || j >= list.value.length) return
  const tmp = list.value[i]
  list.value[i] = list.value[j]
  list.value[j] = tmp
}
function shuffle() {
  for (let i = list.value.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[list.value[i], list.value[j]] = [list.value[j], list.value[i]]
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet page">
      <div class="navbar">
        <span class="spacer" />
        <button class="btn-inline" @click="emit('close')">✕</button>
      </div>
      <h1 class="page-title">チーム順序設定</h1>
      <h2 class="section-title">投擲順序</h2>

      <div class="page-scroll pad">
        <div v-for="(team, i) in list" :key="team.id" class="order-row">
          <span class="pos">{{ i + 1 }}</span>
          <span class="name">{{ teamLabel(team) }}</span>
          <div class="arrows">
            <button :disabled="i === 0" @click="move(i, -1)">▲</button>
            <button :disabled="i === list.length - 1" @click="move(i, 1)">▼</button>
          </div>
        </div>
        <button class="btn btn-secondary shuffle" @click="shuffle">🎲 ランダムで決定</button>
      </div>

      <div class="pad footer">
        <button class="btn btn-primary" @click="emit('confirm', list)">この順序で確定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.order-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--navy);
  border-radius: 10px;
  padding: 0.9rem 1rem;
  margin-bottom: 0.75rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
.pos {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}
.name {
  flex: 1;
  font-weight: 700;
}
.arrows {
  display: flex;
  gap: 0.4rem;
}
.arrows button {
  color: #fff;
  font-size: 1rem;
  padding: 0.3rem 0.5rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
}
.arrows button:disabled {
  opacity: 0.3;
}
.shuffle {
  margin-top: 0.5rem;
}
.footer {
  padding-bottom: 1.5rem;
}
</style>
