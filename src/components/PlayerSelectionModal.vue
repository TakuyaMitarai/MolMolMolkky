<script setup>
import { teamLabel } from '../lib/teamLabel.js'
import AppIcon from './AppIcon.vue'
import BottomSheet from './BottomSheet.vue'

defineProps({
  team: { type: Object, required: true },
  currentPlayerIndex: { type: Number, required: true },
})
const emit = defineEmits(['select', 'close'])
</script>

<template>
  <BottomSheet title="投げる人を選ぶ" :sub="`チーム: ${teamLabel(team)}`" @close="emit('close')">
    <div class="list" role="radiogroup" aria-label="投げる人">
      <button
        v-for="(p, i) in team.players"
        :key="p.id"
        type="button"
        role="radio"
        :aria-checked="i === currentPlayerIndex"
        :class="['select-row', { current: i === currentPlayerIndex }]"
        @click="emit('select', i)"
      >
        <span class="avatar" aria-hidden="true">{{ p.name.slice(0, 1) }}</span>
        <span class="info">
          <span class="name ellipsis">{{ p.name }}</span>
          <span class="sub">{{ p.user ? '登録プレイヤー' : 'ゲスト' }}</span>
        </span>
        <span v-if="i === currentPlayerIndex" class="check"><AppIcon name="check" :size="20" /></span>
      </button>
    </div>
  </BottomSheet>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.select-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 64px;
  padding: 10px 14px 10px 12px;
  border-radius: 16px;
  background: var(--white);
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
  text-align: left;
  transition: transform 0.08s ease, background-color 0.12s ease;
}
.select-row:active {
  transform: scale(0.98);
  background: var(--sky-100);
}
.select-row.current {
  background: var(--sky-100);
  box-shadow: inset 0 0 0 2px var(--navy);
}
.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sky);
  font-weight: 700;
}
.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.name {
  font-weight: 700;
}
.sub {
  font-size: 0.75rem;
  color: var(--ink-2);
}
.check {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--navy);
  color: var(--white);
}
</style>
