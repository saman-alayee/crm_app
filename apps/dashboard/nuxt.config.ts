export default defineNuxtConfig({
  ssr: false,
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxt/icon', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://127.0.0.1:4000/api/v1',
    },
  },
  // Keep recently visited pages in memory for instant back/forward
  experimental: {
    payloadExtraction: false,
    appManifest: false,
  },
  vite: {
    build: {
      cssCodeSplit: true,
      sourcemap: false,
    },
    optimizeDeps: {
      include: ['vue', 'vue-router', 'pinia'],
    },
  },
  icon: {
    size: '20px',
    class: 'icon',
    mode: 'svg',
    fallbackToApi: false,
    serverBundle: {
      collections: ['lucide', 'heroicons'],
    },
    clientBundle: {
      scan: true,
      sizeLimitKb: 1024,
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      title: 'فروشگاه سامی',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content:
            'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no',
        },
        { name: 'theme-color', content: '#0b6e99' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'فروشگاه سامی' },
        { name: 'application-name', content: 'فروشگاه سامی' },
        { name: 'description', content: 'پنل فروشگاه سامی — مدیریت کارکنان و عملیات' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/pwa/apple-touch-icon.png', sizes: '180x180' },
        { rel: 'mask-icon', href: '/pwa/icon-192.png', color: '#0b6e99' },
      ],
      style: [
        {
          innerHTML:
            'html{background:#eef3f6}body{margin:0;background:#eef3f6;font-family:IRANSansX,Tahoma,sans-serif;color:#132533}#__nuxt:empty{display:flex;min-height:100vh;align-items:center;justify-content:center}#__nuxt:empty::after{content:"";width:2.5rem;height:2.5rem;border:3px solid #0b6e99;border-top-color:transparent;border-radius:9999px;animation:hr-spin .8s linear infinite}@keyframes hr-spin{to{transform:rotate(360deg)}}',
        },
      ],
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.png', 'pwa/apple-touch-icon.png', 'pwa/icon-192.png', 'pwa/icon-512.png'],
    manifest: {
      id: '/',
      name: 'فروشگاه سامی',
      short_name: 'سامی',
      description: 'پنل فروشگاه سامی — کارکنان، مرخصی، حقوق و وظایف',
      theme_color: '#0b6e99',
      background_color: '#eef3f6',
      display: 'standalone',
      display_override: ['standalone', 'minimal-ui'],
      orientation: 'any',
      lang: 'fa',
      dir: 'rtl',
      start_url: '/',
      scope: '/',
      categories: ['business', 'productivity'],
      icons: [
        {
          src: '/pwa/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,woff,ttf}'],
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
          handler: 'NetworkFirst',
          options: {
            cacheName: 'hr-api-cache',
            networkTimeoutSeconds: 8,
            expiration: {
              maxEntries: 64,
              maxAgeSeconds: 60 * 30,
            },
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: ({ request }) => request.destination === 'font',
          handler: 'CacheFirst',
          options: {
            cacheName: 'hr-font-cache',
            expiration: {
              maxEntries: 20,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
          },
        },
      ],
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      type: 'module',
    },
  },
  compatibilityDate: '2024-12-01',
});
