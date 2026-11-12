<script setup>
// Bottom sheet used by every modal: slides up from the thumb zone, keeps its
// title and actions fixed, and scrolls only the middle. Tapping the backdrop,
// the close button or Esc emits `close`.
import { onMounted, onBeforeUnmount, ref } from 'vue'
import AppIcon from './AppIcon.vue'

defineProps({
  title: { type: String, required: true },
  sub: { type: String, default: '' },
  closeLabel: { type: String, default: '閉じる' },
  // When closing has a consequence worth spelling out (e.g. it discards an
  // entry), show these words instead of the bare × icon.
  closeText: { type: String, default: '' },
})
const emit = defineEmits(['close'])

const sheet = ref(null)
function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  sheet.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="sheet-overlay" @click.self="emit('close')">
      <section ref="sheet" class="sheet" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <header class="sheet-head">
          <div class="titles">
            <h2>{{ title }}</h2>
            <p v-if="sub">{{ sub }}</p>
          </div>
          <button v-if="closeText" class="close-text" @click="emit('close')">{{ closeText }}</button>
          <button v-else class="icon-btn" :aria-label="closeLabel" @click="emit('close')">
            <AppIcon name="close" />
          </button>
        </header>
        <div class="sheet-body">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="sheet-foot">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  background: rgba(29, 53, 87, 0.45);
  animation: overlay-in 0.18s ease both;
}
.sheet {
  position: relative;
  width: 100%;
  max-width: var(--shell-max);
  max-height: 92vh;
  max-height: 92dvh;
  display: flex;
  flex-direction: column;
  background: var(--white);
  color: var(--ink);
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  box-shadow: var(--shadow-pop);
  padding-bottom: env(safe-area-inset-bottom);
  animation: sheet-in 0.28s var(--ease-out) both;
  outline: none;
}
.sheet-head {
  flex: none;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 18px 10px 10px 20px;
}
.titles {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
h2 {
  font-size: 1.1875rem;
  font-weight: 700;
  line-height: 1.35;
}
p {
  font-size: 0.8125rem;
  color: var(--ink-2);
  margin-top: 2px;
}
.close-text {
  flex: none;
  min-height: 44px;
  padding: 0 12px;
  margin-right: 6px;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ink-2);
}
.close-text:active {
  background: var(--sky-100);
}
.sheet-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 6px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.sheet-foot {
  flex: none;
  padding: 12px 20px 16px;
  border-top: 1px solid var(--line);
  display: flex;
  gap: 10px;
}

@keyframes overlay-in {
  from {
    opacity: 0;
  }
}
@keyframes sheet-in {
  from {
    transform: translateY(32px);
    opacity: 0;
  }
}
</style>
