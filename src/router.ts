import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: () => import('./views/HomeView.vue') },
    { path: '/diag', component: () => import('./views/DiagView.vue'), meta: { public: true } },
  ],
})
