import { setCached } from '../../utils/cache'
import { scrapeAllVenues } from '../../utils/scraper-all'
import type { AvailabilityResponse } from '../../utils/types'

/**
 * Cron endpoint: pre-scrapes today + tomorrow and stores in Vercel KV.
 * Called every 5 minutes by Vercel Cron.
 * Protected by CRON_SECRET to prevent external abuse.
 */
export default defineEventHandler(async (event) => {
  // Verify cron secret (Vercel sends this header automatically for cron jobs)
  const authHeader = getHeader(event, 'authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const now = new Date()
  const dates: string[] = []

  // Pre-warm today + next 2 days (most commonly viewed)
  for (let i = 0; i < 3; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    dates.push(d.toISOString().split('T')[0])
  }

  const results: Record<string, { venues: number; errors: number; ms: number }> = {}

  for (const date of dates) {
    const start = Date.now()
    try {
      const venues = await scrapeAllVenues(date)

      const errorCount = venues.filter(v => v.error).length
      const result: AvailabilityResponse = {
        date,
        venues,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        cacheAgeSeconds: 0,
      }
      await setCached(date, result)
      results[date] = { venues: venues.length, errors: errorCount, ms: Date.now() - start }
    } catch (e) {
      results[date] = { venues: 0, errors: -1, ms: Date.now() - start }
      console.error(`[cron] Failed to scrape ${date}:`, (e as Error).message)
    }
  }

  return {
    ok: true,
    scraped: dates.length,
    results,
    timestamp: new Date().toISOString(),
  }
})
