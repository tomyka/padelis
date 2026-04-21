import { load } from 'cheerio'
import type { Venue, TimeSlot } from './types'

/**
 * Vilnius Padel Arena — nTennis/nSoft platform (same as Tennis Space & Kauno Padelio Klubas)
 * Guest auto-login: GET login → extract hidden creds → POST → GET reservation grid
 * URL: https://rezervacijos.vilniuspadel.lt
 */

const BASE_URL = 'https://rezervacijos.vilniuspadel.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function extractSetCookies(headers: Headers): string[] {
  const cookies: string[] = []
  const raw = (headers as any).getSetCookie?.() ?? []
  for (const c of raw) {
    const part = c.split(';')[0]
    if (part) cookies.push(part)
  }
  if (cookies.length === 0) {
    const raw2 = headers.get('set-cookie')
    if (raw2) {
      for (const c of raw2.split(/,(?=\s*\w+=)/)) {
        const part = c.split(';')[0].trim()
        if (part) cookies.push(part)
      }
    }
  }
  return cookies
}

function mergeCookies(existing: string[], incoming: string[]): string[] {
  const map = new Map<string, string>()
  for (const c of [...existing, ...incoming]) {
    const eq = c.indexOf('=')
    const key = eq > 0 ? c.slice(0, eq) : c
    map.set(key, c)
  }
  return Array.from(map.values())
}

export async function scrapeVilniusPadel(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'vilniuspadel',
    name: 'Vilnius Padel Arena',
    address: 'Žygio g. 97A, Vilnius',
    city: 'Vilnius',
    bookingUrl: `${BASE_URL}/reservation/short`,
    courts: [],
    lastUpdated: new Date().toISOString(),
  }

  try {
    // Step 1: GET login page — extract hidden guest credentials
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

    if (!guestLogin || !guestPass) {
      venue.error = 'Could not extract guest credentials'
      return venue
    }

    // Step 2: POST guest login
    const bodyParams: Record<string, string> = {
      'LoginForm[var_login]': guestLogin,
      'LoginForm[var_password]': guestPass,
    }
    if (csrf) bodyParams['YII_CSRF_TOKEN'] = csrf

    const postResp = await fetch(`${BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Referer': `${BASE_URL}/user/login`,
      },
      body: new URLSearchParams(bodyParams).toString(),
      redirect: 'manual',
    })
    cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

    const location = postResp.headers.get('location')
    if (location) {
      const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`
      const redirectResp = await fetch(redirectUrl, {
        headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') },
        redirect: 'manual',
      })
      cookies = mergeCookies(cookies, extractSetCookies(redirectResp.headers))
    }

    // Step 3: GET reservation grid
    const gridResp = await fetch(
      `${BASE_URL}/reservation/short?iPlaceId=1&sDate=${date}`,
      { headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') } }
    )
    const html = await gridResp.text()

    if (html.includes('LoginForm') && !html.includes('booking-slot')) {
      venue.error = 'Guest login failed'
      return venue
    }

    const $ = load(html)

    // Color→price map from legend (per hour → divide by 2 for 30-min slot)
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

    // Build time slot list from hour headers (each hour → :00 and :30)
    const slotTimes: string[] = []
    $('thead th').each((_, el) => {
      const text = $(el).text().trim()
      if (/^\d{1,2}:\d{2}$/.test(text)) {
        slotTimes.push(text)
        const [hh, mm] = text.split(':')
        slotTimes.push(`${hh}:${(parseInt(mm) + 30).toString().padStart(2, '0')}`)
      }
    })

    // Court rows — same kaire/desine structure as Tennis Space & Kauno Padelio Klubas
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
          id: `vilniuspadel-${courtName.replace(/\s+/g, '-').toLowerCase()}`,
          name: courtName,
          type: 'doubles',
          slots,
        })
      }
    })
  } catch (err: any) {
    venue.error = err?.message || 'Failed to fetch Vilnius Padel Arena data'
  }

  return venue
}
