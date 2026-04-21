export interface TimeSlot {
  time: string        // "07:00", "07:30", etc.
  available: boolean
  price: number | null
}

export interface Court {
  id: string          // unique: "padelhub-1", "tennisspace-46", "padelhouse-1"
  name: string        // "Kortas 1", "01 Neodenta"
  type: 'doubles' | 'singles' | 'unknown'
  slots: TimeSlot[]
}

export interface Venue {
  id: string          // "padelhub", "tennisspace", "padelhouse", "kaunopadelis"
  name: string        // "Balcia Padel Hub"
  address: string
  bookingUrl: string
  courts: Court[]
  lastUpdated: string // ISO timestamp
  error?: string
}

export interface AvailabilityResponse {
  date: string        // "2026-04-21"
  venues: Venue[]
  fetchedAt: string   // ISO timestamp
  fromCache: boolean
  cacheAgeSeconds: number | null
}
