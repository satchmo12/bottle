import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initTelegram } from './utils/telegram'

initTelegram()
createApp(App).mount('#app')
