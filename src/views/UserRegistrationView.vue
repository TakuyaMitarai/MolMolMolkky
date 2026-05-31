<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'

const router = useRouter()
const store = useDataStore()
const newName = ref('')
const message = ref('')

function addUser() {
  const name = newName.value.trim()
  if (!name) return
  if (store.users.some((u) => u.name === name)) {
    message.value = 'このプレイヤー名は既に登録されています'
    return
  }
  store.addUser(name)
  message.value = `プレイヤー「${name}」を登録しました`
  newName.value = ''
}

function confirmDelete(user) {
  if (confirm(`プレイヤー「${user.name}」を削除しますか？\n全ての記録が削除されます。`)) {
    store.deleteUser(user)
  }
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('ja-JP')
}
</script>

<template>
  <div class="page">
    <div class="navbar">
      <span class="spacer" />
      <button class="btn-inline" @click="router.push({ name: 'home' })">完了</button>
    </div>
    <h1 class="page-title">ユーザー登録</h1>

    <div class="pad col">
      <input
        v-model="newName"
        class="text-field"
        type="text"
        placeholder="プレイヤー名を入力"
        @keyup.enter="addUser"
      />
      <button class="btn btn-primary" :disabled="!newName.trim()" @click="addUser">
        ユーザー登録
      </button>
      <p v-if="message" class="center muted">{{ message }}</p>
    </div>

    <h2 class="section-title">登録済みプレイヤー</h2>
    <div class="page-scroll pad">
      <div v-if="!store.users.length" class="center muted">まだ登録がありません</div>
      <div v-for="user in store.users" :key="user.id" class="card-white user-row">
        <div class="info">
          <div class="name">{{ user.name }}</div>
          <div class="sub">登録日: {{ fmtDate(user.registrationDate) }}</div>
          <div class="sub">投擲記録: {{ user.throwRecords.length }}件</div>
        </div>
        <button class="trash" @click="confirmDelete(user)">🗑️</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.user-row {
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  margin-bottom: 0.75rem;
}
.user-row .info {
  flex: 1;
}
.user-row .name {
  font-weight: 700;
  font-size: 1.05rem;
}
.user-row .sub {
  font-size: 0.8rem;
  opacity: 0.7;
}
.trash {
  font-size: 1.2rem;
  padding: 0.5rem;
}
</style>
