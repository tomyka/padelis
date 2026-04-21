import { load } from 'cheerio'
import type { Venue, Court, TimeSlot } from './types'

/**
 * Padel House — Public HTML timetable
 * Available: <td style="background-color:#xxx" data-court="1" data-time="10:00">
 * Booked: <td class="not-available">
 * Prices derived from background-color via on-page legend (div.time-description).
 */

function parseColorPriceMap(html: string): Map<string, number> {
  const $ = load(html)
  const map = new Map<string, number>()

  $('div.time-description').each((_, el) => {
    const colorEl = $(el).find('div.color')
    const descEl = $(el).find('div.description')
    const style = colorEl.attr('style') || ''
    const colorMatch = style.match(/background-color:\s*(#[0-9a-fA-F]+)/i)
    // Current (possibly promo) price — first number before €
    const priceText = descEl.clone().children('.old-price').remove().end().text()
    const priceMatch = priceText.match(/(\d+)\s*€/)
    if (colorMatch && priceMatch) {
      map.set(colorMatch[1].toLowerCase(), parseInt(priceMatch[1]))
    }
  })

  return map
}

export async function scrapePadelHouse(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'padelhouse',
    name: 'Padel House',
    address: 'A. Juozapavičiaus pr. 3, Kaunas',
    city: 'Kaunas',
    bookingUrl: 'https://rezervacija.padelhouse.lt/',
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    const html = await $fetch<string>(`https://rezervacija.padelhouse.lt/?date=${date}`, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PadelKaunas/1.0)' },
    })

    const colorPriceMap = parseColorPriceMap(html)
    const $ = load(html)
    const courtsMap = new Map<string, TimeSlot[]>()

    // Build 30-min time slots from colspan=2 hour headers
    const slotTimes: string[] = []
    $('table').first().find('th[colspan="2"]').each((_, el) => {
      const hour = $(el).text().trim()
      if (/^\d{1,2}:\d{2}$/.test(hour)) {
        slotTimes.push(hour)
        const [hh, mm] = hour.split(':')
        slotTimes.push(`${hh}:${(parseInt(mm) + 30).toString().padStart(2, '0')}`)
      }
    })

    // Use only the first (desktop) table
    $('table').first().find('tr').each((_, row) => {
      const courtNameEl = $(row).find('th.sticky-colum, td.sticky-colum')
      const courtName = courtNameEl.text().trim()
      if (!courtName) return

      const slots: TimeSlot[] = []
      let slotIdx = 0

      $(row).find('td').each((_, cell) => {
        const el = $(cell)
        const classes = el.attr('class') || ''
        if (classes.includes('sticky-colum') || classes.includes('sticky')) return

        const time = slotTimes[slotIdx] || ''
        const isBooked = classes.includes('not-available')
        const style = el.attr('style') || ''
        const bgColor = style.match(/background-color:\s*(#[0-9a-fA-F]+)/i)?.[1]?.toLowerCase()
        const price = bgColor ? (colorPriceMap.get(bgColor) ?? null) : null

        if (time) {
          slots.push({ time, available: !isBooked, price: !isBooked && price != null ? price / 2 : null })
        }
        slotIdx++
      })

      if (slots.length > 0 && !courtsMap.has(courtName)) {
        courtsMap.set(courtName, slots)
      }
    })

    let courtIdx = 1
    for (const [name, slots] of courtsMap) {
      venue.courts.push({
        id: `padelhouse-${courtIdx}`,
        name,
        type: 'doubles',
        slots,
      })
      courtIdx++
    }
  } catch (err: any) {
    venue.error = 'Failed to fetch Padel House data'
  }

  return venue
}
