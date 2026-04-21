/**
 * Cloudflare Worker proxy for Cloudflare-protected nTennis booking sites.
 *
 * Workers run on Cloudflare's edge network and are not subject to the same
 * bot-challenge rules that block datacenter IPs (like Vercel's).
 *
 * Flow: Vercel app → this Worker → kaunopadelis.lt → grid HTML → Vercel app
 * The Vercel scraper parses the HTML with cheerio as before.
 */

interface Env {
  PROXY_TOKEN: string
}

const SITES: Record<string, { base: string; login: string; password: string; placeId: string }> = {
  kaunopadelis: {
    base: 'https://savitarna.kaunopadelis.lt',
    login: 'Rezervacija Kauno padelio klubas',
    password: 'Kimas166!245989lku?',
    placeId: '1',
  },
}

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── Cookie helpers ──────────────────────────────────────────────────────────

function extractCookies(headers: Headers): string[] {
  const cookies: string[] = []
  // Workers support getSetCookie()
  for (const c of headers.getSetCookie()) {
    const part = c.split(';')[0]
    if (part) cookies.push(part)
  }
  return cookies
}

function mergeCookies(existing: string[], incoming: string[]): string[] {
  const map = new Map<string, string>()
  for (const c of [...existing, ...incoming]) {
    const eq = c.indexOf('=')
    map.set(eq > 0 ? c.slice(0, eq) : c, c)
  }
  return Array.from(map.values())
}

// ── Main handler ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Authorization',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const url = new URL(request.url)
    const site = url.searchParams.get('site')
    const date = url.searchParams.get('date')

    // Auth: Bearer token or query param
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') ?? url.searchParams.get('token')

    if (!env.PROXY_TOKEN || token !== env.PROXY_TOKEN) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (!site || !date) {
      return json({ error: 'Missing ?site= or ?date= parameter' }, 400)
    }
    const cfg = SITES[site]
    if (!cfg) {
      return json({ error: `Unknown site: ${site}` }, 400)
    }

    try {
      const result = await fetchGrid(cfg, date)
      return json(result)
    } catch (err: any) {
      return json({ error: err?.message ?? 'Unknown error' }, 500)
    }
  },
}

// ── nTennis login + grid fetch ──────────────────────────────────────────────

async function fetchGrid(
  cfg: (typeof SITES)[string],
  date: string
): Promise<{ html: string; status: number; loginStatus: number }> {
  const { base } = cfg

  // Step 1: GET login page → session cookie + optional CSRF/creds
  const loginResp = await fetch(`${base}/user/login`, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'lt,en;q=0.5' },
    redirect: 'manual',
  })
  let cookies = extractCookies(loginResp.headers)
  const loginHtml = await loginResp.text()

  // Try to extract dynamic credentials from the page
  const csrfMatch = loginHtml.match(/name="YII_CSRF_TOKEN"[^>]*value="([^"]+)"/)
  const loginMatch = loginHtml.match(
    /type="hidden"[^>]*name="LoginForm\[var_login\]"[^>]*value="([^"]+)"/
  )
  const passMatch = loginHtml.match(
    /type="hidden"[^>]*name="LoginForm\[var_password\]"[^>]*value="([^"]+)"/
  )

  const guestLogin = loginMatch?.[1] ?? cfg.login
  const guestPass = passMatch?.[1] ?? cfg.password

  // Step 2: POST guest login
  const params = new URLSearchParams({
    'LoginForm[var_login]': guestLogin,
    'LoginForm[var_password]': guestPass,
  })
  if (csrfMatch?.[1]) params.set('YII_CSRF_TOKEN', csrfMatch[1])

  const postResp = await fetch(`${base}/user/login`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'text/html',
      'Accept-Language': 'lt,en;q=0.5',
      Cookie: cookies.join('; '),
      Referer: `${base}/user/login`,
    },
    body: params.toString(),
    redirect: 'manual',
  })
  cookies = mergeCookies(cookies, extractCookies(postResp.headers))

  // Follow redirect
  const location = postResp.headers.get('location')
  if (location) {
    const rUrl = location.startsWith('http') ? location : `${base}${location}`
    const rResp = await fetch(rUrl, {
      headers: { 'User-Agent': UA, Cookie: cookies.join('; ') },
      redirect: 'manual',
    })
    cookies = mergeCookies(cookies, extractCookies(rResp.headers))
  }

  // Step 3: GET reservation grid
  const gridResp = await fetch(`${base}/reservation/short?iPlaceId=${cfg.placeId}&sDate=${date}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html',
      'Accept-Language': 'lt,en;q=0.5',
      Cookie: cookies.join('; '),
    },
    redirect: 'manual',
  })

  if (gridResp.status >= 300 && gridResp.status < 400) {
    return { html: '', status: gridResp.status, loginStatus: postResp.status }
  }

  const html = await gridResp.text()
  return { html, status: gridResp.status, loginStatus: postResp.status }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
