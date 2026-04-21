/**
 * Simple IP-based rate limiter for /api/* routes.
 * 20 requests per IP per minute. Resets on cold start (serverless-safe).
 */

const WINDOW_MS = 60_000  // 1 minute
const MAX_REQUESTS = 20   // per IP per window
const MAX_IPS = 1000      // cap memory: drop oldest IPs if exceeded

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function getIp(event: any): string {
  // Vercel forwards real IP in x-forwarded-for
  const forwarded = getHeader(event, 'x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return getHeader(event, 'x-real-ip') || event.node?.req?.socket?.remoteAddress || 'unknown'
}

function evictOldest(): void {
  if (buckets.size < MAX_IPS) return
  const oldest = [...buckets.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)[0]
  if (oldest) buckets.delete(oldest[0])
}

export default defineEventHandler((event) => {
  // Only rate-limit API routes
  if (!event.path?.startsWith('/api/')) return

  const ip = getIp(event)
  const now = Date.now()

  let bucket = buckets.get(ip)
  if (!bucket || now > bucket.resetAt) {
    evictOldest()
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    buckets.set(ip, bucket)
  }

  bucket.count++

  if (bucket.count > MAX_REQUESTS) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    setHeader(event, 'Retry-After', String(retryAfter))
    throw createError({
      statusCode: 429,
      message: 'Too many requests. Please wait before retrying.',
    })
  }
})
