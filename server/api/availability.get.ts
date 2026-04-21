import { getCached, setCached, getInflight, setInflight } from '../utils/cache'
import { scrapeAllVenues } from '../utils/scraper-all'
import type { AvailabilityResponse } from '../utils/types'

export default defineEventHandler(async (event): Promise<AvailabilityResponse> => {
  const query = getQuery(event)
  const date = (query.date as string) || new Date().toISOString().split('T')[0]

  // Strict date validation: format + calendar sanity
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, message: 'Invalid date format. Use YYYY-MM-DD' })
  }
  const parsed = new Date(date + 'T12:00:00')
  if (isNaN(parsed.getTime()) || parsed.getFullYear() < 2024 || parsed.getFullYear() > 2030) {
    throw createError({ statusCode: 400, message: 'Date out of range' })
  }

  // 1. Serve from KV cache if fresh
  const cached = await getCached(date)
  if (cached && !cached.stale) {
    return { ...cached.data, fromCache: true, cacheAgeSeconds: cached.ageSeconds }
  }

  // 2. Deduplicate concurrent requests
  const existing = getInflight(date)
  if (existing) return existing

  // 3. Scrape fresh data (stale data available as fallback)
  const promise = (async (): Promise<AvailabilityResponse> => {
    try {
      const venues = await scrapeAllVenues(date)

      const result: AvailabilityResponse = {
        date,
        venues,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        cacheAgeSeconds: 0,
      }
      await setCached(date, result)
      return result
    } catch (e) {
      // If scraping fails entirely, serve stale data if available
      if (cached) {
        console.warn(`[availability] Scrape failed, serving stale data (${cached.ageSeconds}s old):`, (e as Error).message)
        return { ...cached.data, fromCache: true, cacheAgeSeconds: cached.ageSeconds }
      }
      throw e
    }
  })()

  setInflight(date, promise)
  return promise
})
