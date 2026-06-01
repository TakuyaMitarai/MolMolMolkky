<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  teamName: { type: String, required: true },
  playerName: { type: String, default: '' },
  turnNumber: { type: Number, required: true },
  score: { type: Number, required: true },
  isMiss: { type: Boolean, default: false },
  // detailed = registered player whose turn has a linked stats record
  detailed: { type: Boolean, default: false },
  throwTypes: { type: Array, default: () => [] },
  details: { type: Object, default: null },
})
const emit = defineEmits(['confirm', 'close'])

const selScore = ref(props.score)
const throwTypeName = ref(props.details?.throwTypeName ?? props.throwTypes[0]?.name ?? '横投げ')
const distance = ref(props.details?.distance ?? 4)
const isSuccessful = ref(props.details?.isSuccessful ?? props.score !== 0)
const notes = props.details?.notes ?? null

const isGasha = computed(() => throwTypeName.value === 'ガシャ')
const isMissSel = computed(() => selScore.value === 0)

watch(throwTypeName, (name) => {
  if (name === 'ガシャ') {
    distance.value = 4
    isSuccessful.value = true
  } else if (distance.value < 4) {
    distance.value = 4
  }
})

function confirm() {
  if (!props.detailed) {
    emit('confirm', { score: selScore.value, details: null })
    return
  }
  emit('confirm', {
    score: selScore.value,
    details: {
      throwTypeName: throwTypeName.value,
      distance: distance.value,
      isSuccessful: isMissSel.value ? false : isSuccessful.value,
      notes,
    },
  })
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="edit-box">
      <h2>投擲を編集</h2>
      <p class="muted">{{ teamName }} ・ 第{{ turnNumber }}ターン</p>
      <p v-if="playerName" class="muted small">{{ playerName }}</p>

      <!-- score / miss -->
      <h3 class="lbl">{{ isGasha ? 'ピン数' : '得点' }}</h3>
      <div class="grid">
        <button
          v-for="n in 13"
          :key="n - 1"
          :class="['chip', { selected: selScore === n - 1 }]"
          @click="selScore = n - 1"
        >
          {{ n - 1 === 0 ? '失投' : n - 1 }}
        </button>
      </div>

      <!-- detailed fields (registered player with a stats record) -->
      <template v-if="detailed">
        <h3 class="lbl">投げ方</h3>
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

        <template v-if="!isGasha && !isMissSel">
          <h3 class="lbl">結果</h3>
          <div class="row two">
            <button :class="['chip', { selected: isSuccessful }]" @click="isSuccessful = true">成功</button>
            <button :class="['chip', { selected: !isSuccessful }]" @click="isSuccessful = false">失敗</button>
          </div>
          <h3 class="lbl">距離</h3>
          <div class="slider-row">
            <span class="muted">4m</span>
            <input type="range" min="4" max="12" step="1" v-model.number="distance" />
            <span class="muted">12m</span>
          </div>
          <p class="dist">{{ distance }}m</p>
        </template>

        <template v-else-if="isGasha">
          <p class="muted note">ガシャ投げ ・ 倒したピン: {{ selScore }}個</p>
        </template>

        <template v-else>
          <p class="note">失投（得点0）</p>
          <h3 class="lbl">距離</h3>
          <div class="slider-row">
            <span class="muted">4m</span>
            <input type="range" min="4" max="12" step="1" v-model.number="distance" />
            <span class="muted">12m</span>
          </div>
          <p class="dist">{{ distance }}m</p>
        </template>
      </template>

      <div class="row actions">
        <button class="btn btn-secondary" @click="emit('close')">キャンセル</button>
        <button class="btn btn-primary" @click="confirm">保存</button>
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
  padding: 1.25rem;
  width: 92%;
  max-width: 380px;
  max-height: 90dvh;
  overflow-y: auto;
  text-align: center;
}
.edit-box h2 {
  margin: 0 0 0.25rem;
}
.small {
  font-size: 0.8rem;
}
.lbl {
  margin: 0.9rem 0 0.4rem;
  font-size: 0.95rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
.chip-row {
  display: flex;
  gap: 0.5rem;
  padding-bottom: 0.25rem;
}
.chip-row .chip {
  white-space: nowrap;
  width: auto;
}
.two .chip {
  flex: 1;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.slider-row input {
  flex: 1;
}
.dist {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0.3rem 0;
}
.note {
  margin: 0.6rem 0;
}
.actions {
  margin-top: 1rem;
}
</style>
