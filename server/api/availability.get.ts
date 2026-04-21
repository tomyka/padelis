import { scrapePadelHub } from '../utils/scraper-padelhub'
import { scrapePadelHouse } from '../utils/scraper-padelhouse'
import { scrapeTennisSpace } from '../utils/scraper-tennisspace'
import { scrapeKaunoPadelis } from '../utils/scraper-kaunopadelis'
import { scrapeVilniusPadel } from '../utils/scraper-vilniuspadel'
import { scrapeA1Padel } from '../utils/scraper-a1padel'
import { scrapeWineroArena, WINERO_VENUES } from '../utils/scraper-winero'
import { getCached, setCached, getInflight, setInflight, cacheAgeSeconds } from '../utils/cache'
import type { AvailabilityResponse } from '../utils/types'

export default defineEventHandler(async (event): Promise<AvailabilityResponse> => {
  const query = getQuery(event)
  const date = (query.date as string) || new Date().toISOString().split('T')[0]

  // Strict date validation: format + calendar sanity (no 9999-99-99 etc.)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw createError({ statusCode: 400, message: 'Invalid date format. Use YYYY-MM-DD' })
  }
  const parsed = new Date(date + 'T12:00:00')
  if (isNaN(parsed.getTime()) || parsed.getFullYear() < 2024 || parsed.getFullYear() > 2030) {
    throw createError({ statusCode: 400, message: 'Date out of range' })
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
    const [padelhub, padelhouse, tennisspace, kaunopadelis, vilniuspadel, a1padel, ...wineroVenues] = await Promise.all([
      scrapePadelHub(date),
      scrapePadelHouse(date),
      scrapeTennisSpace(date),
      scrapeKaunoPadelis(date),
      scrapeVilniusPadel(date),
      scrapeA1Padel(date),
      ...WINERO_VENUES.map(cfg => scrapeWineroArena(cfg, date)),
    ])

    const result: AvailabilityResponse = {
      date,
      venues: [padelhub, padelhouse, tennisspace, kaunopadelis, vilniuspadel, a1padel, ...wineroVenues],
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
