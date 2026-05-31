<script setup>
import { ref } from 'vue'

const props = defineProps({
  teamName: { type: String, required: true },
  playerName: { type: String, default: '' },
  turnNumber: { type: Number, required: true },
  currentScore: { type: Number, required: true },
  currentIsMiss: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'close'])

const selected = ref(props.currentIsMiss ? 0 : props.currentScore)
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="edit-box">
      <h2>投擲を編集</h2>
      <p class="muted">{{ teamName }} ・ 第{{ turnNumber }}ターン</p>
      <p v-if="playerName" class="muted small">{{ playerName }}</p>

      <div class="grid">
        <button
          v-for="n in 13"
          :key="n - 1"
          :class="['chip', { selected: selected === n - 1 }]"
          @click="selected = n - 1"
        >
          {{ n - 1 === 0 ? '失投' : n - 1 }}
        </button>
      </div>

      <div class="row actions">
        <button class="btn btn-secondary" @click="emit('close')">キャンセル</button>
        <button class="btn btn-primary" @click="emit('confirm', selected)">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-box {
  margin: auto;
  background: var(--navy);
  border: 2px solid #fff;
  border-radius: 14px;
  padding: 1.5rem;
  width: 90%;
  max-width: 360px;
  text-align: center;
}
.edit-box h2 {
  margin: 0 0 0.25rem;
}
.small {
  font-size: 0.8rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin: 1rem 0;
}
.actions {
  margin-top: 0.5rem;
}
</style>
