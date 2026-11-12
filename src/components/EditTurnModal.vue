<script setup>
import { ref, computed, watch } from 'vue'
import BottomSheet from './BottomSheet.vue'
import DistancePicker from './DistancePicker.vue'

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

const subtitle = computed(() => {
  const who = props.playerName && props.playerName !== props.teamName ? `　${props.playerName}` : ''
  return `${props.teamName}　第${props.turnNumber}ターン${who}`
})

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
  <BottomSheet title="投擲を修正" :sub="subtitle" @close="emit('close')">
    <!-- score / miss -->
    <div class="group">
      <span class="label">{{ isGasha ? '倒したピン数' : '得点' }}</span>
      <div class="pin-grid" role="radiogroup" :aria-label="isGasha ? '倒したピン数' : '得点'">
        <button
          v-for="n in 12"
          :key="n"
          type="button"
          role="radio"
          :aria-checked="selScore === n"
          :class="['pin-key', 'pick', { selected: selScore === n }]"
          @click="selScore = n"
        >
          {{ n }}
        </button>
      </div>
      <button
        type="button"
        role="radio"
        :aria-checked="selScore === 0"
        :class="['chip', 'miss-chip', { selected: selScore === 0 }]"
        @click="selScore = 0"
      >
        失投（0点）
      </button>
    </div>

    <!-- detailed fields (registered player with a stats record) -->
    <template v-if="detailed">
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

      <template v-if="!isGasha && !isMissSel">
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

      <p v-else-if="isGasha" class="hint">ガシャ投げ。倒したピンは{{ selScore }}本として記録します。</p>

      <template v-else>
        <p class="hint">失投（0点）。失敗として記録します。</p>
        <DistancePicker v-model="distance" />
      </template>
    </template>

    <template #footer>
      <button class="btn btn-soft narrow" @click="emit('close')">やめる</button>
      <button class="btn btn-primary" @click="confirm">修正を保存</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
.miss-chip {
  width: 100%;
}
</style>
