import type { Venue, Court, TimeSlot } from './types'

/**
 * Padel Hub — Mokesta API (ABP Framework)
 * Clean REST API, no auth required.
 * GET /api/services/app/Padelhub/GetCourtReservations?date=YYYY-MM-DD
 */
export async function scrapePadelHub(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'padelhub',
    name: 'Balcia Padel Hub',
    address: 'B. Brazdžionio g. 25, Kaunas',
    city: 'Kaunas',
    bookingUrl: 'https://savpadelhub.mokesta.lt/',
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    const url = `https://padelhubsavapi.mokesta.lt/api/services/app/Padelhub/GetCourtReservations?date=${date}`
    const data: any = await $fetch(url, { timeout: 15000 })

    if (!data?.result) {
      venue.error = 'No data returned from API'
      return venue
    }

    for (const court of data.result) {
      // Only include padel courts (skip squash)
      if (!court.tab?.toLowerCase().includes('padel')) continue

      const name = (court.name || '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
      const isDoubles = name.toLowerCase().includes('dvejet')
      const isSingles = name.toLowerCase().includes('vienet')

      const slots: TimeSlot[] = court.times.map((t: any) => {
        // timeIdentifier: 14=07:00, 15=07:30, 16=08:00, ...
        const hour = Math.floor(t.timeIdentifier / 2)
        const min = (t.timeIdentifier % 2) * 30
        return {
          time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
          available: !t.isReserved,
          price: t.price ?? null,
        }
      })

      venue.courts.push({
        id: `padelhub-${court.id}`,
        name: name
          .replace(/Padelio (?:dvejetų|vienetų) kortas\s*/i, '')
          .replace(/\s*[„"",,]+\s*/g, ' ')
          .replace(/^\d+\s*/, (m) => `#${m.trim()} `)
          .trim() || `Kortas ${court.id}`,
        type: isSingles ? 'singles' : isDoubles ? 'doubles' : 'unknown',
        slots,
      })
    }
  } catch (err: any) {
    venue.error = 'Failed to fetch Padel Hub data'
  }

  return venue
}
