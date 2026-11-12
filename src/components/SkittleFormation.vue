<script setup>
// The twelve skittles in their starting formation, seen from above with the
// throwing line at the bottom. Used as the app's emblem on the home screen.
const rows = [
  [7, 9, 8],
  [5, 11, 12, 6],
  [3, 10, 4],
  [1, 2],
]

// Order in which pins appear: front row first, like setting the rack.
const order = [1, 2, 3, 10, 4, 5, 11, 12, 6, 7, 9, 8]
function delay(n) {
  return `${order.indexOf(n) * 28}ms`
}
</script>

<template>
  <div class="formation" role="img" aria-label="モルックのスキットル12本の初期配置">
    <div v-for="(row, ri) in rows" :key="ri" class="f-row">
      <span v-for="n in row" :key="n" class="pin" :style="{ animationDelay: delay(n) }">{{ n }}</span>
    </div>
  </div>
</template>

<style scoped>
.formation {
  --d: clamp(25px, 7.9vw, 31px);
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.f-row {
  display: flex;
  gap: 3px;
}
.f-row + .f-row {
  margin-top: -2px; /* rows nest into each other like the real rack */
}
.pin {
  width: var(--d);
  height: var(--d);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--navy);
  color: var(--white);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  animation: pin-in 0.36s var(--ease-out) both;
}
@keyframes pin-in {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}
</style>
