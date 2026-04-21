import { load } from 'cheerio'
import type { Venue, Court, TimeSlot } from './types'
import { extractSetCookies, mergeCookies } from './cookies'

/**
 * Tennis Space — nTennis/nSoft platform (Yii PHP)
 * Requires guest auto-login: GET login page → extract CSRF + hidden creds → POST login → GET reservation grid
 */

const BASE_URL = 'https://savitarna.tennisspace.lt'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function scrapeTennisSpace(date: string): Promise<Venue> {
  const venue: Venue = {
    id: 'tennisspace',
    name: 'Tennis Space',
    address: 'Islandijos pl. 9C, Kaunas',
    city: 'Kaunas',
    bookingUrl: `${BASE_URL}/reservation/short?iPlaceId=4`,
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
    // Guest creds are in a second form with type="hidden" — must filter by type
    const guestLogin = $login('input[type="hidden"][name="LoginForm[var_login]"]').first().attr('value')
    const guestPass = $login('input[type="hidden"][name="LoginForm[var_password]"]').first().attr('value')

    // Fallback: public guest credentials visible in source HTML
    const login = guestLogin || '1arAQhwrzwdEjuCtobqyvVUtf5FCLJBPfw4yxmeb6d'
    const pass = guestPass || 'jMkJE8b8Pjcvs5ncD0CKtNZTu9TP5Kq4T9aL04u9Yw'

    if (!csrf) {
      venue.error = 'Could not extract CSRF token from login page'
      return venue
    }

    // Step 2: POST guest login
    const body = new URLSearchParams({
      'YII_CSRF_TOKEN': csrf,
      'LoginForm[var_login]': login,
      'LoginForm[var_password]': pass,
    })

    const postResp = await fetch(`${BASE_URL}/user/login`, {
      method: 'POST',
      headers: {
        'User-Agent': UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Referer': `${BASE_URL}/user/login`,
      },
      body: body.toString(),
      redirect: 'manual',
    })

    cookies = mergeCookies(cookies, extractSetCookies(postResp.headers))

    // Follow redirect if needed
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
      `${BASE_URL}/reservation/short?iPlaceId=4&sDate=${date}`,
      { headers: { 'User-Agent': UA, 'Cookie': cookies.join('; ') }, redirect: 'manual' }
    )

    if (gridResp.status >= 300 && gridResp.status < 400) {
      venue.error = 'Session expired — grid redirected to login'
      return venue
    }

    const html = await gridResp.text()

    if (html.includes('LoginForm') && !html.includes('booking-slot')) {
      venue.error = 'Guest login failed — still on login page'
      return venue
    }

    if (!html.includes('booking-slot') && !html.includes('rbt-sticky-col')) {
      venue.error = 'Grid page loaded but contains no booking data'
      return venue
    }

    const $ = load(html)

    // Parse color→price map from legend (prices are per hour, divide by 2 for 30-min slots)
    const colorPriceMap = new Map<string, number>()
    $('.legend-item').each((_, el) => {
      const style = $(el).find('span[style]').attr('style') || ''
      const colorMatch = style.match(/background-color:\s*(#[0-9a-fA-F]+)/i)
      const priceText = $(el).text().trim()
      const priceMatch = priceText.match(/(\d+)\s*€/)
      if (colorMatch && priceMatch) {
        colorPriceMap.set(colorMatch[1].toLowerCase(), parseInt(priceMatch[1]) / 2)
      }
    })

    // Parse hour headers, then expand to 30-min slots (each header = 2 TDs: kaire + desine)
    const slotTimes: string[] = []
    $('thead th').each((_, el) => {
      const text = $(el).text().trim()
      if (/^\d{1,2}:\d{2}$/.test(text)) {
        slotTimes.push(text)
        const [hh, mm] = text.split(':')
        slotTimes.push(`${hh}:${(parseInt(mm) + 30).toString().padStart(2, '0')}`)
      }
    })

    // Parse court rows
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
        const isSingles = courtName.toLowerCase().includes('vienet')
        venue.courts.push({
          id: `tennisspace-${courtName.replace(/\s+/g, '-').toLowerCase()}`,
          name: courtName,
          type: isSingles ? 'singles' : 'doubles',
          slots,
        })
      }
    })
  } catch (err: any) {
    venue.error = 'Failed to fetch Tennis Space data'
  }

  return venue
}
