/**
 * Robust Set-Cookie extraction that works across Node.js 18/20/22 and Vercel runtimes.
 * The Fetch API's handling of Set-Cookie headers varies significantly between runtimes.
 */

export function extractSetCookies(headers: Headers): string[] {
  const cookies: string[] = []

  // Method 1: getSetCookie() — available in Node ≥19.7, undici, Cloudflare Workers
  try {
    const fn = (headers as any).getSetCookie
    if (typeof fn === 'function') {
      const raw: string[] = fn.call(headers)
      if (Array.isArray(raw) && raw.length > 0) {
        for (const c of raw) {
          const part = c.split(';')[0]
          if (part) cookies.push(part)
        }
        return cookies
      }
    }
  } catch { /* ignore */ }

  // Method 2: headers.get('set-cookie') — concatenated with ', ' in most runtimes
  const raw = headers.get('set-cookie')
  if (raw) {
    // Split on commas that are followed by a cookie-name=value pattern
    // (avoids splitting on commas inside Expires date values like "Thu, 01 Jan 2025")
    for (const c of raw.split(/,(?=\s*[a-zA-Z_][a-zA-Z0-9_]*=)/)) {
      const part = c.split(';')[0].trim()
      if (part && part.includes('=')) cookies.push(part)
    }
  }

  return cookies
}

export function mergeCookies(existing: string[], incoming: string[]): string[] {
  const map = new Map<string, string>()
  for (const c of [...existing, ...incoming]) {
    const eq = c.indexOf('=')
    const key = eq > 0 ? c.slice(0, eq) : c
    map.set(key, c)
  }
  return Array.from(map.values())
}
