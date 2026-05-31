import { createRouter, createWebHashHistory } from 'vue-router'

// Hash history avoids 404s on refresh under GitHub Pages (no server rewrite).
const routes = [
  { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
  { path: '/users', name: 'users', component: () => import('../views/UserRegistrationView.vue') },
  { path: '/setup', name: 'setup', component: () => import('../views/GameSetupView.vue') },
  { path: '/game', name: 'game', component: () => import('../views/GameView.vue') },
  { path: '/record', name: 'record', component: () => import('../views/ThrowRecordingView.vue') },
  { path: '/stats', name: 'stats', component: () => import('../views/StatisticsView.vue') },
  { path: '/throw-types', name: 'throwTypes', component: () => import('../views/ThrowTypeManagementView.vue') },
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
