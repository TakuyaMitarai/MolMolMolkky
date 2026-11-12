<script setup>
// Distance in whole metres (4–12). One tap per value instead of a slider,
// which is hard to hit precisely outdoors with one hand.
const props = defineProps({
  modelValue: { type: Number, required: true },
  min: { type: Number, default: 4 },
  max: { type: Number, default: 12 },
})
const emit = defineEmits(['update:modelValue'])

const steps = Array.from({ length: props.max - props.min + 1 }, (_, i) => props.min + i)
</script>

<template>
  <div class="group">
    <div class="head">
      <span class="label">距離</span>
      <span class="value num">{{ modelValue }}<small>m</small></span>
    </div>
    <div class="scale" role="radiogroup" aria-label="距離（メートル）">
      <button
        v-for="d in steps"
        :key="d"
        type="button"
        role="radio"
        :aria-checked="modelValue === d"
        :aria-label="`${d}メートル`"
        :class="['step', { on: modelValue === d }]"
        @click="emit('update:modelValue', d)"
      >
        {{ d }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
}
.value small {
  font-size: 0.8125rem;
  font-weight: 600;
  margin-left: 1px;
}
.scale {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 3px;
  padding: 3px;
  border-radius: 12px;
  background: var(--fill);
}
.step {
  min-height: 44px;
  border-radius: 9px;
  font-size: 1rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
  transition: background-color 0.12s ease, color 0.12s ease;
}
.step.on {
  background: var(--navy);
  color: var(--white);
}
</style>
