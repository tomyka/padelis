import { scrapePadelHub } from './scraper-padelhub'
import { scrapePadelHouse } from './scraper-padelhouse'
import { scrapeTennisSpace } from './scraper-tennisspace'
import { scrapeKaunoPadelis } from './scraper-kaunopadelis'
import { scrapeVilniusPadel } from './scraper-vilniuspadel'
import { scrapeA1Padel } from './scraper-a1padel'
import { scrapeWineroArena, WINERO_VENUES } from './scraper-winero'
import type { Venue } from './types'

/**
 * Scrape all venues in parallel. Each scraper has its own timeout
 * and error handling — a single venue failure won't block others.
 */
export async function scrapeAllVenues(date: string): Promise<Venue[]> {
  const [padelhub, padelhouse, tennisspace, kaunopadelis, vilniuspadel, a1padel, ...wineroVenues] =
    await Promise.all([
      scrapePadelHub(date),
      scrapePadelHouse(date),
      scrapeTennisSpace(date),
      scrapeKaunoPadelis(date),
      scrapeVilniusPadel(date),
      scrapeA1Padel(date),
      ...WINERO_VENUES.map(cfg => scrapeWineroArena(cfg, date)),
    ])

  return [padelhub, padelhouse, tennisspace, kaunopadelis, vilniuspadel, a1padel, ...wineroVenues]
}
