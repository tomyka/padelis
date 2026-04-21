import type { AvailabilityResponse } from './types'

const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const MAX_CACHE_ENTRIES = 30          // ~30 unique dates max

interface CacheEntry {
  data: AvailabilityResponse
  expiresAt: number
}

// Module-level cache — persists across requests on the same server instance
const cache = new Map<string, CacheEntry>()

// In-flight requests — prevents multiple simultaneous scrapes for the same date
const inflight = new Map<string, Promise<AvailabilityResponse>>()

/** Evict all expired entries; if still over limit, drop oldest */
function evict(): void {
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) cache.delete(key)
  }
  // Hard cap: drop entries with soonest expiry first
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)[0]
    if (oldest) cache.delete(oldest[0])
  }
}

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
  evict()
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
