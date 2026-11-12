<script setup>
// Small centred dialog for confirmations and one-button notices. Replaces the
// browser's native confirm()/alert so the wording and buttons match the app.
// Leave `cancelLabel` empty for a notice with a single button.
import { onMounted, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'OK' },
  cancelLabel: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'cancel'])

const box = ref(null)
function dismiss() {
  emit(props.cancelLabel ? 'cancel' : 'confirm')
}
function onKey(e) {
  if (e.key === 'Escape') dismiss()
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  box.value?.focus({ preventScroll: true })
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="dialog-overlay" @click.self="dismiss">
      <section ref="box" class="dialog" role="alertdialog" aria-modal="true" :aria-label="title" tabindex="-1">
        <h2>{{ title }}</h2>
        <p v-if="message">{{ message }}</p>
        <div class="actions">
          <button v-if="cancelLabel" class="btn btn-soft" @click="emit('cancel')">{{ cancelLabel }}</button>
          <button class="btn btn-primary" @click="emit('confirm')">{{ confirmLabel }}</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(29, 53, 87, 0.45);
  animation: overlay-in 0.16s ease both;
}
.dialog {
  width: 100%;
  max-width: 340px;
  background: var(--white);
  color: var(--ink);
  border-radius: var(--radius-l);
  box-shadow: var(--shadow-pop);
  padding: 24px 20px 20px;
  animation: dialog-in 0.22s var(--ease-out) both;
  outline: none;
}
h2 {
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.4;
}
p {
  margin-top: 8px;
  font-size: 0.9375rem;
  color: var(--ink-2);
  white-space: pre-line;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
@keyframes overlay-in {
  from {
    opacity: 0;
  }
}
@keyframes dialog-in {
  from {
    transform: scale(0.94);
    opacity: 0;
  }
}
</style>
