<script setup>
const props = defineProps({
  team: { type: Object, required: true },
  currentPlayerIndex: { type: Number, required: true },
})
const emit = defineEmits(['select', 'close'])

function teamLabel(team) {
  const names = (team.players || []).map((p) => p.user?.name).filter(Boolean)
  return names.length ? names.join(' & ') : team.name
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet page">
      <div class="navbar">
        <span class="spacer" />
        <button class="btn-inline" @click="emit('close')">✕</button>
      </div>
      <h1 class="page-title">👥 {{ teamLabel(team) }}</h1>
      <h2 class="section-title">プレイヤー選択</h2>

      <div class="pad col">
        <button
          v-for="(p, i) in team.players"
          :key="p.id"
          :class="['select-row', { current: i === currentPlayerIndex }]"
          @click="emit('select', i)"
        >
          <div class="info">
            <div class="name">{{ p.name }}</div>
            <div class="sub">{{ p.user ? '登録済み: ' + p.user.name : '未登録' }}</div>
          </div>
          <span v-if="i === currentPlayerIndex" class="check">✓</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-row {
  display: flex;
  align-items: center;
  padding: 0.9rem 1rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  text-align: left;
}
.select-row.current {
  background: rgba(47, 168, 79, 0.25);
}
.select-row .info {
  flex: 1;
}
.select-row .name {
  font-weight: 700;
}
.select-row .sub {
  font-size: 0.8rem;
  opacity: 0.7;
}
.check {
  color: var(--c-green);
  font-size: 1.3rem;
}
</style>
