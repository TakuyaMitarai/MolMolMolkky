<script setup>
import { ref, computed, watch } from 'vue'
import BottomSheet from './BottomSheet.vue'
import DistancePicker from './DistancePicker.vue'

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
  <BottomSheet
    title="投擲詳細"
    :sub="isMiss ? '失投（0点）の内容を記録します' : `${score}点の投げ方を記録します`"
    close-text="入力をやめる"
    @close="emit('close')"
  >
    <div class="group">
      <span class="label">投げ方</span>
      <div class="chips" role="radiogroup" aria-label="投げ方">
        <button
          v-for="t in throwTypes"
          :key="t.id"
          type="button"
          role="radio"
          :aria-checked="throwTypeName === t.name"
          :class="['chip', { selected: throwTypeName === t.name }]"
          @click="throwTypeName = t.name"
        >
          {{ t.name }}
        </button>
      </div>
    </div>

    <template v-if="!isGasha && !isMiss">
      <div class="group">
        <span class="label">結果</span>
        <div class="seg" role="radiogroup" aria-label="結果">
          <button
            type="button"
            role="radio"
            :aria-checked="isSuccessful"
            :class="['seg-btn', { on: isSuccessful }]"
            @click="isSuccessful = true"
          >
            成功
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="!isSuccessful"
            :class="['seg-btn', { on: !isSuccessful }]"
            @click="isSuccessful = false"
          >
            失敗
          </button>
        </div>
      </div>
      <DistancePicker v-model="distance" />
    </template>

    <p v-else-if="isGasha" class="note">
      <strong>ガシャ投げ</strong>
      倒したピンは{{ score }}本。距離の記録は不要です。
    </p>

    <template v-else>
      <p class="note"><strong>失投</strong>得点は0点。失敗として記録します。</p>
      <DistancePicker v-model="distance" />
    </template>

    <template #footer>
      <button class="btn btn-soft narrow" @click="emit('skip')">詳細なしで記録</button>
      <button class="btn btn-primary" @click="emit('confirm', details())">詳細を保存</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.note {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--sky-50);
  box-shadow: inset 0 0 0 1px var(--sky-200);
  font-size: 0.875rem;
  color: var(--ink-2);
}
.note strong {
  display: block;
  font-size: 1rem;
  color: var(--navy);
}
</style>
