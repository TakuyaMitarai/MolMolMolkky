import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource-variable/jost'
import App from './App.vue'
import router from './router'
import './assets/styles/theme.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// iOS Safari only applies :active (the pressed look on keys and buttons) when
// the document has a touch listener, so register an empty one.
document.addEventListener('touchstart', () => {}, { passive: true })
