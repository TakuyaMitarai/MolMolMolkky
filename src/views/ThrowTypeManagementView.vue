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

function add() {
  const name = newName.value.trim()
  if (!name) return
  if (store.throwTypes.some((t) => t.name === name)) {
    message.value = `「${name}」はすでにあります。別の名前にしてください`
    return
  }
  store.addThrowType(name)
  message.value = `「${name}」を追加しました`
  newName.value = ''
}

function remove() {
  const t = deleteTarget.value
  if (t?.isDeletable) store.deleteThrowType(t)
  deleteTarget.value = null
}

function move(i, dir) {
  const j = i + dir
  if (j < 0 || j >= store.throwTypes.length) return
  const list = [...store.throwTypes]
  ;[list[i], list[j]] = [list[j], list[i]]
  store.reorderThrowTypes(list)
}
</script>

<template>
  <div class="page">
    <PageHeader
      title="投げ方の管理"
      sub="上にあるものほど先に表示されます"
      backLabel="ホームに戻る"
      @back="router.push({ name: 'home' })"
    />

    <div class="page-body">
      <section class="group">
        <label class="label" for="new-type">新しい投げ方</label>
        <form class="add-row" @submit.prevent="add">
          <input
            id="new-type"
            v-model="newName"
            class="field"
            type="text"
            placeholder="例: スピン"
            autocomplete="off"
            enterkeyhint="done"
          />
          <button class="btn btn-primary add-btn" type="submit" :disabled="!newName.trim()">追加</button>
        </form>
        <p v-if="message" class="notice" role="status">{{ message }}</p>
      </section>

      <section class="group">
        <h2 class="label">投げ方 {{ store.throwTypes.length }}種類</h2>
        <TransitionGroup tag="ul" name="reorder" class="list">
          <li v-for="(t, i) in store.throwTypes" :key="t.id" class="card tt-row">
            <span class="pos num">{{ i + 1 }}</span>
            <div class="tt-info">
              <div class="tt-name ellipsis">{{ t.name }}</div>
              <div class="tt-tags">
                <span :class="['tag', t.isDefault ? '' : 'solid']">{{ t.isDefault ? 'デフォルト' : 'カスタム' }}</span>
                <span v-if="!t.isDeletable" class="tag outline">削除不可</span>
              </div>
            </div>
            <button class="icon-btn" :disabled="i === 0" :aria-label="`${t.name}を上へ`" @click="move(i, -1)">
              <AppIcon name="up" :size="20" />
            </button>
            <button
              class="icon-btn"
              :disabled="i === store.throwTypes.length - 1"
              :aria-label="`${t.name}を下へ`"
              @click="move(i, 1)"
            >
              <AppIcon name="down" :size="20" />
            </button>
            <button
              class="icon-btn"
              :disabled="!t.isDeletable"
              :aria-label="t.isDeletable ? `${t.name}を削除` : `${t.name}は削除できません`"
              @click="deleteTarget = t"
            >
              <AppIcon name="trash" :size="20" />
            </button>
          </li>
        </TransitionGroup>
      </section>
    </div>

    <ConfirmDialog
      v-if="deleteTarget"
      :title="`投げ方「${deleteTarget.name}」を削除しますか？`"
      message="これまでの記録は残りますが、選択肢には出なくなります。"
      confirm-label="削除する"
      cancel-label="やめる"
      @confirm="remove"
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
.tt-row {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 4px 8px 12px;
}
.pos {
  flex: none;
  width: 26px;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--ink-2);
}
.tt-info {
  flex: 1;
  min-width: 0;
}
.tt-name {
  font-weight: 700;
}
.tt-tags {
  display: flex;
  gap: 4px;
  margin-top: 2px;
}
.tt-row .icon-btn {
  width: 40px;
}
/* rows slide to their new place when reordered */
.reorder-move {
  transition: transform 0.26s var(--ease-out);
}
.reorder-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.reorder-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.reorder-leave-active {
  display: none;
}
</style>
