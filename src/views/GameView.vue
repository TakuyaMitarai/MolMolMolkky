<script setup>
import { ref, computed, onMounted } from 'vue'
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
import ThrowDetailsModal from '../components/ThrowDetailsModal.vue'
import RecommendationsModal from '../components/RecommendationsModal.vue'
import PlayerSelectionModal from '../components/PlayerSelectionModal.vue'
import TeamOrderModal from '../components/TeamOrderModal.vue'
import EditTurnModal from '../components/EditTurnModal.vue'

const router = useRouter()
const store = useDataStore()

const game = ref(null)
const showDetails = ref(true)
const lastRegisteredSwitch = ref(true)

const pendingScore = ref(0)
const showDetailsModal = ref(false)
const showRecommend = ref(false)
const showPlayerSelect = ref(false)
const showOrder = ref(false)
const showEnd = ref(false)
const alertMsg = ref('')

const showEditModal = ref(false)
const editTarget = ref(null) // { teamIndex, turnIndex }

onMounted(() => {
  if (!store.currentGame) {
    router.replace({ name: 'setup' })
    return
  }
  game.value = deepClone(store.currentGame)
  if (game.value.isFinished) showEnd.value = true
  updateSwitchState()
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

// ----- helpers -----
function teamLabel(team) {
  const names = (team.players || []).map((p) => p.user?.name).filter(Boolean)
  return names.length ? names.join(' & ') : team.name
}
function ordinal(n) {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`
}
function cellScore(team, turnIndex) {
  return turnIndex < team.turnHistory.length ? team.turnHistory[turnIndex].score : null
}
function isCurrentTeam(i) {
  return game.value.currentTeamIndex === i && !game.value.teams[i].isEliminated
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
    alertMsg.value = `${eliminatedName}が脱落しました`
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
const cumulativeText = computed(() =>
  game.value ? game.value.teams.map((t) => `${teamLabel(t)}: ${t.cumulativeScore}`).join('\n') : ''
)
function startNextGame() {
  showEnd.value = false
  showOrder.value = true
}
function confirmOrder(ordered) {
  game.value = resetForNextGame(game.value, ordered)
  store.updateCurrentGame(game.value)
  showOrder.value = false
  updateSwitchState()
}
function goHomeFromEnd() {
  store.finishGame()
  router.push({ name: 'home' })
}
function goHome() {
  if (confirm('ホームに戻りますか？')) router.push({ name: 'home' })
}
function openStats() {
  router.push({ name: 'stats', query: { ingame: '1' } })
}
</script>

<template>
  <div v-if="game" class="page game">
    <div class="page-scroll">
      <!-- current player / winner banner -->
      <div class="pad top">
        <div v-if="game.isFinished && game.winner" class="winner">
          🏆 {{ teamLabel(game.winner) }} 勝利！ 🏆
        </div>
        <div v-else-if="currentPlayer && currentTeam" class="card cur">
          <div class="cur-row">
            <span class="pname">{{ currentPlayer.name }}</span>
            <span class="muted">第{{ game.gameNumber }}ゲーム</span>
          </div>
          <div class="cur-row">
            <span class="muted">チーム: {{ teamLabel(currentTeam) }}</span>
            <button v-if="currentTeam.players.length > 1" class="switch-btn" @click="showPlayerSelect = true">
              👥 切り替え
            </button>
          </div>
        </div>
      </div>

      <!-- cumulative scores -->
      <div class="pad cumulative">
        <div
          v-for="team in game.teams"
          :key="team.id"
          :class="['cum-card', { elim: team.isEliminated }]"
        >
          <div class="cum-name">{{ teamLabel(team) }}</div>
          <div :class="['cum-score', { elim: team.isEliminated }]">{{ team.cumulativeScore }}</div>
          <div class="cum-history">
            <div v-for="(gr, gi) in team.gameResults" :key="gi" class="muted small">
              {{ ordinal(gi + 1) }}: {{ gr.finalScore }}
            </div>
            <div v-if="!game.isFinished" class="cur-score">{{ team.currentGameScore }}</div>
          </div>
          <div class="miss-row">
            <span v-for="m in 3" :key="m" :class="['miss-dot', { on: m <= team.missCount }]" />
          </div>
        </div>
      </div>

      <!-- scoreboard -->
      <div class="pad">
        <div class="board">
          <div class="board-left">
            <div class="board-head">
              <div class="muted small">Team</div>
              <div class="turn-label">第{{ scoreboard.currentTurn }}ターン</div>
            </div>
            <div v-for="(team, ti) in game.teams" :key="team.id" :class="['team-name-cell', { cur: isCurrentTeam(ti) }]">
              <span class="tn">{{ teamLabel(team) }}</span>
              <span class="status">
                <template v-if="team.currentGameScore === 50">🏆</template>
                <template v-else-if="team.isEliminated">❌</template>
                <template v-else-if="isCurrentTeam(ti)">▶</template>
              </span>
            </div>
          </div>

          <div class="board-mid scroll-x">
            <div class="mid-inner">
              <div class="head-row">
                <div
                  v-for="turn in scoreboard.displayTurns"
                  :key="turn"
                  :class="['turn-num', { cur: turn === scoreboard.currentTurn }]"
                >
                  {{ turn }}
                </div>
              </div>
              <div v-for="(team, ti) in game.teams" :key="team.id" class="hist-row">
                <div
                  v-for="turn in scoreboard.displayTurns"
                  :key="turn"
                  :class="['cell', { editable: cellScore(team, turn - 1) !== null }]"
                  @click="onCellClick(ti, turn - 1)"
                >
                  <template v-if="cellScore(team, turn - 1) !== null">
                    <span :class="{ miss: cellScore(team, turn - 1) === 0 }">{{ cellScore(team, turn - 1) }}</span>
                  </template>
                  <template v-else-if="isCurrentTeam(ti) && turn - 1 === team.turnHistory.length">
                    <span class="dot">●</span>
                  </template>
                  <template v-else><span class="muted">-</span></template>
                </div>
              </div>
            </div>
          </div>

          <div class="board-right">
            <div class="board-head total-head">計</div>
            <div v-for="team in game.teams" :key="team.id" class="total-cell">
              {{ team.currentGameScore }}
            </div>
          </div>
        </div>
      </div>

      <!-- score input -->
      <div class="pad">
        <div v-if="game.isFinished" class="col">
          <button class="btn btn-primary" @click="startNextGame">対戦開始</button>
        </div>
        <div v-else class="card input-card">
          <div class="pad-grid">
            <button v-for="n in 12" :key="n" class="score-btn" @click="pressScore(n)">{{ n }}</button>
          </div>
          <div class="input-foot">
            <label class="detail-toggle" :class="{ disabled: !currentPlayer?.user }">
              <span class="muted small">投擲詳細</span>
              <input type="checkbox" v-model="showDetails" :disabled="!currentPlayer?.user" @change="onSwitchToggle" />
            </label>
            <button class="btn-miss" @click="pressScore(0)">失投</button>
          </div>
        </div>
      </div>
    </div>

    <!-- action bar -->
    <div class="pad action-bar">
      <button class="btn btn-ghost" :disabled="!canUndo" @click="undo">↩ 戻る</button>
      <button class="btn btn-ghost" @click="showRecommend = true">💡 推薦</button>
      <button class="btn btn-ghost" @click="openStats">📊 統計</button>
      <button class="btn btn-ghost" @click="goHome">🏠 ホーム</button>
    </div>

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
    <div v-if="showEnd" class="overlay" @click.self="showEnd = false">
      <div class="end-box">
        <h2>ゲーム終了</h2>
        <pre class="cum-text">{{ cumulativeText }}</pre>
        <button class="btn btn-primary" @click="startNextGame">次のゲーム</button>
        <button class="btn btn-ghost" @click="goHomeFromEnd">ホームに戻る</button>
        <button class="btn btn-secondary" @click="showEnd = false">キャンセル</button>
      </div>
    </div>

    <!-- transient alert -->
    <div v-if="alertMsg" class="overlay" @click.self="alertMsg = ''">
      <div class="end-box">
        <p>{{ alertMsg }}</p>
        <button class="btn btn-primary" @click="alertMsg = ''">OK</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game {
  background: linear-gradient(135deg, rgb(13, 26, 51), rgb(38, 51, 77));
}
.top {
  padding-top: 1rem;
}
.winner {
  background: rgba(255, 210, 63, 0.15);
  border-radius: 12px;
  padding: 1rem;
  text-align: center;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--c-yellow);
}
.cur .cur-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0.2rem 0;
}
.pname {
  font-size: 1.3rem;
  font-weight: 700;
}
.switch-btn {
  background: var(--navy);
  border: 2px solid #fff;
  color: #fff;
  border-radius: 6px;
  padding: 0.25rem 0.6rem;
  font-size: 0.8rem;
}

/* cumulative */
.cumulative {
  display: flex;
  gap: 0.6rem;
}
.cum-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #fff;
  border-radius: 8px;
  padding: 0.75rem 0.4rem;
  text-align: center;
}
.cum-card.elim {
  background: rgba(226, 59, 59, 0.2);
}
.cum-name {
  font-size: 0.75rem;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cum-score {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--c-yellow);
}
.cum-score.elim {
  color: var(--c-red);
}
.cum-history .small {
  font-size: 0.7rem;
}
.cur-score {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--c-cyan);
}
.miss-row {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.3rem;
}
.miss-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--c-red);
}
.miss-dot.on {
  background: var(--c-red);
}

/* scoreboard */
.board {
  display: flex;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 0.5rem;
}
.board-head {
  height: 36px;
}
.small {
  font-size: 0.7rem;
}
.turn-label {
  font-size: 0.65rem;
  color: var(--c-yellow);
  font-weight: 700;
}
.board-left {
  width: 84px;
  flex: none;
}
.team-name-cell {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.2rem;
  padding-right: 0.2rem;
}
.team-name-cell.cur {
  background: rgba(47, 111, 224, 0.15);
  border-radius: 6px;
}
.tn {
  font-size: 0.7rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.status {
  font-size: 0.7rem;
  color: var(--c-yellow);
}
.board-mid {
  flex: 1;
}
.mid-inner {
  display: inline-block;
}
.head-row,
.hist-row {
  display: flex;
  gap: 0.4rem;
  height: 36px;
}
.turn-num,
.cell {
  width: 30px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
}
.turn-num.cur {
  color: var(--c-yellow);
  font-weight: 700;
  background: rgba(255, 210, 63, 0.2);
  border-radius: 4px;
}
.cell.editable {
  cursor: pointer;
  border-radius: 4px;
}
.cell.editable:active {
  background: rgba(255, 255, 255, 0.15);
}
.cell .miss {
  color: var(--c-red);
}
.cell .dot {
  color: var(--c-yellow);
}
.board-right {
  width: 40px;
  flex: none;
}
.total-head {
  text-align: center;
  font-weight: 700;
}
.total-cell {
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  background: rgba(47, 111, 224, 0.3);
  border-radius: 4px;
  margin-bottom: 0;
}

/* input */
.input-card {
  background: rgba(255, 255, 255, 0.05);
}
.pad-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.5rem;
}
.score-btn {
  min-height: 44px;
  border-radius: 8px;
  border: 2px solid #fff;
  background: linear-gradient(135deg, var(--navy), rgba(26, 51, 102, 0.6));
  color: #fff;
  font-size: 1.1rem;
  font-weight: 700;
  transition: transform 0.08s ease;
}
.score-btn:active {
  transform: scale(0.95);
}
.input-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
}
.detail-toggle {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.detail-toggle.disabled {
  opacity: 0.5;
}
.detail-toggle input {
  width: 44px;
  height: 24px;
}
.btn-miss {
  width: 120px;
  height: 44px;
  border-radius: 12px;
  border: 2px solid #fff;
  background: rgba(26, 51, 102, 0.6);
  color: #fff;
  font-weight: 700;
}

/* action bar */
.action-bar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  padding-bottom: 1.25rem;
}
.action-bar .btn {
  font-size: 0.85rem;
  min-height: 44px;
  padding: 0.3rem;
}
.action-bar .btn:disabled {
  opacity: 0.5;
}

/* end box */
.end-box {
  margin: auto;
  background: var(--navy);
  border: 2px solid #fff;
  border-radius: 14px;
  padding: 1.5rem;
  width: 85%;
  max-width: 340px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.cum-text {
  font-family: inherit;
  white-space: pre-wrap;
  margin: 0.5rem 0;
}
</style>
