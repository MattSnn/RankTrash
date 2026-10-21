import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// A landing page não é um PWA: sem link do manifest e sem registro do service worker (só o app instala).
function landingWithoutPwa(): Plugin {
  return {
    name: 'landing-without-pwa',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['landing.html']
      if (page?.type !== 'asset' || typeof page.source !== 'string') return
      page.source = page.source
        .replace(/<link rel="manifest"[^>]*>/, '')
        .replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/, '')
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    landingWithoutPwa(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'RankTrash – Facens Lixo Zero',
        short_name: 'RankTrash',
        description: 'Descarte certo, ganhe pontos e suba no ranking da Facens.',
        lang: 'pt-BR',
        theme_color: '#1f3a9e',
        background_color: '#1f3a9e',
        display: 'standalone',
        orientation: 'portrait',
        id: '/',
        start_url: '/',
        scope: '/',
        // melhor esforço (Android/Chrome): abrir links do site no app instalado
        launch_handler: { client_mode: 'navigate-existing' },
        handle_links: 'preferred',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // a landing page é outra página (outro subdomínio em produção): fora do cache do app e da navegação offline
        globIgnores: ['landing.html', 'landing/**', 'assets/landing-*'],
        navigateFallbackDenylist: [/^\/landing\.html$/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
    }),
  ],
  build: {
    // duas páginas: o app (index.html) e a landing page (landing.html, servida em sobre.ranktrash.eco.br)
    rollupOptions: { input: { main: 'index.html', landing: 'landing.html' } },
  },
  test: { include: ['tests/**/*.test.ts'] },
})
