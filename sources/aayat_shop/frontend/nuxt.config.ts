// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  ssr: true,

  routeRules: {
    '/admin/**': { ssr: false },
    '/profile/**': { ssr: false },
    '/cart/**': { ssr: false },
    '/checkout/**': { ssr: false },
    '/auth/**': { ssr: false },
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
    '@nuxt/icon',
  ],

  // Keep URLs without trailing slash (matches links + avoids nginx dir redirects)
  router: {
    options: {
      strict: false,
    },
  },

  features: {
    // Keep CSS as cacheable files instead of bloating the first HTML (~120KB inline before).
    inlineStyles: false,
  },

  nitro: {
    compressPublicAssets: true,
    prerender: {
      crawlLinks: false,
      routes: ['/'],
    },
    routeRules: {
      '/wp-home/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/images/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/logo.png': { headers: { 'cache-control': 'public, max-age=604800' } },
      '/pwa-*.png': { headers: { 'cache-control': 'public, max-age=604800' } },
      '/sitemap.xml': { headers: { 'cache-control': 'public, max-age=3600' } },
      '/robots.txt': { headers: { 'cache-control': 'public, max-age=3600' } },
    },
    devProxy: {
      '/uploads': { target: 'http://127.0.0.1:3001/uploads', changeOrigin: true },
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fa', dir: 'rtl' },
      title: 'آیتای | فروشگاه اینترنتی پوشاک',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'خرید آنلاین لباس زنانه، مردانه و بچگانه — کالکشن‌های فصل، ارسال سریع و پشتیبانی واقعی.',
        },
        { property: 'og:title', content: 'آیتای | فروشگاه اینترنتی پوشاک' },
        {
          property: 'og:description',
          content:
            'خرید آنلاین لباس زنانه، مردانه و بچگانه — کالکشن‌های فصل، ارسال سریع و پشتیبانی واقعی.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:locale', content: 'fa_IR' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'theme-color', content: '#4a382d' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      style: [
        {
          innerHTML:
            'body{margin:0;background:#f6f1ea}#__nuxt:empty{display:flex;min-height:100vh;align-items:center;justify-content:center}#__nuxt:empty::after{content:"";width:2.5rem;height:2.5rem;border:3px solid #6f5644;border-top-color:transparent;border-radius:9999px;animation:kk-spin .8s linear infinite}@keyframes kk-spin{to{transform:rotate(360deg)}}',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'apple-touch-icon', href: '/pwa-192.png' },
        { rel: 'preload', as: 'image', href: '/wp-home/hero-fall-mobile.webp', fetchpriority: 'high' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  icon: {
    size: '20px',
    class: 'icon',
    mode: 'svg',
    // آیکون‌ها از پکیج محلی @iconify-json می‌آیند، نه از api.iconify.design
    fallbackToApi: false,
    serverBundle: {
      collections: ['lucide', 'heroicons'],
    },
    clientBundle: {
      scan: true,
      sizeLimitKb: 1024,
    },
  },

  runtimeConfig: {
    public: {
      // Local: set NUXT_PUBLIC_API_BASE in .env (http://localhost:3001/api)
      // Production: usually /api behind nginx
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      /** فقط با `NUXT_PUBLIC_FORCE_DEMO_CATALOG=true` کاتالوگ نمایشی روشن می‌شود؛ پیش‌فرض = محصولات واقعی API */
      forceDemoCatalog: process.env.NUXT_PUBLIC_FORCE_DEMO_CATALOG === 'true',
    },
  },

  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      id: '/',
      name: 'آیتای | فروشگاه پوشاک',
      short_name: 'آیتای',
      description: 'فروشگاه اینترنتی پوشاک — زنانه، مردانه و بچگانه',
      theme_color: '#4a382d',
      background_color: '#f6f1ea',
      display: 'standalone',
      orientation: 'portrait',
      lang: 'fa',
      dir: 'rtl',
      scope: '/',
      start_url: '/',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      navigateFallback: '/',
      navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/\.well-known\//],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      runtimeCaching: [
        {
          urlPattern: /\/api\/(categories|products)/,
          handler: 'NetworkFirst',
          options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } },
        },
      ],
    },
    client: {
      installPrompt: true,
    },
    devOptions: {
      enabled: false,
      type: 'module',
    },
  },

  compatibilityDate: '2024-12-01',
});
