<template>
  <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">

    <!-- Top bar: date + filters -->
    <div class="mb-5 flex flex-col gap-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-xl font-bold text-gray-900 sm:text-2xl">Laisvos aikštelės</h2>
          <p class="mt-0.5 text-sm text-gray-500">Padelio kortai vienoje vietoje</p>
        </div>
        <!-- Date picker -->
        <div class="flex items-center gap-2">
          <button @click="changeDate(-1)" :disabled="isToday"
            class="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:opacity-30">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <input type="date" v-model="selectedDate" :min="today"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          <button @click="changeDate(1)"
            class="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
          <button v-if="!isToday" @click="selectedDate = today"
            class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-600 shadow-sm hover:bg-gray-50">
            Šiandien
          </button>
        </div>
      </div>

      <!-- City filter -->
      <div class="flex items-center gap-2">
        <svg class="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
        </svg>
        <div class="flex flex-wrap gap-1.5">
          <button v-for="city in CITIES" :key="city" @click="selectedCity = selectedCity === city ? null : city"
            :class="['rounded-full px-3 py-1 text-xs font-medium border transition',
              selectedCity === city
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-700']">
            {{ city }}
            <span v-if="city !== 'Kaunas' && city !== 'Vilnius' && city !== 'Klaipėda'" class="ml-1 opacity-50 text-[9px]">snart</span>
          </button>
        </div>
        <button v-if="gpsState === 'idle'" @click="detectCity"
          class="ml-auto flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 shadow-sm hover:bg-gray-50 shrink-0">
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
          </svg>
          Mano vieta
        </button>
        <span v-else-if="gpsState === 'loading'" class="ml-auto text-xs text-gray-400 flex items-center gap-1">
          <svg class="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
          Nustatoma...
        </span>
        <span v-else-if="gpsState === 'done'" class="ml-auto text-xs text-emerald-600">📍 {{ selectedCity ?? 'Visi miestai' }}</span>
        <span v-else-if="gpsState === 'error'" class="ml-auto text-xs text-red-400">GPS neprieinamas</span>
      </div>

      <!-- Filter row -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- Time interval filter -->
        <div class="flex items-center gap-1.5">
          <svg class="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <select v-model="filterStart"
            class="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="">Nuo</option>
            <option v-for="t in allTimeSlots" :key="t" :value="t">{{ t }}</option>
          </select>
          <span class="text-gray-400 text-sm">–</span>
          <select v-model="filterEnd" :disabled="!filterStart"
            class="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-40">
            <option value="">Iki</option>
            <option v-for="t in endTimeSlots" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <!-- Court type dropdown -->
        <div class="flex items-center gap-1.5">
          <svg class="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
          </svg>
          <select v-model="filterType"
            class="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option :value="null">Visi kortai</option>
            <option value="doubles">2v2 (dvejetai)</option>
            <option value="singles">1v1 (vienetai)</option>
          </select>
        </div>

        <!-- Venue pills -->
        <div class="ml-auto flex flex-wrap gap-1.5">
          <button v-for="venue in cityVenues" :key="venue.id"
            @click="activeVenue = activeVenue === venue.id ? null : venue.id"
            :class="['rounded-full border px-3 py-1 text-xs font-medium transition',
              activeVenue === venue.id
                ? venueStyle(venue.id).activePill
                : 'border-gray-300 bg-white text-gray-500 hover:text-gray-700']">
            {{ venue.name }}
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="flex flex-col items-center justify-center py-20">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-emerald-500"></div>
      <p class="mt-3 text-sm text-gray-400">Kraunama...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p class="text-red-600">Klaida kraunant duomenis</p>
      <button @click="refresh()" class="mt-3 rounded-lg bg-red-100 px-4 py-2 text-sm text-red-700 hover:bg-red-200">
        Bandyti dar kartą
      </button>
    </div>

    <!-- Results -->
    <div v-else>
      <!-- Summary bar -->
      <div class="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <span class="font-medium text-gray-900">{{ totalMatchingCourts }}</span> kortai su laisvomis vietomis
        <span v-if="filterStart || filterType" class="text-gray-400">—</span>
        <span v-if="filterStart" class="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
          {{ filterStart }}{{ filterEnd ? ' – ' + filterEnd : '' }}
        </span>
        <span v-if="filterType" :class="['rounded-full px-2 py-0.5 text-xs', filterType === 'doubles' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700']">
          {{ filterType === 'doubles' ? '2v2' : '1v1' }}
        </span>
      </div>

      <div class="space-y-5">
        <div v-for="venue in filteredVenues" :key="venue.id"
          class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

          <!-- Venue header -->
          <div :class="['flex items-center justify-between px-4 py-3 sm:px-5', venueStyle(venue.id).headerBg]">
            <div class="flex items-center gap-3">
              <div :class="['flex h-9 w-9 items-center justify-center rounded-lg text-lg', venueStyle(venue.id).iconBg]">
                {{ venueStyle(venue.id).emoji }}
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">{{ venue.name }}</h3>
                <p class="text-xs text-gray-500">{{ venue.address }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="venue.error" class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-600">Klaida</span>
              <span class="text-xs text-gray-400">{{ venueFreeCount(venue) }} laisvi slotai</span>
              <a :href="venue.bookingUrl" target="_blank"
                class="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-600">
                Rezervuoti →
              </a>
            </div>
          </div>

          <!-- Courts -->
          <div v-if="filteredCourts(venue).length > 0" class="divide-y divide-gray-100">
            <div v-for="court in filteredCourts(venue)" :key="court.id" class="px-4 py-3 sm:px-5">
              <div class="mb-2 flex items-center gap-2">
                <span class="text-sm font-medium text-gray-800">{{ court.name }}</span>
                <span :class="['rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  court.type === 'singles' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600']">
                  {{ court.type === 'singles' ? '1v1' : '2v2' }}
                </span>
                <span class="ml-auto text-xs text-gray-400">{{ courtFreeCount(court) }} laisvi</span>
              </div>

              <!-- Time slots -->
              <div class="flex flex-wrap gap-1">
                <div v-for="slot in court.slots" :key="slot.time"
                  @click="slot.available ? selectSlot(slot.time) : null"
                  :class="['flex flex-col items-center rounded-md px-1.5 py-1 text-[11px] leading-tight transition select-none',
                    slot.available
                      ? (slot.time === filterStart || slot.time === filterEnd
                          ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 cursor-pointer scale-105'
                          : isInRange(slot.time)
                            ? 'bg-emerald-500 text-white ring-1 ring-emerald-300 cursor-pointer'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 cursor-pointer')
                      : 'bg-gray-100 text-gray-300 cursor-default']"
                  :title="slot.available
                    ? (slot.time === filterStart ? 'Pradžia' : slot.time === filterEnd ? 'Pabaiga' : `Pasirinkti ${slot.time}`) + (slot.price ? ` — €${slot.price}` : '')
                    : `Užimta ${slot.time}`">
                  <span class="font-medium">{{ slot.time }}</span>
                  <span v-if="slot.available && slot.price" class="text-[9px] opacity-75">€{{ slot.price }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- No matching courts -->
          <div v-else class="px-4 py-8 text-center text-sm text-gray-400">
            {{ venue.error || 'Nėra atitinkančių kortų' }}
          </div>
        </div>

        <!-- No results at all -->
        <div v-if="filteredVenues.length === 0" class="py-16 text-center">
          <p class="text-gray-500">
            <span v-if="selectedCity && selectedCity !== 'Kaunas' && selectedCity !== 'Vilnius' && selectedCity !== 'Klaipėda'">{{ selectedCity }} mieste kortų duomenys kol kas neprieinami 🚧</span>
            <span v-else>Nėra laisvų kortų pagal pasirinktus filtrus</span>
          </p>
          <button @click="clearFilters" class="mt-3 text-sm text-emerald-600 hover:underline">Išvalyti filtrus</button>
        </div>

        <div v-if="data" class="pb-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <span v-if="data.fromCache" class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Talpykla · prieš {{ data.cacheAgeSeconds }}s
          </span>
          <span v-else class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-600">
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Atnaujinta dabar
          </span>
          <span>{{ formatTime(data.fetchedAt) }}</span>
          <button @click="refresh()" title="Atnaujinti" class="rounded-full p-1 hover:bg-gray-100 transition">
            <svg class="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
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

const isToday = computed(() => selectedDate.value === today)

// Reset end when start changes (avoid invalid range)
watch(filterStart, () => { filterEnd.value = '' })

watch(selectedCity, () => { activeVenue.value = null })

function changeDate(delta: number) {
  const d = new Date(selectedDate.value)
  d.setDate(d.getDate() + delta)
  const str = d.toISOString().split('T')[0]
  if (str >= today) selectedDate.value = str
}

const { data, pending, error, refresh } = useFetch<AvailabilityResponse>('/api/availability', {
  query: { date: selectedDate },
  watch: [selectedDate],
})

const venues = computed(() => data.value?.venues || [])

// Venues for the currently selected city
const cityVenues = computed(() =>
  selectedCity.value ? venues.value.filter(v => v.city === selectedCity.value) : venues.value
)

// All possible 30-min times across all venues
const allTimeSlots = computed(() => {
  const times = new Set<string>()
  for (const venue of venues.value) {
    for (const court of venue.courts) {
      for (const slot of court.slots) {
        times.add(slot.time)
      }
    }
  }
  return Array.from(times).sort()
})

// End time options: only times strictly after filterStart
const endTimeSlots = computed(() => {
  if (!filterStart.value) return allTimeSlots.value
  return allTimeSlots.value.filter(t => t > filterStart.value)
})

// Slots in the selected range [start, end] inclusive
const rangeSlots = computed<Set<string>>(() => {
  if (!filterStart.value) return new Set()
  const slots = allTimeSlots.value
  if (!filterEnd.value) return new Set([filterStart.value])
  return new Set(slots.filter(t => t >= filterStart.value && t <= filterEnd.value))
})

function isInRange(time: string): boolean {
  return rangeSlots.value.has(time)
}

// Click a slot to set start/end filter
function selectSlot(time: string) {
  if (!filterStart.value) {
    // Nothing selected yet → set start
    filterStart.value = time
    filterEnd.value = ''
  } else if (!filterEnd.value) {
    if (time === filterStart.value) {
      // Click same slot → clear
      filterStart.value = ''
    } else if (time > filterStart.value) {
      // Click after start → set end
      filterEnd.value = time
    } else {
      // Click before start → reset start to this slot
      filterStart.value = time
    }
  } else {
    // Range already set → start fresh from this slot
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
      // Find nearest city using Euclidean distance on lat/lng
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

function venueStyle(id: string) {
  const styles: Record<string, { emoji: string; iconBg: string; headerBg: string; activePill: string }> = {
    padelhub:     { emoji: '🏟️', iconBg: 'bg-blue-50',    headerBg: 'bg-blue-50/50 border-b border-blue-100',       activePill: 'border-blue-400 bg-blue-50 text-blue-700' },
    padelhouse:   { emoji: '🏠', iconBg: 'bg-orange-50',  headerBg: 'bg-orange-50/50 border-b border-orange-100',   activePill: 'border-orange-400 bg-orange-50 text-orange-700' },
    tennisspace:  { emoji: '🎾', iconBg: 'bg-green-50',   headerBg: 'bg-green-50/50 border-b border-green-100',     activePill: 'border-green-400 bg-green-50 text-green-700' },
    kaunopadelis: { emoji: '🏆', iconBg: 'bg-yellow-50',  headerBg: 'bg-yellow-50/50 border-b border-yellow-100',   activePill: 'border-yellow-400 bg-yellow-50 text-yellow-700' },
    vilniuspadel: { emoji: '⭐', iconBg: 'bg-violet-50',  headerBg: 'bg-violet-50/50 border-b border-violet-100',   activePill: 'border-violet-400 bg-violet-50 text-violet-700' },
    zirmunai:     { emoji: '🌿', iconBg: 'bg-teal-50',    headerBg: 'bg-teal-50/50 border-b border-teal-100',       activePill: 'border-teal-400 bg-teal-50 text-teal-700' },
    padelfactory: { emoji: '🏭', iconBg: 'bg-rose-50',    headerBg: 'bg-rose-50/50 border-b border-rose-100',       activePill: 'border-rose-400 bg-rose-50 text-rose-700' },
    a1padel:      { emoji: '🏖️', iconBg: 'bg-cyan-50',    headerBg: 'bg-cyan-50/50 border-b border-cyan-100',       activePill: 'border-cyan-400 bg-cyan-50 text-cyan-700' },
  }
  return styles[id] || { emoji: '📍', iconBg: 'bg-gray-100', headerBg: 'bg-gray-50 border-b border-gray-100', activePill: 'border-gray-400 bg-gray-50 text-gray-700' }
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('lt-LT', { hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

useHead({ title: 'Žaisk Padelį — Laisvos aikštelės' })
</script>
