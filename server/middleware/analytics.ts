import { kv } from '@vercel/kv'

/**
 * Middleware: track page visits in Upstash Redis.
 * Only counts actual page loads (not API calls or assets).
 * Stores: visits:total, visits:YYYY-MM-DD
 */
export default defineEventHandler(async (event) => {
  const url = event.path ?? ''

  // Only count HTML page requests, not API/assets
  if (url.startsWith('/api/') || url.startsWith('/_nuxt/') || url.includes('.')) {
    return
  }

  // Only track if KV is available (production)
  if (!process.env.KV_REST_API_URL) return

  const today = new Date().toISOString().split('T')[0]

  try {
    await Promise.all([
      kv.incr('visits:total'),
      kv.incr(`visits:${today}`),
    ])
  } catch {
    // Never fail a page load due to analytics error
  }
})
