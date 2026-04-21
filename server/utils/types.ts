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

export type City = 'Vilnius' | 'Kaunas' | 'Klaipėda' | 'Šiauliai' | 'Panevėžys'

export const CITIES: City[] = ['Vilnius', 'Kaunas', 'Klaipėda', 'Šiauliai', 'Panevėžys']

export const CITY_COORDS: Record<City, { lat: number; lng: number }> = {
  'Vilnius':    { lat: 54.6872, lng: 25.2797 },
  'Kaunas':     { lat: 54.8985, lng: 23.9036 },
  'Klaipėda':   { lat: 55.7033, lng: 21.1443 },
  'Šiauliai':   { lat: 55.9349, lng: 23.3137 },
  'Panevėžys':  { lat: 55.7348, lng: 24.3601 },
}

export interface Venue {
  id: string          // "padelhub", "tennisspace", "padelhouse", "kaunopadelis"
  name: string        // "Balcia Padel Hub"
  address: string
  city: City
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
