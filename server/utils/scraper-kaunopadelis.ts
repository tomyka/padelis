import { load } from 'cheerio'
import type { Venue, Court, TimeSlot } from './types'
import { extractSetCookies, mergeCookies } from './cookies'

/**
 * Kauno Padelio Klubas — nTennis/nSoft platform
 *
 * This site is behind Cloudflare which blocks Vercel datacenter IPs.
 * When CF_PROXY_URL + CF_PROXY_TOKEN env vars are set, fetches grid HTML
 * through a Cloudflare Worker proxy (cf-proxy/) that bypasses the challenge.
 * Falls back to direct fetch when proxy is unavailable.
 */

const BASE_URL = 'https://savitarna.kaunopadelis.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeKaunoPadelis(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'kaunopadelis',
    name: 'Kauno Padelio Klubas',
    address: 'Lyderystės g. 6, Kaunas',
    city: 'Kaunas',
    bookingUrl: `${BASE_URL}/reservation/short`,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    // Try Cloudflare Worker proxy first (bypasses bot challenge)
    const html = await fetchGridHtml(date)
    if (!html) {
      venue.error = 'Nepavyko gauti rezervacijos duomenų'
      return venue
    }
    parseGrid(html, venue)
  } catch (err: any) {
    venue.error = 'Failed to fetch Kauno Padelio Klubas data'
  }

  return venue
}

/** Try CF Worker proxy, fall back to direct fetch */
async function fetchGridHtml(date: string): Promise<string | null> {
  const proxyUrl = process.env.CF_PROXY_URL
  const proxyToken = process.env.CF_PROXY_TOKEN

  // ── Proxy path ──
  if (proxyUrl && proxyToken) {
    try {
      const url = `${proxyUrl}?site=kaunopadelis&date=${date}`
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${proxyToken}` },
      })
      if (resp.ok) {
        const data = (await resp.json()) as { html?: string; error?: string }
        if (data.html && data.html.includes('booking-slot')) {
          return data.html
        }
        // Proxy returned but no booking data — could be CF challenge even from Worker
      }
    } catch {
      // Proxy failed, fall through to direct
    }
  }

  // ── Direct path (works locally, may be blocked by Cloudflare in production) ──
  return await fetchGridDirect(date)
}

async function fetchGridDirect(date: string): Promise<string | null> {
  // Step 1: GET login page
  const loginResp = await fetch(`${BASE_URL}/user/login`, {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  })
  const loginHtml = await loginResp.text()
  let cookies = extractSetCookies(loginResp.headers)

  const $login = load(loginHtml)
  const csrf = $login('input[name="YII_CSRF_TOKEN"]').first().attr('value')
  const guestLogin = $login('input[type="hidden"][name="LoginForm[var_login]"]').first().attr('value')
  const guestPass = $login('input[type="hidden"][name="LoginForm[var_password]"]').first().attr('value')

  const login = guestLogin || 'Rezervacija Kauno padelio klubas'
  const pass = guestPass || 'Kimas166!245989lku?'

  // Step 2: POST guest login
  const bodyParams: Record<string, string> = {
    'LoginForm[var_login]': login,
    'LoginForm[var_password]': pass,
  }
  if (csrf) bodyParams['YII_CSRF_TOKEN'] = csrf

  const postResp = await fetch(`${BASE_URL}/user/login`, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'text/html',
      'Accept-Language': 'lt,en;q=0.5',
      'Cookie': cookies.join('; '),
      'Referer': `${BASE_URL}/user/login`,
    },
    body: new URLSearchParams(bodyParams).toString(),
    redirect: 'manual',
  })
  cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

  if (postResp.status === 200) return null // login failed

  const location = postResp.headers.get('location')
  if (location) {
    const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`
    const rResp = await fetch(redirectUrl, {
      headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') },
      redirect: 'manual',
    })
    cookies = mergeCookies(cookies, extractSetCookies(rResp.headers))
  }

  // Step 3: GET reservation grid
  const gridResp = await fetch(
    `${BASE_URL}/reservation/short?iPlaceId=1&sDate=${date}`,
    {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html',
        'Accept-Language': 'lt,en;q=0.5',
        'Cookie': cookies.join('; '),
      },
      redirect: 'manual',
    }
  )

  if (gridResp.status >= 300) return null

  const html = await gridResp.text()

  if (html.includes('Just a moment') || html.includes('cf-browser-verification')) {
    return null // Cloudflare challenge
  }
  if (html.includes('LoginForm') && !html.includes('booking-slot')) {
    return null // still on login page
  }
  if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
    return null // no booking data
  }

  return html
}

/** Parse nTennis grid HTML into venue courts */
function parseGrid(html: string, venue: Venue): void {
  const $ = load(html)

  // Color→price map (per hour from legend, divide by 2 for 30-min slot)
  const colorPriceMap = new Map<string, number>()
  $('.legend-item').each((_, el) => {
    const style = $(el).find('span[style]').attr('style') || ''
    const colorMatch = style.match(/background-color:\s*(#[0-9a-fA-F]+)/i)
    const priceText = $(el).text().trim()
    const priceMatch = priceText.match(/(\d+(?:[.,]\d+)?)\s*€/)
    if (colorMatch && priceMatch) {
      colorPriceMap.set(colorMatch[1].toLowerCase(), parseFloat(priceMatch[1].replace(',', '.')) / 2)
    }
  })

  // Hour headers → expand to 30-min slot times
  const slotTimes: string[] = []
  $('thead th').each((_, el) => {
    const text = $(el).text().trim()
    if (/^\d{1,2}:\d{2}$/.test(text)) {
      slotTimes.push(text)
      const [hh, mm] = text.split(':')
      slotTimes.push(`${hh}:${(parseInt(mm) + 30).toString().padStart(2, '0')}`)
    }
  })

  // Court rows
  $('tr').each((_, row) => {
    const nameEl = $(row).find('td.rbt-sticky-col, th.rbt-sticky-col')
    const courtName = nameEl.text().trim()
    if (!courtName) return

    const slots: TimeSlot[] = []
    let slotIdx = 0

    $(row).find('td').each((_, cell) => {
      const classes = $(cell).attr('class') || ''
      if (classes.includes('rbt-sticky-col')) return

      const isAvailable = classes.includes('booking-slot-available')
      const isBooked = classes.includes('booking-slot-na') || classes.includes('full')
      const isPast = classes.includes('past')

      if (isAvailable || isBooked || isPast) {
        const time = slotTimes[slotIdx] || ''
        if (time) {
          const style = $(cell).attr('style') || ''
          const bgColor = style.match(/background-color:\s*(#[0-9a-fA-F]+)/i)?.[1]?.toLowerCase()
          const price = isAvailable && bgColor ? (colorPriceMap.get(bgColor) ?? null) : null
          slots.push({ time, available: isAvailable, price })
        }
        slotIdx++
      }
    })

    if (slots.length > 0) {
      venue.courts.push({
        id: `kaunopadelis-${courtName.replace(/\s+/g, '-').toLowerCase()}`,
        name: courtName,
        type: 'doubles',
        slots,
      })
    }
  })

  if (venue.courts.length === 0) {
    venue.error = 'Rezervacijos duomenys neprieinami'
  }
}
