<script setup>
// Shared top bar: back button on the left, title beside it, optional action
// on the right. Every sub-page uses it so "how do I leave?" has one answer.
import AppIcon from './AppIcon.vue'

defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
  backLabel: { type: String, default: '戻る' },
})
defineEmits(['back'])
</script>

<template>
  <header class="page-head">
    <button class="icon-btn" :aria-label="backLabel" @click="$emit('back')">
      <AppIcon name="back" />
    </button>
    <div class="titles">
      <h1>{{ title }}</h1>
      <p v-if="sub">{{ sub }}</p>
    </div>
    <slot name="action" />
  </header>
</template>

<style scoped>
.page-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 10px 6px;
}
.titles {
  flex: 1;
  min-width: 0;
}
h1 {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
}
p {
  font-size: 0.8125rem;
  color: var(--ink-2);
}
</style>
