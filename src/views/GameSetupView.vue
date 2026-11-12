<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import { createTeam, createPlayer } from '../lib/models.js'
import AppIcon from '../components/AppIcon.vue'
import PageHeader from '../components/PageHeader.vue'
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
  message.value = ''
  if (teams.value.length < 2) {
    message.value = '最低2チームが必要です'
    return
  }
  for (const [ti, t] of teams.value.entries()) {
    if (t.players.length === 0) {
      message.value = '各チームに最低1人のプレイヤーが必要です'
      return
    }
    // "登録" was chosen but nobody picked: say so instead of silently
    // falling back to a guest (whose throws would not reach the stats).
    if (t.players.some((p) => p.mode === 'registered' && !p.userId)) {
      message.value = `チーム${ti + 1}: 登録プレイヤーを選ぶか「ゲスト」に切り替えてください`
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
    <PageHeader
      title="対戦の準備"
      sub="チームとプレイヤーを決めます"
      backLabel="ホームに戻る"
      @back="router.push({ name: 'home' })"
    />

    <div class="page-body">
      <section v-for="(team, ti) in teams" :key="ti" class="card team-card">
        <div class="team-head">
          <h2>チーム {{ ti + 1 }}</h2>
          <button v-if="teams.length > 2" class="remove-team" @click="removeTeam(ti)">
            <AppIcon name="trash" :size="18" />チームを削除
          </button>
        </div>

        <div v-for="(p, pi) in team.players" :key="pi" class="player">
          <div class="seg" role="radiogroup" :aria-label="`チーム${ti + 1} プレイヤー${pi + 1}の種別`">
            <button
              type="button"
              role="radio"
              :aria-checked="p.mode === 'registered'"
              :class="['seg-btn', { on: p.mode === 'registered' }]"
              @click="p.mode = 'registered'"
            >
              登録
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="p.mode === 'guest'"
              :class="['seg-btn', { on: p.mode === 'guest' }]"
              @click="p.mode = 'guest'"
            >
              ゲスト
            </button>
          </div>

          <template v-if="p.mode === 'registered'">
            <select
              v-if="store.users.length"
              v-model="p.userId"
              class="field"
              :aria-label="`チーム${ti + 1} プレイヤー${pi + 1}`"
            >
              <option :value="null" disabled>プレイヤーを選ぶ</option>
              <option v-for="u in store.users" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
            <p v-else class="no-users">登録プレイヤーがいません。ホームの「プレイヤー登録」で追加できます。</p>
          </template>
          <input
            v-else
            v-model="p.name"
            class="field"
            type="text"
            placeholder="プレイヤー名"
            autocomplete="off"
            :aria-label="`チーム${ti + 1} プレイヤー${pi + 1}の名前`"
          />

          <button
            v-if="team.players.length > 1"
            class="icon-btn"
            :aria-label="`プレイヤー${pi + 1}を外す`"
            @click="removePlayer(team, pi)"
          >
            <AppIcon name="close" :size="20" />
          </button>
        </div>

        <button class="add-link" @click="addPlayer(team)">
          <AppIcon name="plus" :size="18" />プレイヤーを追加
        </button>
      </section>

      <button class="add-team" @click="addTeam"><AppIcon name="plus" :size="20" />チームを追加</button>
    </div>

    <div class="page-foot">
      <p v-if="message" class="notice" role="alert">{{ message }}</p>
      <button class="btn btn-primary" @click="startGame">投げる順番を決める</button>
    </div>

    <TeamOrderModal
      v-if="showOrder"
      :teams="orderTeams"
      title="投げる順番"
      sub="第1ゲームの順番を決めます"
      confirm-label="この順番ではじめる"
      @confirm="confirmOrder"
      @close="showOrder = false"
    />
  </div>
</template>

<style scoped>
.page-body {
  gap: 12px;
}
.team-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}
.team-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 32px;
}
.team-head h2 {
  font-size: 1rem;
  font-weight: 700;
}
.remove-team {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 0 4px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ink-2);
}
.player {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.player .seg {
  flex: none;
}
.player .seg-btn {
  min-height: 42px;
  padding: 4px 12px;
  font-size: 0.875rem;
}
.player .field {
  flex: 1 1 9rem;
  min-width: 0;
}
.no-users {
  flex: 1 1 9rem;
  font-size: 0.8125rem;
  color: var(--ink-2);
}
.add-link {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  font-size: 0.875rem;
  font-weight: 700;
}
.add-team {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 52px;
  border-radius: var(--radius-m);
  border: 1.5px dashed var(--line-strong);
  font-weight: 700;
  transition: background-color 0.15s ease;
}
.add-team:active {
  background: var(--sky-100);
}
</style>
