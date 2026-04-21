<template>
  <div class="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">

    <!-- ═══ DATE NAVIGATION ═══ -->
    <nav class="mb-5 flex items-center gap-2" aria-label="Datos pasirinkimas">
      <div class="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
        <button v-for="day in quickDays" :key="day.date"
          @click="selectedDate = day.date"
          :class="[
            'shrink-0 flex flex-col items-center rounded-xl min-w-[3.25rem] px-2.5 py-2 transition-all duration-200',
            selectedDate === day.date
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300 hover:shadow-sm'
          ]">
          <span class="text-[10px] font-medium uppercase tracking-wide"
            :class="selectedDate === day.date ? 'text-emerald-200' : 'text-gray-400'">
            {{ day.label }}
          </span>
          <span class="text-base font-bold leading-tight tabular-nums">{{ day.day }}</span>
        </button>
      </div>
      <!-- Calendar picker for dates beyond 7 days -->
      <label class="relative shrink-0 cursor-pointer" title="Pasirinkti datą">
        <input type="date" v-model="selectedDate" :min="today"
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div :class="['flex h-11 items-center justify-center rounded-xl border bg-white transition-all duration-200',
          isCustomDate
            ? 'border-emerald-400 text-emerald-600 px-3 gap-1.5 shadow-sm'
            : 'border-gray-200 text-gray-400 w-11 hover:border-emerald-300 hover:text-emerald-600']">
          <svg class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v9.75" />
          </svg>
          <span v-if="isCustomDate" class="text-xs font-semibold tabular-nums">{{ selectedDate.slice(5) }}</span>
        </div>
      </label>
    </nav>

    <!-- ═══ CITY FILTER ═══ -->
    <div class="mb-3 flex items-center gap-2">
      <svg class="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
      <div class="flex flex-1 gap-1.5 overflow-x-auto no-scrollbar">
        <button v-for="city in CITIES" :key="city"
          @click="selectedCity = selectedCity === city ? null : city"
          :class="[
            'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium border transition-all duration-200',
            selectedCity === city
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
              : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-300 hover:text-emerald-600'
          ]">
          {{ city }}
          <span v-if="city !== 'Kaunas' && city !== 'Vilnius' && city !== 'Klaipėda'"
            class="ml-0.5 rounded-full bg-white/20 px-1 text-[8px] font-bold uppercase tracking-wider opacity-60">greitai</span>
        </button>
      </div>
      <!-- GPS -->
      <button v-if="gpsState === 'idle'" @click="detectCity"
        class="shrink-0 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <span class="hidden sm:inline">Mano vieta</span>
      </button>
      <span v-else-if="gpsState === 'loading'" class="shrink-0 text-xs text-gray-400 flex items-center gap-1">
        <svg class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
      </span>
      <span v-else-if="gpsState === 'done'" class="shrink-0 text-xs text-emerald-600 font-medium">📍 {{ selectedCity ?? 'Visi' }}</span>
      <span v-else-if="gpsState === 'error'" class="shrink-0 text-[10px] text-red-400">GPS neprieinamas</span>
    </div>

    <!-- ═══ FILTERS ═══ -->
    <div class="mb-5 flex flex-wrap items-center gap-2 rounded-2xl bg-white/60 border border-gray-100 px-3 py-2.5 backdrop-blur-sm">
      <!-- Time range -->
      <div class="flex items-center gap-1.5">
        <svg class="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <select v-model="filterStart"
          class="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400">
          <option value="">Nuo</option>
          <option v-for="t in allTimeSlots" :key="t" :value="t">{{ t }}</option>
        </select>
        <span class="text-gray-300 text-xs">–</span>
        <select v-model="filterEnd" :disabled="!filterStart"
          class="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:opacity-30">
          <option value="">Iki</option>
          <option v-for="t in endTimeSlots" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <!-- Divider -->
      <div class="h-5 w-px bg-gray-200 hidden sm:block"></div>

      <!-- Court type -->
      <div class="flex items-center gap-1.5">
        <svg class="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
        <select v-model="filterType"
          class="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-600 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400">
          <option :value="null">Visi kortai</option>
          <option value="doubles">2v2 (dvejetai)</option>
          <option value="singles">1v1 (vienetai)</option>
        </select>
      </div>

      <!-- Venue pills -->
      <div class="ml-auto flex flex-wrap gap-1.5">
        <button v-for="venue in cityVenues" :key="venue.id"
          @click="activeVenue = activeVenue === venue.id ? null : venue.id"
          :class="['rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-200',
            activeVenue === venue.id
              ? venueStyle(venue.id).activePill
              : 'border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:border-gray-300']">
          {{ venue.name }}
        </button>
      </div>

      <!-- Clear filters -->
      <button v-if="filterStart || filterType || activeVenue"
        @click="clearFilters"
        class="rounded-full border border-gray-200 px-2 py-1 text-[11px] text-gray-400 hover:text-red-500 hover:border-red-200 transition"
        title="Išvalyti filtrus">
        ✕
      </button>
    </div>

    <!-- ═══ LOADING ═══ -->
    <div v-if="pending" class="flex flex-col items-center justify-center py-24">
      <div class="relative">
        <div class="h-12 w-12 rounded-full border-[3px] border-emerald-100"></div>
        <div class="absolute inset-0 h-12 w-12 animate-spin rounded-full border-[3px] border-transparent border-t-emerald-500"></div>
      </div>
      <p class="mt-4 text-sm text-gray-400 font-medium">Ieškoma laisvų aikštelių...</p>
    </div>

    <!-- ═══ ERROR ═══ -->
    <div v-else-if="error" class="mx-auto max-w-md rounded-2xl border border-red-100 bg-red-50/50 p-8 text-center">
      <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
      </div>
      <p class="font-medium text-red-700">Klaida kraunant duomenis</p>
      <p class="mt-1 text-sm text-red-400">Patikrinkite interneto ryšį ir bandykite dar kartą</p>
      <button @click="refresh()" class="mt-4 rounded-xl bg-red-100 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-200 transition">
        Bandyti dar kartą
      </button>
    </div>

    <!-- ═══ RESULTS ═══ -->
    <div v-else>
      <!-- Summary bar -->
      <div class="mb-4 flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm">
          <span class="text-lg font-bold text-gray-900 tabular-nums">{{ totalMatchingCourts }}</span>
          <span class="text-gray-400">{{ totalMatchingCourts === 1 ? 'kortas' : 'kortai' }} su laisvomis vietomis</span>
          <span v-if="filterStart" class="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            {{ filterStart }}{{ filterEnd ? ' – ' + filterEnd : '+' }}
          </span>
          <span v-if="filterType" :class="['rounded-full px-2 py-0.5 text-[11px] font-medium',
            filterType === 'doubles' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600']">
            {{ filterType === 'doubles' ? '2v2' : '1v1' }}
          </span>
        </div>
        <button @click="refresh()" title="Atnaujinti"
          class="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition">
          <svg :class="['h-3.5 w-3.5 transition-transform', refreshing ? 'animate-spin' : '']"
            fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span v-if="data?.fromCache" class="hidden sm:inline tabular-nums">{{ data.cacheAgeSeconds }}s</span>
        </button>
      </div>

      <!-- Venue cards -->
      <div class="space-y-4">
        <article v-for="(venue, vIdx) in filteredVenues" :key="venue.id"
          class="venue-card overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-all duration-300 hover:shadow-md"
          :style="{ animationDelay: `${vIdx * 60}ms` }">

          <!-- Venue header -->
          <div class="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 sm:px-5"
            :style="{ borderLeftWidth: '4px', borderLeftColor: venueAccentColor(venue.id) }">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 truncate">{{ venue.name }}</h3>
                <span v-if="venue.error"
                  class="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">Klaida</span>
              </div>
              <p class="mt-0.5 text-xs text-gray-400 truncate">{{ venue.address }}</p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="hidden sm:flex flex-col items-end">
                <span class="text-sm font-bold tabular-nums text-gray-900">{{ venueFreeCount(venue) }}</span>
                <span class="text-[10px] text-gray-400 leading-tight">laisvi</span>
              </div>
              <a :href="venue.bookingUrl" target="_blank" rel="noopener"
                class="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow-md active:scale-[0.97]">
                Rezervuoti
                <svg class="h-3 w-3 -mr-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
              </a>
            </div>
          </div>

          <!-- Courts -->
          <div v-if="filteredCourts(venue).length > 0" class="divide-y divide-gray-50">
            <div v-for="court in filteredCourts(venue)" :key="court.id" class="px-4 py-3 sm:px-5">
              <div class="mb-2 flex items-center gap-2">
                <span class="text-sm font-medium text-gray-700">{{ court.name }}</span>
                <span :class="['rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  court.type === 'singles' ? 'bg-purple-50 text-purple-500' : 'bg-blue-50 text-blue-500']">
                  {{ court.type === 'singles' ? '1v1' : '2v2' }}
                </span>
                <span class="ml-auto text-xs tabular-nums text-gray-400">{{ courtFreeCount(court) }} laisvi</span>
              </div>

              <!-- Time slots -->
              <div class="flex flex-wrap gap-[3px]">
                <div v-for="(slot, si) in court.slots" :key="slot.time"
                  @click="slot.available ? selectSlot(slot.time) : undefined"
                  :class="[
                    'relative flex flex-col items-center justify-center rounded-lg min-w-[2.75rem] px-1 py-1.5 text-[11px] leading-tight transition-all duration-150 select-none',
                    si > 0 && slot.time.endsWith(':00') ? 'ml-0.5' : '',
                    slot.available
                      ? (slot.time === filterStart || slot.time === filterEnd
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-1 cursor-pointer scale-105 shadow-sm'
                          : isInRange(slot.time)
                            ? 'bg-emerald-500 text-white cursor-pointer'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer border border-emerald-200/60')
                      : 'bg-gray-50 text-gray-300 cursor-default'
                  ]"
                  :title="slot.available
                    ? (slot.price ? `${slot.time} — €${slot.price}/30min` : slot.time)
                    : `Užimta ${slot.time}`">
                  <!-- Now indicator dot -->
                  <div v-if="isToday && isNowSlot(slot.time, si, court.slots)"
                    class="absolute -top-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse"></div>
                  <span class="font-semibold tabular-nums">{{ slot.time }}</span>
                  <span v-if="slot.available && slot.price"
                    class="text-[9px] font-medium"
                    :class="(slot.time === filterStart || slot.time === filterEnd || isInRange(slot.time)) ? 'text-white/80' : 'text-emerald-500'">
                    €{{ slot.price }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- No matching courts -->
          <div v-else class="px-5 py-10 text-center">
            <p class="text-sm text-gray-400">{{ venue.error || 'Nėra atitinkančių kortų' }}</p>
          </div>
        </article>
      </div>

      <!-- No results at all -->
      <div v-if="filteredVenues.length === 0" class="py-20 text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <svg class="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
        </div>
        <p class="text-gray-500 font-medium">
          <span v-if="selectedCity && selectedCity !== 'Kaunas' && selectedCity !== 'Vilnius' && selectedCity !== 'Klaipėda'">
            {{ selectedCity }} mieste kortų duomenys kol kas neprieinami 🚧
          </span>
          <span v-else>Nėra laisvų kortų pagal pasirinktus filtrus</span>
        </p>
        <button @click="clearFilters"
          class="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition">
          Išvalyti filtrus
        </button>
      </div>

      <!-- Data freshness indicator -->
      <div v-if="data" class="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
        <span v-if="data.fromCache" class="flex items-center gap-1">
          Talpykla · prieš {{ data.cacheAgeSeconds }}s
        </span>
        <span v-else class="flex items-center gap-1 text-emerald-500 font-medium">
          ✓ Atnaujinta
        </span>
        <span>·</span>
        <span>{{ formatTime(data.fetchedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AvailabilityResponse, Venue, Court, City } from '~~/server/utils/types'
import { CITIES, CITY_COORDS } from '~~/server/utils/types'

const today = new Date().toISOString().split('T')[0]
const selectedDate = ref(today)
const activeVenue = ref<string | null>(null)
const filterStart = ref<string>('')
const filterEnd = ref<string>('')
const filterType = ref<'doubles' | 'singles' | null>(null)
const selectedCity = ref<City | null>('Kaunas')
const gpsState = ref<'idle' | 'loading' | 'done' | 'error'>('idle')
const refreshing = ref(false)

const isToday = computed(() => selectedDate.value === today)

// 7-day quick navigation pills
const LT_DAYS = ['Sek', 'Pir', 'Ant', 'Tre', 'Ket', 'Pen', 'Šeš']
const quickDays = computed(() => {
  const days: { date: string; label: string; day: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const label = i === 0 ? 'Šiandien' : i === 1 ? 'Rytoj' : LT_DAYS[d.getDay()]
    days.push({ date: dateStr, label, day: d.getDate() })
  }
  return days
})

// True when user picked a date beyond the 7-day quick nav
const isCustomDate = computed(() =>
  !quickDays.value.some(d => d.date === selectedDate.value)
)

// Reset end when start changes
watch(filterStart, () => { filterEnd.value = '' })
watch(selectedCity, () => { activeVenue.value = null })

const { data, pending, error, refresh: rawRefresh } = useFetch<AvailabilityResponse>('/api/availability', {
  query: { date: selectedDate },
  watch: [selectedDate],
})

async function refresh() {
  refreshing.value = true
  try { await rawRefresh() } finally { refreshing.value = false }
}

const venues = computed(() => data.value?.venues || [])

const cityVenues = computed(() =>
  selectedCity.value ? venues.value.filter(v => v.city === selectedCity.value) : venues.value
)

// All possible 30-min times across all venues
const allTimeSlots = computed(() => {
  const times = new Set<string>()
  for (const venue of venues.value)
    for (const court of venue.courts)
      for (const slot of court.slots)
        times.add(slot.time)
  return Array.from(times).sort()
})

const endTimeSlots = computed(() => {
  if (!filterStart.value) return allTimeSlots.value
  return allTimeSlots.value.filter(t => t > filterStart.value)
})

const rangeSlots = computed<Set<string>>(() => {
  if (!filterStart.value) return new Set()
  const slots = allTimeSlots.value
  if (!filterEnd.value) return new Set([filterStart.value])
  return new Set(slots.filter(t => t >= filterStart.value && t <= filterEnd.value))
})

function isInRange(time: string): boolean {
  return rangeSlots.value.has(time)
}

// "Now" indicator — returns true for the slot spanning the current time
function isNowSlot(time: string, index: number, slots: { time: string }[]): boolean {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const nowStr = `${hh}:${mm}`
  if (nowStr < time) return false
  const nextTime = index < slots.length - 1 ? slots[index + 1].time : '24:00'
  return nowStr < nextTime
}

function selectSlot(time: string) {
  if (!filterStart.value) {
    filterStart.value = time
    filterEnd.value = ''
  } else if (!filterEnd.value) {
    if (time === filterStart.value) {
      filterStart.value = ''
    } else if (time > filterStart.value) {
      filterEnd.value = time
    } else {
      filterStart.value = time
    }
  } else {
    filterStart.value = time
    filterEnd.value = ''
  }
}

function filteredCourts(venue: Venue): Court[] {
  return venue.courts.filter(court => {
    if (filterType.value && court.type !== filterType.value) return false
    if (filterStart.value) {
      const range = rangeSlots.value
      return Array.from(range).every(t => court.slots.some(s => s.time === t && s.available))
    }
    return court.slots.some(s => s.available)
  })
}

const filteredVenues = computed(() => {
  return venues.value.filter(v => {
    if (selectedCity.value && v.city !== selectedCity.value) return false
    if (activeVenue.value && v.id !== activeVenue.value) return false
    return filteredCourts(v).length > 0 || v.error
  })
})

const totalMatchingCourts = computed(() =>
  filteredVenues.value.reduce((sum, v) => sum + filteredCourts(v).length, 0)
)

function venueFreeCount(venue: Venue): number {
  return filteredCourts(venue).reduce((sum, c) => sum + courtFreeCount(c), 0)
}

function courtFreeCount(court: Court): number {
  if (filterStart.value) {
    const range = rangeSlots.value
    return Array.from(range).filter(t => court.slots.some(s => s.time === t && s.available)).length
  }
  return court.slots.filter(s => s.available).length
}

function clearFilters() {
  filterStart.value = ''
  filterEnd.value = ''
  filterType.value = null
  activeVenue.value = null
}

function detectCity() {
  if (!navigator.geolocation) { gpsState.value = 'error'; return }
  gpsState.value = 'loading'
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      let nearest: City = 'Kaunas'
      let minDist = Infinity
      for (const [city, coords] of Object.entries(CITY_COORDS) as [City, {lat:number,lng:number}][]) {
        const dist = Math.sqrt((lat - coords.lat) ** 2 + (lng - coords.lng) ** 2)
        if (dist < minDist) { minDist = dist; nearest = city }
      }
      selectedCity.value = nearest
      gpsState.value = 'done'
    },
    () => { gpsState.value = 'error' },
    { timeout: 8000 }
  )
}

// Accent colors per venue (left border + pill)
const VENUE_COLORS: Record<string, { border: string; activePill: string }> = {
  padelhub:     { border: '#3b82f6', activePill: 'border-blue-400 bg-blue-50 text-blue-700' },
  padelhouse:   { border: '#f97316', activePill: 'border-orange-400 bg-orange-50 text-orange-700' },
  tennisspace:  { border: '#22c55e', activePill: 'border-green-400 bg-green-50 text-green-700' },
  kaunopadelis: { border: '#eab308', activePill: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
  vilniuspadel: { border: '#8b5cf6', activePill: 'border-violet-400 bg-violet-50 text-violet-700' },
  zirmunai:     { border: '#14b8a6', activePill: 'border-teal-400 bg-teal-50 text-teal-700' },
  padelfactory: { border: '#f43f5e', activePill: 'border-rose-400 bg-rose-50 text-rose-700' },
  a1padel:      { border: '#06b6d4', activePill: 'border-cyan-400 bg-cyan-50 text-cyan-700' },
}

function venueAccentColor(id: string): string {
  return VENUE_COLORS[id]?.border ?? '#9ca3af'
}

function venueStyle(id: string) {
  const v = VENUE_COLORS[id]
  return { activePill: v?.activePill ?? 'border-gray-400 bg-gray-50 text-gray-700' }
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

useHead({ title: 'Žaisk Padelį — Laisvos aikštelės' })
</script>
