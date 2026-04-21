import { load } from 'cheerio'
import type { Venue, TimeSlot } from './types'
import { extractSetCookies, mergeCookies } from './cookies'

/**
 * A1Padel Klaipėda — nTennis/nSoft platform
 * Guest auto-login: GET login → extract hidden creds → POST → GET reservation grid
 */

const BASE_URL = 'https://savitarna.a1padel.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeA1Padel(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'a1padel',
    name: 'A1Padel Klaipėda',
    address: 'Smilgų g. 5, Klaipėda',
    city: 'Klaipėda',
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

    // Fallback: public guest credentials visible in source HTML
    const login = guestLogin || 'A1 Padel'
    const pass = guestPass || 'ciDERedrU3wlfrekacHo'

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
      { headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') }, redirect: 'manual' }
    )

    if (gridResp.status >= 300 && gridResp.status < 400) {
      venue.error = 'Session expired — grid redirected to login'
      return venue
    }

    const html = await gridResp.text()

    if (html.includes('LoginForm') && !html.includes('booking-slot')) {
      venue.error = 'Guest login failed'
      return venue
    }

    if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
      venue.error = 'Grid page loaded but contains no booking data'
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

    // Fallback: parse prices directly from legend HTML when span[style] is missing
    if (colorPriceMap.size === 0) {
      const legendSection = html.match(/class="legend"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? ''
      const colorMatches = [...legendSection.matchAll(/background-color:\s*(#[0-9a-fA-F]{3,6})/gi)]
      const priceMatches = [...legendSection.matchAll(/(\d+(?:[.,]\d+)?)\s*€/g)]
      colorMatches.forEach((m, i) => {
        if (priceMatches[i]) {
          colorPriceMap.set(m[1].toLowerCase(), parseFloat(priceMatches[i][1].replace(',', '.')) / 2)
        }
      })
    }

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

    const now = new Date()
    const currentMinutes = now.toDateString() === new Date(date + 'T12:00:00').toDateString()
      ? now.getHours() * 60 + now.getMinutes()
      : -1

    // Court rows — same kaire/desine structure as other nTennis venues
    $('tr').each((_, row) => {
      const nameEl = $(row).find('td.rbt-sticky-col, th.rbt-sticky-col')
      const courtName = nameEl.find('span').first().text().trim() || nameEl.text().trim()
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
            const slotEnd = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]) + 30
            const actuallyPast = currentMinutes > 0 && slotEnd <= currentMinutes
            const style = $(cell).attr('style') || ''
            const bgColor = style.match(/background-color:\s*(#[0-9a-fA-F]+)/i)?.[1]?.toLowerCase()
            const available = isAvailable && !actuallyPast
            const price = available && bgColor ? (colorPriceMap.get(bgColor) ?? null) : null
            slots.push({ time, available, price })
          }
          slotIdx++
        }
      })

      if (slots.length > 0) {
        venue.courts.push({
          id: `a1padel-${courtName.replace(/\s+/g, '-').toLowerCase()}`,
          name: courtName,
          type: 'doubles',
          slots,
        })
      }
    })
  } catch (_err: any) {
    venue.error = 'Failed to fetch A1Padel data'
  }

  return venue
}
