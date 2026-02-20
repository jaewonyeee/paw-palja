import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['mascot/burti/burti-favicon.png', 'mascot/burti/burti-app-icon.png'],
      manifest: {
        name: 'Burti',
        short_name: 'Burti',
        description: 'Burti - AI Pet Diary & Health Management',
        theme_color: '#6C5CE7',
        background_color: '#FFF8F0',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/mascot/burti/burti-app-icon.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/mascot/burti/burti-app-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/videos\//, /^\/api\//],
        runtimeCaching: [
          {
            // SSE streaming must NOT be cached or intercepted by the service worker
            urlPattern: /\/api\/v1\/comments\/stream\//i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https?:\/\/.*\/api\/v1\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60,
              },
              networkTimeoutSeconds: 30,
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            urlPattern: /\.(?:woff2?|ttf|eot)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'font-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'ui': ['motion', 'lucide-react', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
})
