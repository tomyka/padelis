import { load } from 'cheerio'
import type { Venue, Court, TimeSlot } from './types'
import { extractSetCookies, mergeCookies } from './cookies'

/**
 * Kauno Padelio Klubas — nTennis/nSoft platform (same as Tennis Space)
 * Guest auto-login: GET login → extract hidden creds → POST → GET reservation grid
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

    // Fallback: public guest credentials visible in source HTML
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
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'lt,en;q=0.5',
        'Cookie': cookies.join('; '),
        'Referer': `${BASE_URL}/user/login`,
      },
      body: new URLSearchParams(bodyParams).toString(),
      redirect: 'manual',
    })
    cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

    // If POST returns 200, login likely failed (successful login returns 302)
    if (postResp.status === 200) {
      venue.error = `Login POST returned ${postResp.status} — credentials may be rejected`
      return venue
    }

    const location = postResp.headers.get('location')
    if (location) {
      const redirectUrl = location.startsWith('http') ? location : `${BASE_URL}${location}`
      const redirectResp = await fetch(redirectUrl, {
        headers: { 'User-Agent': UA, 'Accept': 'text/html', 'Cookie': cookies.join('; ') },
        redirect: 'manual',
      })
      cookies = mergeCookies(cookies, extractSetCookies(redirectResp.headers))
    }

    // Step 3: GET reservation grid
    const gridResp = await fetch(
      `${BASE_URL}/reservation/short?iPlaceId=1&sDate=${date}`,
      {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'lt,en;q=0.5',
          'Cookie': cookies.join('; '),
        },
        redirect: 'manual',
      }
    )

    // If grid redirects, the session is invalid
    if (gridResp.status >= 300 && gridResp.status < 400) {
      venue.error = 'Session expired — grid redirected to login'
      return venue
    }

    const html = await gridResp.text()

    if (html.includes('LoginForm') && !html.includes('booking-slot')) {
      venue.error = 'Guest login failed'
      return venue
    }

    // If page loaded but has no booking data at all
    if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
      const isCfChallenge = html.includes('Just a moment') || html.includes('cf-browser-verification')
      venue.error = isCfChallenge
        ? 'Svetainė apsaugota Cloudflare — duomenys neprieinami'
        : 'Rezervacijos duomenys neprieinami'
      return venue
    }

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
          type: 'doubles', // all 8 courts are padel doubles
          slots,
        })
      }
    })

    if (venue.courts.length === 0) {
      venue.error = 'Grid loaded but no courts parsed — HTML structure may have changed'
    }
  } catch (err: any) {
    venue.error = 'Failed to fetch Kauno Padelio Klubas data'
  }

  return venue
}
