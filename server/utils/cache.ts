import { kv } from '@vercel/kv'
import type { AvailabilityResponse } from './types'

const KV_PREFIX = 'avail'
const FRESH_TTL_SEC = 5 * 60         // 5 min — considered "fresh"
const STALE_TTL_SEC = 60 * 60        // 60 min — stale but servable as fallback
const KV_STORE_TTL_SEC = STALE_TTL_SEC + 60 // stored slightly longer than stale window

interface KVEntry {
  data: AvailabilityResponse
  storedAt: number // epoch ms
}

// In-flight dedup stays in-memory (per-instance by nature)
const inflight = new Map<string, Promise<AvailabilityResponse>>()

function kvKey(date: string): string {
  return `${KV_PREFIX}:${date}`
}

/** Is the KV_URL configured? (only on Vercel production) */
function isKVAvailable(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

// ── In-memory fallback for local dev (no KV available) ──────────────
const memCache = new Map<string, KVEntry>()

/**
 * Read from cache. Returns { data, age, stale } or null.
 * Tries Vercel KV first, falls back to in-memory for local dev.
 */
export async function getCached(date: string): Promise<{
  data: AvailabilityResponse
  ageSeconds: number
  stale: boolean
} | null> {
  const key = kvKey(date)
  let entry: KVEntry | null = null

  if (isKVAvailable()) {
    try {
      entry = await kv.get<KVEntry>(key)
    } catch (e) {
      console.warn('[cache] KV read error:', (e as Error).message)
    }
  } else {
    entry = memCache.get(key) ?? null
  }

  if (!entry?.data) return null

  const ageSeconds = Math.floor((Date.now() - entry.storedAt) / 1000)

  // Beyond stale window — treat as expired
  if (ageSeconds > STALE_TTL_SEC) return null

  return {
    data: entry.data,
    ageSeconds,
    stale: ageSeconds > FRESH_TTL_SEC,
  }
}

/**
 * Store availability data in cache (KV or in-memory fallback).
 */
export async function setCached(date: string, data: AvailabilityResponse): Promise<void> {
  const key = kvKey(date)
  const entry: KVEntry = { data, storedAt: Date.now() }

  if (isKVAvailable()) {
    try {
      await kv.set(key, entry, { ex: KV_STORE_TTL_SEC })
    } catch (e) {
      console.warn('[cache] KV write error:', (e as Error).message)
    }
  } else {
    memCache.set(key, entry)
    // Simple eviction for local dev
    if (memCache.size > 30) {
      const oldest = [...memCache.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt)[0]
      if (oldest) memCache.delete(oldest[0])
    }
  }
}

export function getInflight(date: string): Promise<AvailabilityResponse> | undefined {
  return inflight.get(date)
}

export function setInflight(date: string, promise: Promise<AvailabilityResponse>): void {
  inflight.set(date, promise)
  promise.finally(() => inflight.delete(date))
}
