import type { AvailabilityResponse } from './types'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

interface CacheEntry {
  data: AvailabilityResponse
  expiresAt: number
}

// Module-level cache — persists across requests on the same server instance
const cache = new Map<string, CacheEntry>()

// In-flight requests — prevents multiple simultaneous scrapes for the same date
const inflight = new Map<string, Promise<AvailabilityResponse>>()

export function getCached(date: string): AvailabilityResponse | null {
  const entry = cache.get(date)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(date)
    return null
  }
  return entry.data
}

export function setCached(date: string, data: AvailabilityResponse): void {
  cache.set(date, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

export function getInflight(date: string): Promise<AvailabilityResponse> | undefined {
  return inflight.get(date)
}

export function setInflight(date: string, promise: Promise<AvailabilityResponse>): void {
  inflight.set(date, promise)
  // Clean up after settled
  promise.finally(() => inflight.delete(date))
}

export function cacheAgeSeconds(date: string): number | null {
  const entry = cache.get(date)
  if (!entry) return null
  return Math.floor((CACHE_TTL_MS - (entry.expiresAt - Date.now())) / 1000)
}
