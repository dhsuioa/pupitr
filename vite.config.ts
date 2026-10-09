/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/pupitr/',
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Пюпитр',
        short_name: 'Пюпитр',
        lang: 'ru',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // .mjs — воркер pdf.js; OSMD весит больше стандартного предела 2 МБ.
      workbox: { globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico}'], maximumFileSizeToCacheInBytes: 6 * 1024 * 1024 },
    }),
  ],
  test: { environment: 'node' },
})
