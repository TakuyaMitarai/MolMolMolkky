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

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

// Keep the browser's status-bar tint in step with the top of each screen:
// the home hero is sky, every other page starts on the pale ground.
router.afterEach((to) => {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', to.name === 'home' ? '#8ecae6' : '#f1f9fc')
})

export default router
