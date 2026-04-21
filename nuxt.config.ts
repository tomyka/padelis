// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@vite-pwa/nuxt',
  ],

  app: {
    head: {
      title: 'Žaisk Padelį',
      meta: [
        { name: 'description', content: 'Visos Lietuvos padelio aikštelių užimtumas vienoje vietoje' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#059669' },
        { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
      script: [
        {
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7290396604686794',
          async: true,
          crossorigin: 'anonymous',
        },
      ],
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Žaisk Padelį',
      short_name: 'Žaisk Padelį',
      description: 'Lietuvos padelio aikštelių užimtumas',
      theme_color: '#059669',
      background_color: '#f9fafb',
      display: 'standalone',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    workbox: {
      navigateFallback: '/',
    },
  },

  tailwindcss: {
    cssPath: '~/app/assets/css/tailwind.css',
  },

  nitro: {
    routeRules: {
      // API consumed only by the same origin; no open CORS needed
      '/api/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        },
      },
    },
    vercel: {
      regions: ['arn1'],
    },
  },
})
