<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import { createTeam, createPlayer } from '../lib/models.js'
import TeamOrderModal from '../components/TeamOrderModal.vue'

const router = useRouter()
const store = useDataStore()

const teams = ref([
  { name: 'チーム1', players: [{ mode: 'guest', name: 'プレイヤー1', userId: null }] },
  { name: 'チーム2', players: [{ mode: 'guest', name: 'プレイヤー2', userId: null }] },
])
const message = ref('')
const showOrder = ref(false)
const orderTeams = ref([])

function addTeam() {
  const n = teams.value.length + 1
  teams.value.push({ name: `チーム${n}`, players: [{ mode: 'guest', name: `プレイヤー${n}`, userId: null }] })
}
function removeTeam(i) {
  if (teams.value.length > 2) teams.value.splice(i, 1)
}
function addPlayer(team) {
  team.players.push({ mode: 'guest', name: `プレイヤー${team.players.length + 1}`, userId: null })
}
function removePlayer(team, i) {
  if (team.players.length > 1) team.players.splice(i, 1)
}

function buildTeams() {
  return teams.value.map((t) => {
    const players = t.players.map((p) => {
      if (p.mode === 'registered' && p.userId) {
        const u = store.users.find((x) => x.id === p.userId)
        if (u) return createPlayer(u.name, { isRegistered: true, user: u })
      }
      return createPlayer((p.name || 'プレイヤー').trim(), { isRegistered: false, user: null })
    })
    const teamName = players.map((p) => p.name).join(' & ')
    return createTeam(teamName, players)
  })
}

function startGame() {
  if (teams.value.length < 2) {
    message.value = '最低2チームが必要です'
    return
  }
  for (const t of teams.value) {
    if (t.players.length === 0) {
      message.value = '各チームに最低1人のプレイヤーが必要です'
      return
    }
  }
  const gameTeams = buildTeams()
  store.startNewGame(gameTeams)
  orderTeams.value = gameTeams
  showOrder.value = true
}

function confirmOrder(ordered) {
  const game = { ...store.currentGame, teams: ordered, currentTeamIndex: 0 }
  store.updateCurrentGame(game)
  showOrder.value = false
  router.push({ name: 'game' })
}
</script>

<template>
  <div class="page">
    <div class="navbar">
      <span class="spacer" />
      <button class="btn-inline" @click="router.push({ name: 'home' })">キャンセル</button>
    </div>
    <h1 class="page-title">対戦</h1>

    <div class="page-scroll pad">
      <div v-for="(team, ti) in teams" :key="ti" class="card team-card">
        <div class="team-head">
          <span class="team-no">チーム {{ ti + 1 }}</span>
          <button v-if="ti >= 2" class="btn-danger" @click="removeTeam(ti)">削除</button>
        </div>

        <div v-for="(p, pi) in team.players" :key="pi" class="player-row">
          <div class="seg">
            <button :class="['seg-btn', { on: p.mode === 'registered' }]" @click="p.mode = 'registered'">
              登録
            </button>
            <button :class="['seg-btn', { on: p.mode === 'guest' }]" @click="p.mode = 'guest'">
              ゲスト
            </button>
          </div>
          <select v-if="p.mode === 'registered'" v-model="p.userId" class="text-field">
            <option :value="null" disabled>登録ユーザーを選択</option>
            <option v-for="u in store.users" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
          <input v-else v-model="p.name" class="text-field" type="text" placeholder="プレイヤー名" />
          <button v-if="team.players.length > 1" class="trash" @click="removePlayer(team, pi)">✕</button>
        </div>

        <button class="add-link" @click="addPlayer(team)">＋ プレイヤー追加</button>
      </div>

      <button class="btn btn-secondary" @click="addTeam">＋ チーム追加</button>
    </div>

    <div class="pad footer">
      <p v-if="message" class="center muted">{{ message }}</p>
      <button class="btn btn-primary" @click="startGame">対戦開始</button>
    </div>

    <TeamOrderModal
      v-if="showOrder"
      :teams="orderTeams"
      @confirm="confirmOrder"
      @close="showOrder = false"
    />
  </div>
</template>

<style scoped>
.team-card {
  margin-bottom: 1rem;
}
.team-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.team-no {
  font-weight: 700;
}
.player-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}
.seg {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
}
.seg-btn {
  padding: 0.4rem 0.6rem;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
.seg-btn.on {
  background: #fff;
  color: var(--navy);
  font-weight: 700;
}
.player-row .text-field {
  flex: 1;
  min-width: 8rem;
}
.trash {
  color: var(--c-red);
  font-size: 1rem;
  padding: 0.3rem 0.5rem;
}
.add-link {
  color: #cfe0ff;
  font-size: 0.9rem;
  padding: 0.3rem 0;
}
.footer {
  padding-bottom: 1.5rem;
}
</style>
