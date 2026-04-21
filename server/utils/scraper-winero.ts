import type { Venue, Court, TimeSlot } from './types'

/**
 * Generic Winero.lt scraper
 * Public API: /api/arenas/{id} + /api/bookings/public-availability?arena_id={id}&date={date}
 * Returns booked slots; we invert against operating hours to get availability.
 */

const WINERO_BASE = 'https://www.winero.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Parse "Monday 06:00 – 23:00\nTuesday..." → {open: "06:00", close: "23:00"} for today */
function parseOpeningHours(raw: string, date: string): { open: string; close: string } | null {
  const dateObj = new Date(date + 'T12:00:00')
  const dayName = DAY_NAMES[dateObj.getDay()]
  const lines = raw.split(/\\n|\n/)
  for (const line of lines) {
    if (!line.includes(dayName)) continue
    const match = line.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
    if (match) return { open: match[1].padStart(5, '0'), close: match[2].padStart(5, '0') }
  }
  return null
}

/** Get per-30-min price for a given slot time on a given date from Winero price periods */
function getPriceForSlot(court: any, date: string, slotTime: string): number | null {
  const slotMin = toMinutes(slotTime)
  const dateObj = new Date(date + 'T12:00:00')
  const dayShort = DAY_SHORT[dateObj.getDay()]

  // Check exception price periods first
  for (const exc of court.exception_price_periods ?? []) {
    if (!exc.days.includes(dayShort)) continue
    const start = new Date(exc.start_date + 'T00:00:00')
    const end = new Date(exc.end_date + 'T23:59:59')
    if (dateObj >= start && dateObj <= end) {
      for (const ts of exc.time_slots ?? []) {
        const tsStart = toMinutes(ts.start_time)
        const tsEnd = ts.end_time === '00:00' ? 1440 : toMinutes(ts.end_time)
        if (slotMin >= tsStart && slotMin < tsEnd) return ts.price / 2 // per hour → per 30min
      }
    }
  }

  // Regular price periods
  for (const period of court.price_periods ?? []) {
    if (!period.days.includes(dayShort)) continue
    for (const ts of period.time_slots ?? []) {
      const tsStart = toMinutes(ts.start_time)
      const tsEnd = ts.end_time === '00:00' ? 1440 : toMinutes(ts.end_time)
      if (slotMin >= tsStart && slotMin < tsEnd) return ts.price / 2
    }
  }

  return null
}

/** Convert "HH:MM" or "HH:MM:SS" to minutes since midnight */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Generate 30-min slot start times between open and close */
function generateSlots(open: string, close: string): string[] {
  const slots: string[] = []
  let cur = toMinutes(open)
  // "00:00" as closing means midnight (1440 min)
  const end = close === '00:00' ? 1440 : toMinutes(close)
  while (cur < end) {
    const h = Math.floor(cur / 60).toString().padStart(2, '0')
    const m = (cur % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    cur += 30
  }
  return slots
}

export interface WineroArenaConfig {
  id: string
  venueId: string
  name: string
  address: string
  bookingUrl: string
  /** Court name substrings to skip (case-insensitive) */
  skipCourts?: string[]
}

export async function scrapeWineroArena(config: WineroArenaConfig, date: string): Promise<Venue> {
  const venue: Venue = {
    id: config.venueId,
    name: config.name,
    address: config.address,
    city: 'Vilnius',
    bookingUrl: config.bookingUrl,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    const [arenaRes, availRes] = await Promise.all([
      fetch(`${WINERO_BASE}/api/arenas/${config.id}`, { headers: { 'User-Agent': UA } }),
      fetch(`${WINERO_BASE}/api/bookings/public-availability?arena_id=${config.id}&date=${date}`, {
        headers: { 'User-Agent': UA },
      }),
    ])

    const [arenaData, availData] = await Promise.all([arenaRes.json(), availRes.json()])

    if (!arenaData.id) {
      venue.error = 'Arena not found'
      return venue
    }

    // Build booked ranges per court: Map<courtId, [{start, end}]>
    const bookedMap = new Map<string, Array<{ start: number; end: number }>>()
    for (const slot of availData.data ?? []) {
      const start = toMinutes(slot.start_time)
      const end = slot.end_time === '00:00:00' ? 1440 : toMinutes(slot.end_time)
      if (!bookedMap.has(slot.court_id)) bookedMap.set(slot.court_id, [])
      bookedMap.get(slot.court_id)!.push({ start, end })
    }

    // Parse today's operating hours
    const hours = parseOpeningHours(arenaData.opening_hours ?? '', date)
    if (!hours) {
      venue.error = 'Could not parse opening hours'
      return venue
    }

    const slotTimes = generateSlots(hours.open, hours.close)

    // Courts come from detail API (includes price_periods)
    const courts: any[] = arenaData.courts ?? []

    const now = new Date()
    const todayStr = date
    const currentMinutes = now.toDateString() === new Date(todayStr + 'T12:00:00').toDateString()
      ? now.getHours() * 60 + now.getMinutes()
      : -1

    for (const court of courts) {
      const skip = config.skipCourts?.some(s => court.name.toLowerCase().includes(s.toLowerCase()))
      if (skip) continue

      const booked = bookedMap.get(court.id) ?? []
      const type = court.name.toLowerCase().includes('single') ? 'singles' : 'doubles'

      const slots: TimeSlot[] = slotTimes.map(time => {
        const slotStart = toMinutes(time)
        const slotEnd = slotStart + 30
        const isPast = currentMinutes > 0 && slotEnd <= currentMinutes
        const isBooked = booked.some(b => b.start < slotEnd && b.end > slotStart)
        const available = !isPast && !isBooked
        const price = available ? getPriceForSlot(court, date, time) : null
        return { time, available, price }
      })

      venue.courts.push({
        id: `${config.venueId}-${court.id}`,
        name: court.name,
        type: type as 'singles' | 'doubles',
        slots,
      })
    }
  } catch (err: any) {
    venue.error = `Failed to fetch ${config.name} data`
  }

  return venue
}

// ─── Venue configurations ─────────────────────────────────────────────────────

export const WINERO_VENUES: WineroArenaConfig[] = [
  {
    id: 'a77b94b4-46c0-4e7b-b69d-2ed700d3e483',
    venueId: 'zirmunai',
    name: 'Žirmūnų Padelio Arena',
    address: 'Žirmūnų g. 139, Vilnius',
    bookingUrl: 'https://www.winero.lt/arena/irmn-padelio-arena',
  },
  {
    id: '6526ba41-0328-4562-9da0-c8708f2e42ec',
    venueId: 'padelfactory',
    name: 'Padel Factory',
    address: 'Savanorių pr. 180, Vilnius',
    bookingUrl: 'https://www.winero.lt/arena/padel-factory',
    skipCourts: ['kamuoliukų mašina', 'ball machine'],
  },
]
