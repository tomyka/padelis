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
      title: 'Padel Kaunas',
      meta: [
        { name: 'description', content: 'Visų Kauno padelio aikštelių užimtumas vienoje vietoje' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0f172a' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Padel Kaunas',
      short_name: 'Padel',
      description: 'Kauno padelio aikštelių užimtumas',
      theme_color: '#0f172a',
      background_color: '#0f172a',
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
      '/api/**': { cors: true },
    },
  },
})
