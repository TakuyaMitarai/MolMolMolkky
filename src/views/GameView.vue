<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import {
  recordScore as engineRecord,
  selectPlayer as engineSelectPlayer,
  editTurn as engineEditTurn,
  resetForNextGame,
  undoLastThrow,
} from '../lib/gameEngine.js'
import { createThrowRecord, deepClone } from '../lib/models.js'
import { teamLabel } from '../lib/teamLabel.js'
import AppIcon from '../components/AppIcon.vue'
import BottomSheet from '../components/BottomSheet.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ThrowDetailsModal from '../components/ThrowDetailsModal.vue'
import RecommendationsModal from '../components/RecommendationsModal.vue'
import PlayerSelectionModal from '../components/PlayerSelectionModal.vue'
import TeamOrderModal from '../components/TeamOrderModal.vue'
import EditTurnModal from '../components/EditTurnModal.vue'

const router = useRouter()
const store = useDataStore()

const game = ref(null)
const showDetails = ref(true)
// The "record throw details" choice lives in the store (not persisted) so it
// survives a trip to the statistics screen and back.
const lastRegisteredSwitch = computed({
  get: () => store.recordDetails,
  set: (v) => (store.recordDetails = v),
})

const pendingScore = ref(0)
const showDetailsModal = ref(false)
const showRecommend = ref(false)
const showPlayerSelect = ref(false)
const showOrder = ref(false)
const orderMode = ref('next') // 'next' = carry totals over, 'reset' = same teams from zero
const showEnd = ref(false)
const alertMsg = ref('')
const askHome = ref(false)

const showEditModal = ref(false)
const editTarget = ref(null) // { teamIndex, turnIndex }

const boardMid = ref(null)

// Score keys laid out like the skittles' starting formation (throwing line at
// the bottom), the same arrangement as the home-screen emblem. Columns are half
// a key wide so each row sits offset from the next, as in the real rack.
const RACK = [
  [7, 9, 8],
  [5, 11, 12, 6],
  [3, 10, 4],
  [1, 2],
]
const rackKeys = RACK.flatMap((row, ri) => {
  const start = 4 - row.length + 2 // first grid line; the outer 1fr columns are lines 1–2 and 10–11
  return row.map((n, i) => ({ n, row: ri + 1, col: `${start + i * 2} / span 2` }))
})
const bodyEl = ref(null)
const totalsEl = ref(null)

onMounted(() => {
  if (!store.currentGame) {
    router.replace({ name: 'setup' })
    return
  }
  game.value = deepClone(store.currentGame)
  if (game.value.isFinished) showEnd.value = true
  updateSwitchState()
  nextTick(() => {
    scrollBoardToCurrent(false)
    followCurrentTeam(false)
  })
})

// ----- computed -----
const currentTeam = computed(() => {
  const g = game.value
  if (!g || g.currentTeamIndex < 0 || g.currentTeamIndex >= g.teams.length) return null
  return g.teams[g.currentTeamIndex]
})
const currentPlayer = computed(() => {
  const t = currentTeam.value
  if (!t) return null
  return t.players[t.currentPlayerIndex] ?? null
})
// Undo is derived from game progress (turnHistory), not a UI stack — so it
// survives navigating to stats and always steps back the latest throw.
const canUndo = computed(() => !!game.value && game.value.teams.some((t) => t.turnHistory.length > 0))

const scoreboard = computed(() => {
  const g = game.value
  const counts = g.teams.map((t) => t.turnHistory.length)
  const minTurns = counts.length ? Math.min(...counts) : 0
  const maxTurns = counts.length ? Math.max(...counts) : 0
  return {
    currentTurn: minTurns + 1,
    displayTurns: Math.max(9, maxTurns + 2),
  }
})

// Result table for the end-of-game sheet, highest total first.
const standings = computed(() => {
  const g = game.value
  if (!g) return []
  const rows = g.teams.map((t) => {
    const result = t.gameResults.find((r) => r.gameNumber === g.gameNumber)
    return {
      id: t.id,
      name: teamLabel(t),
      gameScore: result ? result.finalScore : t.currentGameScore,
      total: t.cumulativeScore,
      isWinner: g.winner?.id === t.id,
    }
  })
  rows.sort((a, b) => b.total - a.total)
  return rows.map((r) => ({ ...r, rank: 1 + rows.filter((o) => o.total > r.total).length }))
})

// ----- helpers -----
function ordinal(n) {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
}
function cellScore(team, turnIndex) {
  return turnIndex < team.turnHistory.length ? team.turnHistory[turnIndex].score : null
}
function isCurrentTeam(i) {
  return !game.value.isFinished && game.value.currentTeamIndex === i && !game.value.teams[i].isEliminated
}
function isNextCell(ti, turnIndex) {
  return isCurrentTeam(ti) && turnIndex === game.value.teams[ti].turnHistory.length
}
function updateSwitchState() {
  const p = currentPlayer.value
  if (!p) return
  if (p.user) showDetails.value = lastRegisteredSwitch.value
  else showDetails.value = false
}
function onSwitchToggle() {
  if (currentPlayer.value?.user) lastRegisteredSwitch.value = showDetails.value
}

// Keep the cell that is about to be filled in view: the board only shows
// about six turns at once and a long game runs well past that. It scrolls
// as little as possible, so earlier turns stay on screen as long as they fit.
const CELL_STEP = 36 // cell width + gap, must match the CSS below
const boardScrolled = ref(false)
function onBoardScroll() {
  boardScrolled.value = (boardMid.value?.scrollLeft ?? 0) > 2
}
function scrollBoardToCurrent(smooth = true) {
  const el = boardMid.value
  const g = game.value
  if (!el || !g) return
  // target: the next cell to fill, or the last throw once the game is over
  let idx
  if (g.isFinished) idx = Math.max(0, ...g.teams.map((t) => t.turnHistory.length)) - 1
  else if (currentTeam.value) idx = currentTeam.value.turnHistory.length
  else return
  const cellLeft = Math.max(0, idx) * CELL_STEP
  const viewLeft = el.scrollLeft
  let target = viewLeft
  const lookAhead = g.isFinished ? 0 : CELL_STEP // one empty turn to the right while playing
  if (cellLeft + CELL_STEP + lookAhead > viewLeft + el.clientWidth) {
    target = cellLeft + CELL_STEP + lookAhead - el.clientWidth
  } else if (cellLeft - CELL_STEP < viewLeft) {
    target = cellLeft - CELL_STEP // keep the previous turn visible
  }
  target = Math.max(0, target)
  if (Math.abs(target - viewLeft) > 1) el.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' })
}
// With many teams or a short screen the area above the keys scrolls. Keep the
// team that is about to throw in view: its score card in the top strip and
// its row on the board. Scrolls as little as possible, so the score cards
// stay on screen whenever the row fits below them.
function followCurrentTeam(smooth = true) {
  const g = game.value
  const body = bodyEl.value
  if (!g || !body) return
  const behavior = smooth ? 'smooth' : 'auto'
  if (g.isFinished) {
    if (body.scrollTop > 0) body.scrollTo({ top: 0, behavior })
    return
  }
  const strip = totalsEl.value
  const card = strip?.querySelector('.total.cur')
  if (card && strip.scrollWidth > strip.clientWidth + 1) {
    const s = strip.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    if (c.left < s.left) strip.scrollBy({ left: c.left - s.left - 8, behavior })
    else if (c.right > s.right) strip.scrollBy({ left: c.right - s.right + 8, behavior })
  }
  const row = body.querySelector('.b-team.cur')
  if (row) {
    const b = body.getBoundingClientRect()
    const rowBottom = row.getBoundingClientRect().bottom - b.top + body.scrollTop
    const target = Math.max(0, Math.min(rowBottom + 14 - body.clientHeight, body.scrollHeight - body.clientHeight))
    if (Math.abs(target - body.scrollTop) > 1) body.scrollTo({ top: target, behavior })
  }
}
watch(
  () => [
    game.value?.id,
    game.value?.gameNumber,
    game.value?.isFinished,
    game.value?.currentTeamIndex,
    currentTeam.value?.turnHistory.length,
  ],
  () =>
    nextTick(() => {
      scrollBoardToCurrent()
      followCurrentTeam()
    })
)

// ----- score entry -----
function pressScore(score) {
  pendingScore.value = score
  if (showDetails.value && currentPlayer.value?.user) {
    showDetailsModal.value = true
  } else {
    applyThrow(score, null)
  }
}
function onDetailsConfirm(details) {
  showDetailsModal.value = false
  applyThrow(pendingScore.value, details)
}
function onDetailsSkip() {
  showDetailsModal.value = false
  applyThrow(pendingScore.value, null)
}

function applyThrow(score, details) {
  const player = currentPlayer.value
  const user = player?.user
  const throwingTeamIndex = game.value.currentTeamIndex
  const { game: next, ended, eliminatedName } = engineRecord(game.value, score)
  game.value = next

  // ThrowRecord (for stats) only when details were confirmed, registered player.
  // Link it to the just-recorded turn so edits/undo can keep them in sync.
  if (details && user) {
    const record = createThrowRecord({
      throwTypeName: details.throwTypeName,
      distance: details.distance,
      score,
      isSuccessful: details.isSuccessful,
      notes: details.notes,
    })
    const lastTurn = next.teams[throwingTeamIndex].turnHistory.at(-1)
    if (lastTurn) {
      lastTurn.throwRecordId = record.id
      lastTurn.details = {
        throwTypeName: details.throwTypeName,
        distance: details.distance,
        isSuccessful: details.isSuccessful,
        notes: details.notes ?? null,
      }
    }
    store.addThrowRecord(user, record)
  }

  store.updateCurrentGame(game.value)
  updateSwitchState()

  if (ended) {
    showEnd.value = true
  } else if (eliminatedName) {
    alertMsg.value = `${eliminatedName} が脱落しました`
  }
}

// ----- undo (game-progress order: removes the latest throw) -----
function undo() {
  if (!canUndo.value) {
    alertMsg.value = 'これ以上戻れません'
    return
  }
  const { game: next, statRemoval } = undoLastThrow(game.value)
  game.value = next
  if (statRemoval) store.removeThrowRecordById(statRemoval.userId, statRemoval.recordId)
  showEnd.value = false // undoing typically resumes the game
  store.updateCurrentGame(game.value)
  updateSwitchState()
}

// ----- player switch -----
function selectPlayer(index) {
  game.value = engineSelectPlayer(game.value, index)
  showPlayerSelect.value = false
  store.updateCurrentGame(game.value)
  updateSwitchState()
}

// ----- edit a recorded turn -----
function onCellClick(teamIndex, turnIndex) {
  if (turnIndex >= game.value.teams[teamIndex].turnHistory.length) return
  editTarget.value = { teamIndex, turnIndex }
  showEditModal.value = true
}
function onEditConfirm({ score, details }) {
  const { teamIndex, turnIndex } = editTarget.value
  const { game: next, ended, statUpdate } = engineEditTurn(
    game.value,
    teamIndex,
    turnIndex,
    score,
    details
  )
  game.value = next
  // overwrite the linked stats record (score + details) when present
  if (statUpdate) {
    store.applyRecordUpdate(statUpdate.userId, statUpdate.recordId, statUpdate.score, statUpdate.details)
  }
  // edits modify state in place; they are not undo steps (undo follows game
  // progress and removes the latest throw instead).
  store.updateCurrentGame(game.value)
  showEditModal.value = false
  showEnd.value = ended
  updateSwitchState()
}
function editModalData() {
  const { teamIndex, turnIndex } = editTarget.value
  const team = game.value.teams[teamIndex]
  const turn = team.turnHistory[turnIndex]
  const player = team.players[turn.playerIndex]
  const detailed = !!(turn.throwRecordId && player?.user)
  return {
    teamName: teamLabel(team),
    playerName: turn.playerName,
    turnNumber: turnIndex + 1,
    score: turn.score,
    isMiss: turn.isMiss,
    detailed,
    throwTypes: store.throwTypes,
    details:
      turn.details || {
        throwTypeName: store.throwTypes[0]?.name ?? '横投げ',
        distance: 4,
        isSuccessful: turn.score !== 0,
        notes: null,
      },
  }
}

// ----- recommendations skittle toggle -----
function toggleSkittle({ teamIndex, number }) {
  const set = new Set(game.value.teams[teamIndex].selectedSkittles)
  if (set.has(number)) set.delete(number)
  else set.add(number)
  game.value.teams[teamIndex].selectedSkittles = [...set]
  store.updateCurrentGame(game.value)
}

// ----- end of game -----
// Both ways of continuing go through the order picker first.
function startNextGame() {
  orderMode.value = 'next'
  showEnd.value = false
  showOrder.value = true
}
function startResetGame() {
  orderMode.value = 'reset'
  showEnd.value = false
  showOrder.value = true
}
function confirmOrder(ordered) {
  if (orderMode.value === 'reset') {
    // same teams, every score back to zero, game 1 again
    store.restartWithSameTeams(ordered)
    game.value = deepClone(store.currentGame)
  } else {
    game.value = resetForNextGame(game.value, ordered)
    store.updateCurrentGame(game.value)
  }
  showOrder.value = false
  updateSwitchState()
}
function goHomeFromEnd() {
  store.finishGame()
  router.push({ name: 'home' })
}
function goHome() {
  askHome.value = false
  router.push({ name: 'home' })
}
function openStats() {
  router.push({ name: 'stats', query: { ingame: '1' } })
}
</script>

<template>
  <div v-if="game" class="page game">
    <!-- who throws now / winner: fixed at the top -->
    <div class="game-top">
      <section v-if="game.isFinished && game.winner" class="now won">
        <span class="won-icon"><AppIcon name="trophy" :size="26" /></span>
        <div class="now-main">
          <p class="now-label">第{{ game.gameNumber }}ゲーム終了</p>
          <p class="now-name">{{ teamLabel(game.winner) }} <span class="nowrap">の勝ち</span></p>
        </div>
      </section>
      <section v-else-if="currentPlayer && currentTeam" class="now">
        <div class="now-main">
          <p class="now-name ellipsis">{{ currentPlayer.name }}</p>
          <p v-if="currentTeam.players.length > 1" class="now-team ellipsis">チーム: {{ teamLabel(currentTeam) }}</p>
        </div>
        <div class="now-side">
          <span class="now-game num">第{{ game.gameNumber }}ゲーム</span>
          <button v-if="currentTeam.players.length > 1" class="now-switch" @click="showPlayerSelect = true">
            <AppIcon name="swap" :size="18" />交代
          </button>
        </div>
      </section>
    </div>

    <div ref="bodyEl" class="page-body game-body">
      <!-- cumulative scores -->
      <section
        ref="totalsEl"
        :class="['totals', 'scroll-x', { dense: game.teams.length >= 4, many: game.teams.length >= 5 }]"
        aria-label="チームごとの得点"
      >
        <article
          v-for="(team, ti) in game.teams"
          :key="team.id"
          :class="['total', { cur: isCurrentTeam(ti), out: team.isEliminated }]"
        >
          <h3 class="total-name ellipsis">{{ teamLabel(team) }}</h3>
          <p class="total-score num">{{ team.currentGameScore }}</p>
          <p class="total-cap">このゲーム</p>
          <p v-if="team.gameResults.length" class="total-history num">
            <span v-for="(gr, gi) in team.gameResults" :key="gi">{{ ordinal(gi + 1) }} {{ gr.finalScore }}</span>
          </p>
          <p class="total-now num">
            <span>累計</span><b>{{ team.cumulativeScore }}</b>
          </p>
          <div class="misses">
            <span v-if="team.isEliminated" class="tag solid">脱落</span>
            <template v-else>
              <span class="misses-cap">失投</span>
              <span class="miss-dots" role="img" :aria-label="`失投 ${team.missCount}回（3回連続で脱落）`">
                <i v-for="m in 3" :key="m" :class="{ on: m <= team.missCount }" />
              </span>
            </template>
          </div>
        </article>
      </section>

      <!-- scoreboard -->
      <section class="card board-card" aria-label="得点板">
        <div class="board">
          <div class="board-left">
            <div class="b-head b-turn num">第{{ scoreboard.currentTurn }}ターン</div>
            <div
              v-for="(team, ti) in game.teams"
              :key="team.id"
              :class="['b-team', { cur: isCurrentTeam(ti), out: team.isEliminated }]"
            >
              <span class="b-mark">
                <AppIcon v-if="team.currentGameScore === 50" name="trophy" :size="14" />
                <AppIcon v-else-if="team.isEliminated" name="close" :size="12" />
                <AppIcon v-else-if="isCurrentTeam(ti)" name="play" :size="12" class="filled" />
              </span>
              <span class="b-name">{{ teamLabel(team) }}</span>
            </div>
          </div>

          <div ref="boardMid" :class="['board-mid', 'scroll-x', { scrolled: boardScrolled }]" @scroll.passive="onBoardScroll">
            <div class="mid-inner">
              <div class="b-row b-head">
                <div
                  v-for="turn in scoreboard.displayTurns"
                  :key="turn"
                  :class="['b-cell', 'turn-no', 'num', { cur: turn === scoreboard.currentTurn && !game.isFinished }]"
                >
                  <span>{{ turn }}</span>
                </div>
              </div>
              <div v-for="(team, ti) in game.teams" :key="team.id" :class="['b-row', { cur: isCurrentTeam(ti) }]">
                <template v-for="turn in scoreboard.displayTurns" :key="turn">
                  <button
                    v-if="cellScore(team, turn - 1) !== null"
                    :class="['b-cell', 'filled', 'num', { miss: cellScore(team, turn - 1) === 0 }]"
                    :aria-label="`${teamLabel(team)} 第${turn}ターン ${
                      cellScore(team, turn - 1) === 0 ? '失投' : cellScore(team, turn - 1) + '点'
                    }。タップで修正`"
                    @click="onCellClick(ti, turn - 1)"
                  >
                    {{ cellScore(team, turn - 1) === 0 ? '×' : cellScore(team, turn - 1) }}
                  </button>
                  <div v-else-if="isNextCell(ti, turn - 1)" class="b-cell next"><i /></div>
                  <div v-else class="b-cell blank"><i /></div>
                </template>
              </div>
            </div>
          </div>

          <div class="board-right">
            <div class="b-head b-sum-head">計</div>
            <div v-for="(team, ti) in game.teams" :key="team.id" :class="['b-sum', 'num', { cur: isCurrentTeam(ti) }]">
              <span>{{ team.currentGameScore }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- docked controls: always reachable, the area above scrolls if it must -->
    <div class="dock">
      <!-- score input -->
      <section v-if="!game.isFinished" class="pad" aria-label="得点入力">
        <div class="rack">
          <button
            v-for="k in rackKeys"
            :key="k.n"
            class="pin-key"
            :style="{ gridRow: k.row, gridColumn: k.col }"
            :aria-label="`${k.n}点`"
            @click="pressScore(k.n)"
          >
            {{ k.n }}
          </button>
          <label :class="['switch', { disabled: !currentPlayer?.user }]">
            <input
              v-model="showDetails"
              type="checkbox"
              role="switch"
              :disabled="!currentPlayer?.user"
              @change="onSwitchToggle"
            />
            <span class="track" aria-hidden="true"><span class="thumb" /></span>
            <span class="switch-text">
              <strong>投擲詳細</strong>
              <small>{{ currentPlayer?.user ? '投げ方と距離' : '登録者のみ' }}</small>
            </span>
          </label>
          <button class="miss-btn" @click="pressScore(0)">失投</button>
        </div>
      </section>

      <!-- finished: how to continue -->
      <section v-else class="finish" aria-label="次の操作">
        <button class="btn btn-primary" @click="startNextGame">
          <span class="btn-stack">次のゲームへ<span class="btn-sub">累計を引き継ぐ</span></span>
        </button>
        <button class="btn btn-secondary" @click="startResetGame">
          <span class="btn-stack">同じチームで得点をリセット<span class="btn-sub">累計を0に戻して順番決めから</span></span>
        </button>
        <button class="btn btn-text" @click="goHomeFromEnd">対戦を終えてホームへ</button>
      </section>
    </div>

    <!-- action bar -->
    <nav class="actions" aria-label="対戦メニュー">
      <button :disabled="!canUndo" @click="undo"><AppIcon name="undo" /><span>1投戻す</span></button>
      <button @click="showRecommend = true"><AppIcon name="target" /><span>おすすめ</span></button>
      <button @click="openStats"><AppIcon name="chart" /><span>統計</span></button>
      <button @click="askHome = true"><AppIcon name="home" /><span>ホーム</span></button>
    </nav>

    <!-- modals -->
    <ThrowDetailsModal
      v-if="showDetailsModal"
      :score="pendingScore"
      :throw-types="store.throwTypes"
      @confirm="onDetailsConfirm"
      @skip="onDetailsSkip"
      @close="showDetailsModal = false"
    />
    <RecommendationsModal
      v-if="showRecommend"
      :game="game"
      @toggle-skittle="toggleSkittle"
      @close="showRecommend = false"
    />
    <PlayerSelectionModal
      v-if="showPlayerSelect && currentTeam"
      :team="currentTeam"
      :current-player-index="currentTeam.currentPlayerIndex"
      @select="selectPlayer"
      @close="showPlayerSelect = false"
    />
    <TeamOrderModal
      v-if="showOrder"
      :teams="game.teams"
      title="投げる順番"
      :sub="
        orderMode === 'reset'
          ? '得点をリセットして第1ゲームから始めます'
          : `第${game.gameNumber + 1}ゲームの順番を決めます（累計は引き継ぎ）`
      "
      :confirm-label="orderMode === 'reset' ? 'リセットしてはじめる' : 'この順番ではじめる'"
      @confirm="confirmOrder"
      @close="showOrder = false"
    />
    <EditTurnModal
      v-if="showEditModal"
      v-bind="editModalData()"
      @confirm="onEditConfirm"
      @close="showEditModal = false"
    />

    <!-- game end -->
    <BottomSheet
      v-if="showEnd"
      :title="`第${game.gameNumber}ゲーム終了`"
      :sub="game.winner ? `${teamLabel(game.winner)} の勝ち` : ''"
      close-label="得点板に戻る"
      @close="showEnd = false"
    >
      <table class="standings">
        <thead>
          <tr>
            <th scope="col" class="s-team">チーム</th>
            <th scope="col">このゲーム</th>
            <th scope="col">累計</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in standings" :key="row.id" :class="{ win: row.isWinner }">
            <th scope="row" class="s-team">
              <span class="s-team-in">
                <span class="s-rank num">{{ row.rank }}</span>
                <span class="s-name">{{ row.name }}</span>
                <span v-if="row.isWinner" class="tag solid">勝ち</span>
              </span>
            </th>
            <td class="num">{{ row.gameScore }}</td>
            <td class="num s-total">{{ row.total }}</td>
          </tr>
        </tbody>
      </table>

      <div class="end-actions">
        <button class="btn btn-primary" @click="startNextGame">
          <span class="btn-stack">次のゲームへ<span class="btn-sub">累計を引き継ぐ</span></span>
        </button>
        <button class="btn btn-secondary" @click="startResetGame">
          <span class="btn-stack">同じチームで得点をリセット<span class="btn-sub">累計を0に戻して順番決めから</span></span>
        </button>
        <button class="btn btn-soft" @click="goHomeFromEnd">対戦を終えてホームへ</button>
        <button class="btn btn-text" @click="showEnd = false">得点板に戻る</button>
      </div>
    </BottomSheet>

    <!-- notices -->
    <ConfirmDialog
      v-if="alertMsg"
      :title="alertMsg"
      :message="alertMsg.includes('脱落') ? '失投が3回続きました。' : ''"
      @confirm="alertMsg = ''"
    />
    <ConfirmDialog
      v-if="askHome"
      title="ホームに戻りますか？"
      message="対戦はこのまま保存され、ホームの「対戦を再開」から続けられます。"
      confirm-label="ホームに戻る"
      cancel-label="続ける"
      @confirm="goHome"
      @cancel="askHome = false"
    />
  </div>
</template>

<style scoped>
.game-top {
  flex: none;
  padding: calc(10px + env(safe-area-inset-top)) 14px 0;
}
.game-body {
  gap: 10px;
  padding: 10px 14px 12px;
}
.nowrap {
  white-space: nowrap;
}

/* ----- who throws now ----- */
.now {
  flex: none;
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: 12px 14px 12px 16px;
  border-radius: 20px;
  background: var(--navy);
  color: var(--white);
}
.now-main {
  flex: 1;
  min-width: 0;
}
.now-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--sky);
}
.now-name {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.3;
  line-break: strict;
}
.now-team {
  font-size: 0.8125rem;
  color: var(--sky-200);
}
.now-side {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  gap: 6px;
}
.now-game {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--sky);
  white-space: nowrap;
}
.now-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--navy);
  background: var(--sky);
  transition: transform 0.08s ease;
}
.now-switch:active {
  transform: scale(0.95);
}
.now.won {
  align-items: center;
}
.won-icon {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sky);
  color: var(--navy);
}

/* ----- cumulative cards ----- */
.totals {
  flex: none;
  display: flex;
  gap: 8px;
}
.total {
  flex: 1 0 76px;
  min-width: 0;
  padding: 10px 6px 10px;
  border-radius: var(--radius-m);
  background: var(--white);
  box-shadow: inset 0 0 0 1px var(--line);
  text-align: center;
}
.total.cur {
  box-shadow: inset 0 0 0 2px var(--navy);
}
.total.out {
  background: var(--fill);
}
.total-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-2);
}
.total.cur .total-name {
  color: var(--navy);
  font-weight: 700;
}
.total-score {
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.05;
  margin-top: 2px;
}
.total.out .total-score {
  color: var(--ink-3);
}
.total-cap {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--ink-2);
}
.total-history {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 8px;
  margin-top: 2px;
  font-size: 0.6875rem;
  color: var(--ink-2);
}
.total-now {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 6px;
  padding: 1px 10px 2px;
  border-radius: 999px;
  background: var(--sky-100);
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.4;
}
.total-now span {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}
.total-now b {
  font-weight: 700;
}
.misses-cap {
  white-space: nowrap;
}
/* four or more teams: cards are narrow, so the caption sits under its number
   and the miss dots stand alone */
.totals.dense .total {
  padding-left: 4px;
  padding-right: 4px;
}
.totals.dense .total-score {
  font-size: 1.875rem;
}
.totals.dense .total-now {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 0;
  padding: 0;
  background: none;
}
.totals.dense .total-now b {
  min-width: 44px;
  padding: 0 10px 1px;
  border-radius: 999px;
  background: var(--sky-100);
}
.totals.dense .misses-cap {
  display: none;
}
/* five or more teams: the strip scrolls sideways, so size the cards to leave
   part of the next one showing — a hint that there is more to the right */
.totals.many .total {
  flex: 0 0 calc((100% - 24px) / 3.6);
}
.misses {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 20px;
  margin-top: 6px;
}
.misses-cap {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--ink-2);
}
.miss-dots {
  display: inline-flex;
  gap: 4px;
}
.miss-dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
}
.miss-dots i.on {
  background: var(--navy);
  box-shadow: none;
}

/* ----- scoreboard ----- */
.board-card {
  flex: none;
  padding: 8px 8px 6px;
}
.board {
  display: flex;
}
.b-head {
  height: 30px;
  display: flex;
  align-items: center;
}
.board-left {
  flex: none;
  width: 96px;
}
.b-turn {
  padding-left: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}
.b-team {
  height: 40px;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px 0 2px;
  border-radius: 10px 0 0 10px;
}
.b-team.cur {
  background: var(--sky-100);
}
.b-mark {
  flex: none;
  width: 16px;
  display: flex;
  justify-content: center;
}
.b-mark :deep(.filled) {
  fill: currentColor;
}
/* up to two lines, so a pair's names ("A & B") stay readable in the column */
.b-name {
  min-width: 0;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  overflow-wrap: anywhere;
  line-break: strict;
}
.b-team.cur .b-name {
  font-weight: 700;
}
.b-team.out .b-name {
  color: var(--ink-3);
  text-decoration: line-through;
}

.board-mid {
  flex: 1;
  min-width: 0;
}
/* earlier turns fade out at the left edge instead of being cut mid-digit */
.board-mid.scrolled {
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 18px);
  mask-image: linear-gradient(to right, transparent 0, #000 18px);
}
.mid-inner {
  display: inline-block;
  vertical-align: top;
}
.b-row {
  display: flex;
  gap: 2px;
  height: 40px;
  align-items: center;
}
.b-row.b-head {
  height: 30px;
}
.b-row.cur {
  background: var(--sky-100);
}
.b-cell {
  flex: none;
  width: 34px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 8px;
}
.b-cell.turn-no {
  height: 30px;
  font-size: 0.75rem;
  color: var(--ink-2);
}
.b-cell.turn-no.cur span {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--navy);
  color: var(--white);
  font-weight: 700;
}
.b-cell.filled:active {
  background: var(--sky-200);
}
.b-cell.miss {
  color: var(--ink-2);
  font-weight: 500;
  font-size: 1.0625rem;
}
.b-cell.blank i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--line);
}
.b-cell.next {
  background: var(--white);
  box-shadow: inset 0 0 0 2px var(--navy);
  height: 30px;
  width: 30px;
  margin: 0 2px;
}
.b-cell.next i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--navy);
  animation: next-pulse 1.4s ease-in-out infinite;
}
@keyframes next-pulse {
  50% {
    transform: scale(0.55);
    opacity: 0.5;
  }
}

.board-right {
  flex: none;
  width: 46px;
}
.b-sum-head {
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}
.b-sum {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 4px;
  border-radius: 0 10px 10px 0;
}
.b-sum.cur {
  background: var(--sky-100);
}
.b-sum span {
  width: 38px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--fill);
  font-size: 1rem;
  font-weight: 700;
}
.b-sum.cur span {
  background: var(--navy);
  color: var(--white);
}

/* ----- docked controls ----- */
.dock {
  flex: none;
  position: relative;
  z-index: 1;
  padding: 14px 14px 10px;
  background: var(--white);
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -1px 0 var(--line), 0 -8px 24px rgba(29, 53, 87, 0.07);
}

/* ----- score pad ----- */
/* The rack: 8 half-key columns between two flexible margins. Rows are packed
   like circles (0.866 × pitch), so keys of neighbouring rows nest. The detail
   switch and the miss button use the free corners beside the front row. */
.rack {
  --key: clamp(42px, min(14.5vw, 8.6dvh), 60px);
  --gap: 8px;
  display: grid;
  grid-template-columns: 1fr repeat(8, calc((var(--key) + var(--gap)) / 2)) 1fr;
  grid-auto-rows: calc((var(--key) + var(--gap)) * 0.866);
  padding-bottom: calc(var(--key) - (var(--key) + var(--gap)) * 0.866);
  align-items: start;
}
.rack .pin-key {
  justify-self: center;
  width: var(--key);
  height: var(--key);
  aspect-ratio: auto;
  border-radius: 50%;
}
.rack .switch {
  grid-row: 4;
  grid-column: 1 / 4;
  justify-self: start;
  align-self: start;
  height: var(--key);
  min-height: 0;
}
.rack .switch {
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 4px;
}
.rack .switch-text small {
  display: none;
}
.rack .miss-btn {
  grid-row: 4;
  grid-column: 8 / 12;
  justify-self: end;
  align-self: start;
  height: var(--key);
}
.miss-btn {
  flex: none;
  width: min(100%, 104px);
  min-height: 44px;
  border-radius: 999px;
  font-size: 1rem;
  font-weight: 700;
  background: var(--white);
  box-shadow: inset 0 0 0 2px var(--navy);
  transition: transform 0.08s ease, background-color 0.1s ease, color 0.1s ease;
}
.miss-btn:active {
  transform: scale(0.95);
  background: var(--navy);
  color: var(--white);
}

/* switch */
.switch {
  position: relative; /* contains the visually hidden checkbox */
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  cursor: pointer;
  min-width: 0;
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.track {
  flex: none;
  width: 48px;
  height: 28px;
  border-radius: 999px;
  background: var(--line-strong);
  padding: 3px;
  transition: background-color 0.15s ease;
}
.thumb {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--white);
  box-shadow: 0 1px 3px rgba(29, 53, 87, 0.3);
  transition: transform 0.18s var(--ease-out);
}
.switch input:checked + .track {
  background: var(--navy);
}
.switch input:checked + .track .thumb {
  transform: translateX(20px);
}
.switch input:focus-visible + .track {
  outline: 3px solid var(--sky);
  outline-offset: 2px;
}
.switch-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.3;
}
.switch-text strong {
  font-size: 0.875rem;
}
.switch-text small {
  font-size: 0.6875rem;
  color: var(--ink-2);
}
.switch.disabled {
  cursor: default;
}
.switch.disabled .track {
  opacity: 0.45;
}
.switch.disabled strong {
  color: var(--ink-2);
}

/* ----- finished ----- */
.finish {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ----- action bar ----- */
.actions {
  flex: none;
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--white);
  border-top: 1px solid var(--line);
  padding: 4px 6px calc(6px + env(safe-area-inset-bottom));
}
.actions button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  min-height: 52px;
  border-radius: 12px;
  font-size: 0.6875rem;
  font-weight: 700;
  transition: background-color 0.12s ease, transform 0.08s ease;
}
.actions button:active:not(:disabled) {
  background: var(--sky-100);
  transform: scale(0.96);
}
.actions button:disabled {
  color: var(--ink-3);
}

/* ----- short screens: tighten the scrolling area so the board stays in view ----- */
@media (max-height: 720px) {
  .game-top {
    padding-top: calc(8px + env(safe-area-inset-top));
  }
  .game-body {
    gap: 8px;
    padding-top: 8px;
  }
  .now {
    padding: 9px 12px 9px 14px;
  }
  .now-name {
    font-size: 1.3125rem;
  }
  .now-switch {
    min-height: 36px;
  }
  .total {
    padding-top: 7px;
    padding-bottom: 7px;
  }
  .total-score,
  .totals.dense .total-score {
    font-size: 1.75rem;
  }
  .total-now {
    margin-top: 3px;
  }
  .misses {
    margin-top: 3px;
  }
  .b-team,
  .b-row:not(.b-head),
  .b-sum {
    height: 36px;
  }
  .dock {
    padding-top: 10px;
  }
}
/* small phones in a browser (about 550–620px of height): slightly flatter
   keys and menu, and no tip line, so two teams fit without scrolling */
@media (max-height: 620px) {
  .board-card {
    padding-bottom: 8px;
  }
  .dock {
    padding-bottom: 8px;
  }
  .actions {
    padding-top: 2px;
  }
  .actions button {
    min-height: 46px;
  }
}
/* very narrow phones: give the turn columns more of the row */
@media (max-width: 350px) {
  .board-left {
    width: 80px;
  }
  .board-right {
    width: 42px;
  }
  .b-sum span {
    width: 34px;
  }
}
/* very short (e.g. a phone held sideways): let the whole screen scroll */
@media (max-height: 480px) {
  .game {
    overflow-y: auto;
  }
  .game-body {
    flex: none;
    overflow: visible;
  }
}

/* ----- end-of-game sheet ----- */
.standings {
  width: 100%;
  border-collapse: collapse;
}
.standings th,
.standings td {
  padding: 10px 6px;
  text-align: right;
  font-weight: 600;
  border-bottom: 1px solid var(--line);
}
.standings thead th {
  padding: 0 6px 6px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}
.standings .s-team {
  text-align: left;
  width: 100%;
}
.s-team-in {
  display: flex;
  align-items: center;
  gap: 8px;
}
.standings tbody td {
  font-size: 1rem;
}
.s-rank {
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--fill);
  font-size: 0.8125rem;
  font-weight: 700;
}
.standings tr.win .s-rank {
  background: var(--navy);
  color: var(--white);
}
.s-name {
  min-width: 0;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
  line-break: strict;
}
.standings .s-total {
  font-size: 1.25rem;
  font-weight: 700;
  padding-left: 16px;
}
.end-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
