<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'
import AppIcon from '../components/AppIcon.vue'
import PageHeader from '../components/PageHeader.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'

const router = useRouter()
const store = useDataStore()
const newName = ref('')
const message = ref('')
const deleteTarget = ref(null)

function addUser() {
  const name = newName.value.trim()
  if (!name) return
  if (store.users.some((u) => u.name === name)) {
    message.value = `「${name}」はすでに登録されています。別の名前にしてください`
    return
  }
  store.addUser(name)
  message.value = `「${name}」を登録しました`
  newName.value = ''
}

function deleteUser() {
  if (deleteTarget.value) store.deleteUser(deleteTarget.value)
  deleteTarget.value = null
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('ja-JP')
}
</script>

<template>
  <div class="page">
    <PageHeader title="プレイヤー登録" backLabel="ホームに戻る" @back="router.push({ name: 'home' })" />

    <div class="page-body">
      <section class="group">
        <label class="label" for="new-user">名前</label>
        <form class="add-row" @submit.prevent="addUser">
          <input
            id="new-user"
            v-model="newName"
            class="field"
            type="text"
            placeholder="例: たくや"
            autocomplete="off"
            enterkeyhint="done"
          />
          <button class="btn btn-primary add-btn" type="submit" :disabled="!newName.trim()">登録</button>
        </form>
        <p class="hint">登録した人は、対戦中の投げ方と距離が統計に残ります。</p>
        <p v-if="message" class="notice" role="status">{{ message }}</p>
      </section>

      <section class="group">
        <h2 class="label">登録済み {{ store.users.length }}人</h2>
        <div v-if="!store.users.length" class="empty">
          <strong>まだ誰も登録されていません</strong>
          上の欄に名前を入れて「登録」を押してください。
        </div>
        <ul v-else class="list">
          <li v-for="user in store.users" :key="user.id" class="card user-row">
            <span class="avatar" aria-hidden="true">{{ user.name.slice(0, 1) }}</span>
            <div class="info">
              <div class="name ellipsis">{{ user.name }}</div>
              <div class="sub num">投擲記録 {{ user.throwRecords.length }}件　{{ fmtDate(user.registrationDate) }} 登録</div>
            </div>
            <button class="icon-btn" :aria-label="`${user.name}を削除`" @click="deleteTarget = user">
              <AppIcon name="trash" :size="20" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <ConfirmDialog
      v-if="deleteTarget"
      :title="`「${deleteTarget.name}」を削除しますか？`"
      :message="`投擲記録${deleteTarget.throwRecords.length}件もすべて削除され、元に戻せません。`"
      confirm-label="削除する"
      cancel-label="やめる"
      @confirm="deleteUser"
      @cancel="deleteTarget = null"
    />
  </div>
</template>

<style scoped>
.add-row {
  display: flex;
  gap: 8px;
}
.add-row .field {
  flex: 1;
  min-width: 0;
}
.add-btn {
  width: auto;
  flex: none;
  min-height: 48px;
  padding: 0 22px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 6px 10px 12px;
}
.avatar {
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sky);
  font-weight: 700;
}
.info {
  flex: 1;
  min-width: 0;
}
.name {
  font-weight: 700;
}
.sub {
  font-size: 0.75rem;
  color: var(--ink-2);
}
</style>
