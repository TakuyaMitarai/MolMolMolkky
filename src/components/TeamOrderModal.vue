<script setup>
// Throwing-order picker. Teams are cards that can be nudged up/down, or
// shuffled: the cards turn face-down, gather into a deck, get riffled a few
// times, then are dealt back into their slots and turned over one by one.
import { ref, reactive, computed, onBeforeUnmount } from 'vue'
import { teamLabel } from '../lib/teamLabel.js'
import AppIcon from './AppIcon.vue'
import BottomSheet from './BottomSheet.vue'

const props = defineProps({
  teams: { type: Array, required: true },
  title: { type: String, default: '投げる順番' },
  sub: { type: String, default: '' },
  confirmLabel: { type: String, default: 'この順番で確定' },
})
const emit = defineEmits(['confirm', 'close'])

const ROW_H = 60
const GAP = 10
const STEP = ROW_H + GAP
const RIFFLES = 4
const BEAT = 130 // ms for each half of a riffle (apart, then together)

// Cards keep a stable DOM order and are placed with transforms, so every
// reorder is a real movement rather than a re-render that jumps.
const cards = props.teams.map((t) => ({ ...t }))
const order = ref(cards.map((t) => t.id)) // team ids in throwing order
const phase = ref('idle') // idle | gather | riffle | deal
const busy = computed(() => phase.value !== 'idle')
const announcement = ref('')
const deckEl = ref(null)

const fx = reactive({})
for (const c of cards) fx[c.id] = { x: 0, y: 0, rot: 0, scale: 1, z: 1, faceDown: false, deal: 0 }

function layout(raised = null) {
  order.value.forEach((id, i) => {
    Object.assign(fx[id], { x: 0, y: i * STEP, rot: 0, scale: 1, z: id === raised ? 5 : 1, faceDown: false })
  })
}
layout()

const deckHeight = computed(() => cards.length * STEP - GAP)
function posOf(id) {
  return order.value.indexOf(id)
}
function slotStyle(id) {
  const f = fx[id]
  return {
    transform: `translate3d(${f.x}%, ${f.y}px, 0) rotate(${f.rot}deg) scale(${f.scale})`,
    zIndex: f.z,
  }
}

function move(id, dir) {
  if (busy.value) return
  const i = posOf(id)
  const j = i + dir
  if (j < 0 || j >= order.value.length) return
  const next = [...order.value]
  ;[next[i], next[j]] = [next[j], next[i]]
  order.value = next
  layout(id)
}

// ----- shuffle -----
let timer = null
let alive = true
onBeforeUnmount(() => {
  alive = false
  clearTimeout(timer)
})
const wait = (ms) => new Promise((resolve) => (timer = setTimeout(resolve, ms)))

function fisherYates(list) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function announce() {
  const names = order.value.map((id, i) => `${i + 1}番 ${teamLabel(cards.find((c) => c.id === id))}`)
  announcement.value = `順番が決まりました。${names.join('、')}`
}

async function shuffle() {
  if (busy.value) return
  const n = cards.length
  // The result is decided up front by an unbiased shuffle; everything after
  // this line is only the show.
  const finalOrder = fisherYates(order.value)

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    order.value = finalOrder
    layout()
    announce()
    return
  }

  // with many teams the list can run past the fold: bring it into view first
  deckEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

  const centerY = ((n - 1) * STEP) / 2
  let deck = [...order.value].reverse() // bottom → top
  const stack = () =>
    deck.forEach((id, depth) => {
      Object.assign(fx[id], {
        x: 0,
        y: centerY - (depth - (n - 1) / 2) * 5,
        rot: (Math.random() * 2 - 1) * 2.5,
        scale: 0.84,
        z: 10 + depth,
      })
    })

  // 1. turn face-down and gather into a deck
  phase.value = 'gather'
  for (const id of order.value) fx[id].faceDown = true
  stack()
  await wait(340)
  if (!alive) return

  // 2. riffle: split the deck into two hands, then drop them back together
  //    in a new stacking order
  phase.value = 'riffle'
  for (let r = 0; r < RIFFLES; r++) {
    const mixed = fisherYates(deck)
    const cut = Math.max(1, Math.min(n - 1, Math.round(n / 2)))
    const left = new Set(mixed.slice(0, cut))
    for (const id of deck) {
      const side = left.has(id) ? -1 : 1
      Object.assign(fx[id], {
        x: side * (31 + Math.random() * 6),
        rot: side * (6 + Math.random() * 6),
        y: fx[id].y + (Math.random() * 2 - 1) * 8,
      })
    }
    await wait(BEAT)
    if (!alive) return
    deck = mixed
    stack()
    await wait(BEAT)
    if (!alive) return
  }

  // 3. deal: each card flies to its slot and turns over, first thrower first
  phase.value = 'deal'
  order.value = finalOrder
  for (let i = 0; i < n; i++) {
    const id = finalOrder[i]
    Object.assign(fx[id], { x: 0, y: i * STEP, rot: 0, scale: 1, z: 30 + i, faceDown: false })
    fx[id].deal += 1 // restarts the turn-over animation
    await wait(150)
    if (!alive) return
  }
  await wait(240)
  if (!alive) return
  phase.value = 'idle'
  layout()
  announce()
}

function confirm() {
  if (busy.value) return
  emit(
    'confirm',
    order.value.map((id) => cards.find((c) => c.id === id))
  )
}
</script>

<template>
  <BottomSheet :title="title" :sub="sub" @close="emit('close')">
    <p class="lead">上のチームから順に投げます。シャッフルで決めるか、矢印で入れ替えます。</p>

    <button class="btn btn-secondary" :disabled="busy" @click="shuffle">
      <AppIcon name="shuffle" :size="20" />{{ busy ? 'シャッフル中' : 'シャッフルで決める' }}
    </button>

    <div ref="deckEl" class="deck-clip">
      <div :class="['deck', phase]" role="list" :style="{ height: deckHeight + 'px' }">
        <!-- empty numbered places the cards are dealt into -->
        <div
          v-for="i in cards.length"
          :key="'place' + i"
          class="place"
          aria-hidden="true"
          :style="{ transform: `translateY(${(i - 1) * STEP}px)` }"
        >
          <span class="num">{{ i }}</span>
        </div>
        <div
          v-for="team in cards"
          :key="team.id"
          class="slot"
          role="listitem"
          :aria-label="`${posOf(team.id) + 1}番目 ${teamLabel(team)}`"
          :style="slotStyle(team.id)"
        >
          <div :key="fx[team.id].deal" :class="['order-card', { 'face-down': fx[team.id].faceDown, dealt: fx[team.id].deal > 0 }]">
            <span class="pos num">{{ posOf(team.id) + 1 }}</span>
            <span class="name ellipsis">{{ teamLabel(team) }}</span>
            <span class="arrows">
              <button
                class="icon-btn"
                :disabled="busy || posOf(team.id) === 0"
                :aria-label="`${teamLabel(team)}を1つ上へ`"
                @click="move(team.id, -1)"
              >
                <AppIcon name="up" :size="20" />
              </button>
              <button
                class="icon-btn"
                :disabled="busy || posOf(team.id) === cards.length - 1"
                :aria-label="`${teamLabel(team)}を1つ下へ`"
                @click="move(team.id, 1)"
              >
                <AppIcon name="down" :size="20" />
              </button>
            </span>
            <span class="back" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>
      </div>
    </div>

    <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

    <template #footer>
      <button class="btn btn-primary" :disabled="busy" @click="confirm">{{ confirmLabel }}</button>
    </template>
  </BottomSheet>
</template>

<style scoped>
/* Cards may slide past the deck while being riffled; clip them at the sheet
   edge instead of letting the sheet scroll sideways. */
.deck-clip {
  overflow: hidden;
  margin: -14px -20px;
  padding: 14px 20px;
}
.deck {
  position: relative;
  --dur: 0.28s;
  --ease: var(--ease-out);
}
.deck.gather {
  --dur: 0.32s;
}
.deck.riffle {
  --dur: 0.13s;
  --ease: cubic-bezier(0.4, 0, 0.3, 1);
}
.deck.deal {
  --dur: 0.42s;
  --ease: cubic-bezier(0.2, 1.25, 0.35, 1);
}

.slot {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  perspective: 600px;
  transition: transform var(--dur) var(--ease);
  will-change: transform;
}

.order-card {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 6px 0 12px;
  border-radius: 14px;
  background: var(--white);
  box-shadow: inset 0 0 0 1.5px var(--line-strong), 0 2px 8px rgba(29, 53, 87, 0.08);
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
.order-card > .pos,
.order-card > .name,
.order-card > .arrows {
  transition: opacity 0.14s ease;
}
.pos {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--navy);
  color: var(--white);
  font-weight: 700;
}
.name {
  flex: 1;
  min-width: 0;
  font-weight: 700;
}
.arrows {
  flex: none;
  display: flex;
}
.arrows .icon-btn {
  width: 42px;
}

/* numbered places, visible only while the cards are away being shuffled */
.place {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  padding-left: 12px;
  border-radius: 14px;
  border: 1.5px dashed var(--line-strong);
  opacity: 0;
  transition: opacity 0.25s ease;
}
.place span {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--fill);
  color: var(--ink-2);
  font-weight: 700;
}
.deck.gather .place,
.deck.riffle .place,
.deck.deal .place {
  opacity: 1;
}

/* face-down: the card shows a plain navy back with three pin dots */
.back {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.14s ease;
}
.back i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--sky);
}
.order-card.face-down {
  background: var(--navy);
  box-shadow: inset 0 0 0 1.5px var(--navy), 0 0 0 1.5px var(--white), 0 6px 16px rgba(29, 53, 87, 0.28);
}
.order-card.face-down > .pos,
.order-card.face-down > .name,
.order-card.face-down > .arrows {
  opacity: 0;
}
.order-card.face-down > .back {
  opacity: 1;
}

/* turning over as it lands */
.order-card.dealt {
  animation: turn-over 0.42s var(--ease-out) both;
}
.order-card.dealt > .pos {
  animation: pos-pop 0.4s cubic-bezier(0.2, 1.6, 0.4, 1) 0.14s both;
}
@keyframes turn-over {
  0% {
    transform: rotateX(-86deg);
    background: var(--navy);
  }
  45% {
    background: var(--navy);
  }
  100% {
    transform: rotateX(0);
    background: var(--white);
  }
}
@keyframes pos-pop {
  from {
    transform: scale(0.2);
    opacity: 0;
  }
}
</style>
