<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  score: { type: Number, required: true },
  throwTypes: { type: Array, required: true },
})
const emit = defineEmits(['confirm', 'skip', 'close'])

const throwTypeName = ref(props.throwTypes[0]?.name ?? '横投げ')
const distance = ref(4)
const isSuccessful = ref(props.score !== 0)
const notes = ref('')

const isGasha = computed(() => throwTypeName.value === 'ガシャ')
const isMiss = computed(() => props.score === 0)

watch(throwTypeName, (name) => {
  if (name === 'ガシャ') {
    distance.value = 4
    isSuccessful.value = true
  } else if (distance.value < 4) {
    distance.value = 4
  }
})

function details() {
  return {
    throwTypeName: throwTypeName.value,
    distance: distance.value,
    isSuccessful: isMiss.value ? false : isSuccessful.value,
    notes: notes.value.trim() || null,
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="sheet page">
      <div class="navbar">
        <span class="spacer" />
        <button class="btn-inline" @click="emit('close')">キャンセル</button>
      </div>
      <h1 class="page-title">⚪ 投擲詳細</h1>
      <p class="center muted">得点: {{ score }}点</p>

      <div class="pad col">
        <h2 class="section-title">投げ方</h2>
        <div class="scroll-x">
          <div class="chip-row">
            <button
              v-for="t in throwTypes"
              :key="t.id"
              :class="['chip', { selected: throwTypeName === t.name }]"
              @click="throwTypeName = t.name"
            >
              {{ t.name }}
            </button>
          </div>
        </div>

        <template v-if="!isGasha && !isMiss">
          <h2 class="section-title">結果</h2>
          <div class="row">
            <button :class="['chip', { selected: isSuccessful }]" @click="isSuccessful = true">成功</button>
            <button :class="['chip', { selected: !isSuccessful }]" @click="isSuccessful = false">失敗</button>
          </div>
          <h2 class="section-title">距離</h2>
          <div class="slider-row">
            <span class="muted">4m</span>
            <input type="range" min="4" max="12" step="1" v-model.number="distance" />
            <span class="muted">12m</span>
          </div>
          <p class="center big">{{ distance }}m</p>
        </template>

        <template v-else-if="isGasha">
          <div class="card center">
            <p class="big">ガシャ投げ</p>
            <p>倒したピンの数: {{ score }}個</p>
            <p class="muted">距離や位置の記録は不要です</p>
          </div>
        </template>

        <template v-else>
          <div class="card center">
            <p class="big">失投</p>
            <p class="muted">得点: 0点</p>
          </div>
          <h2 class="section-title">距離</h2>
          <div class="slider-row">
            <span class="muted">4m</span>
            <input type="range" min="4" max="12" step="1" v-model.number="distance" />
            <span class="muted">12m</span>
          </div>
          <p class="center big">{{ distance }}m</p>
        </template>
      </div>

      <div class="pad footer row">
        <button class="btn btn-secondary" @click="emit('skip')">スキップ</button>
        <button class="btn btn-primary" @click="emit('confirm', details())">詳細を保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chip-row {
  display: flex;
  gap: 0.5rem;
  padding-bottom: 0.25rem;
}
.chip-row .chip {
  white-space: nowrap;
  width: auto;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.slider-row input {
  flex: 1;
}
.big {
  font-size: 1.4rem;
  font-weight: 700;
}
.footer {
  padding-bottom: 1.5rem;
}
</style>
