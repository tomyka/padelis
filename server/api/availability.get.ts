import { scrapePadelHub } from '../utils/scraper-padelhub'
import { scrapePadelHouse } from '../utils/scraper-padelhouse'
import { scrapeTennisSpace } from '../utils/scraper-tennisspace'
import { scrapeKaunoPadelis } from '../utils/scraper-kaunopadelis'
import { getCached, setCached, getInflight, setInflight, cacheAgeSeconds } from '../utils/cache'
import type { AvailabilityResponse } from '../utils/types'

export default defineEventHandler(async (event): Promise<AvailabilityResponse> => {
  const query = getQuery(event)
  const date = (query.date as string) || new Date().toISOString().split('T')[0]

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, message: 'Invalid date format. Use YYYY-MM-DD' })
  }

  // Serve from cache if fresh
  const cached = getCached(date)
  if (cached) {
    return { ...cached, fromCache: true, cacheAgeSeconds: cacheAgeSeconds(date) }
  }

  // Deduplicate concurrent requests for same date
  const existing = getInflight(date)
  if (existing) return existing

  const promise = (async (): Promise<AvailabilityResponse> => {
    const [padelhub, padelhouse, tennisspace, kaunopadelis] = await Promise.all([
      scrapePadelHub(date),
      scrapePadelHouse(date),
      scrapeTennisSpace(date),
      scrapeKaunoPadelis(date),
    ])

    const result: AvailabilityResponse = {
      date,
      venues: [padelhub, padelhouse, tennisspace, kaunopadelis],
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      cacheAgeSeconds: 0,
    }
    setCached(date, result)
    return result
  })()

  setInflight(date, promise)
  return promise
})
