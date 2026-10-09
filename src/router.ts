import { createRouter, createWebHashHistory } from 'vue-router'
import { useApp } from './stores/app'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/join/:token', component: () => import('./views/JoinView.vue'), meta: { public: true } },
    { path: '/settings', component: () => import('./views/SettingsView.vue') },
    { path: '/library', component: () => import('./views/LibraryView.vue') },
    { path: '/piece/:id', component: () => import('./views/PieceView.vue') },
    { path: '/diag', component: () => import('./views/DiagView.vue'), meta: { public: true } },
  ],
})

// Публичные страницы не ждут сеть; остальные ждут только при первом запуске без снимка.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const app = useApp()
  await app.start()
  return app.user ? true : { path: '/login', query: { next: to.fullPath } }
})
