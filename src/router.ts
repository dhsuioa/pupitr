import { createRouter, createWebHashHistory } from 'vue-router'
import { useApp } from './stores/app'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/diag', component: () => import('./views/DiagView.vue'), meta: { public: true } },
  ],
})

router.beforeEach(async (to) => {
  const app = useApp()
  await app.start()
  if (to.meta.public || app.user) return true
  return { path: '/login', query: { next: to.fullPath } }
})
