<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDataStore } from '../stores/dataStore'

const router = useRouter()
const store = useDataStore()
const newName = ref('')
const message = ref('')

function add() {
  const name = newName.value.trim()
  if (!name) return
  if (store.throwTypes.some((t) => t.name === name)) {
    message.value = 'この投げ方は既に登録されています'
    return
  }
  store.addThrowType(name)
  message.value = `投げ方「${name}」を追加しました`
  newName.value = ''
}

function remove(t) {
  if (!t.isDeletable) return
  if (confirm(`投げ方「${t.name}」を削除しますか？`)) store.deleteThrowType(t)
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
    <div class="navbar">
      <span class="spacer" />
      <button class="btn-inline" @click="router.push({ name: 'home' })">完了</button>
    </div>
    <h1 class="page-title">投げ方管理</h1>

    <div class="pad add-row">
      <input v-model="newName" class="text-field" type="text" placeholder="投げ方名称" @keyup.enter="add" />
      <button class="btn btn-primary add-btn" :disabled="!newName.trim()" @click="add">追加</button>
    </div>
    <p v-if="message" class="center muted">{{ message }}</p>

    <div class="page-scroll pad col">
      <div v-for="(t, i) in store.throwTypes" :key="t.id" class="tt-row">
        <div class="tt-info">
          <div class="tt-name">{{ t.name }}</div>
          <div :class="['tt-tag', t.isDefault ? 'def' : 'cus']">{{ t.isDefault ? 'デフォルト' : 'カスタム' }}</div>
        </div>
        <div class="arrows">
          <button :disabled="i === 0" @click="move(i, -1)">▲</button>
          <button :disabled="i === store.throwTypes.length - 1" @click="move(i, 1)">▼</button>
        </div>
        <button v-if="t.isDeletable" class="trash" @click="remove(t)">🗑️</button>
        <span v-else class="muted small">削除不可</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.add-row {
  display: flex;
  gap: 0.5rem;
}
.add-row .text-field {
  flex: 1;
}
.add-btn {
  width: auto;
  min-height: auto;
  padding: 0.5rem 1rem;
}
.tt-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--navy);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}
.tt-info {
  flex: 1;
}
.tt-name {
  font-weight: 700;
}
.tt-tag {
  font-size: 0.75rem;
}
.tt-tag.def {
  color: #9fc0ff;
}
.tt-tag.cus {
  color: #cba6ff;
}
.arrows {
  display: flex;
  gap: 0.3rem;
}
.arrows button {
  color: #fff;
  padding: 0.25rem 0.45rem;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 6px;
}
.arrows button:disabled {
  opacity: 0.3;
}
.trash {
  font-size: 1.1rem;
}
.small {
  font-size: 0.75rem;
}
</style>
