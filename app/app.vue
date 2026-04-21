<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur">
      <div class="mx-auto max-w-7xl px-4 py-3 sm:px-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <!-- Padel racket SVG icon -->
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 80" class="h-9 w-7 shrink-0" aria-hidden="true">
              <ellipse cx="32" cy="28" rx="22" ry="24" fill="#16a34a"/>
              <ellipse cx="32" cy="28" rx="17" ry="19" fill="#22c55e"/>
              <circle cx="26" cy="22" r="2.2" fill="#16a34a"/>
              <circle cx="32" cy="22" r="2.2" fill="#16a34a"/>
              <circle cx="38" cy="22" r="2.2" fill="#16a34a"/>
              <circle cx="23" cy="29" r="2.2" fill="#16a34a"/>
              <circle cx="30" cy="29" r="2.2" fill="#16a34a"/>
              <circle cx="37" cy="29" r="2.2" fill="#16a34a"/>
              <circle cx="26" cy="36" r="2.2" fill="#16a34a"/>
              <circle cx="32" cy="36" r="2.2" fill="#16a34a"/>
              <circle cx="38" cy="36" r="2.2" fill="#16a34a"/>
              <path d="M26 50 Q32 44 38 50 L36 52 Q32 47 28 52 Z" fill="#15803d"/>
              <rect x="28" y="50" width="8" height="24" rx="4" fill="#15803d"/>
              <line x1="28" y1="57" x2="36" y2="57" stroke="#bbf7d0" stroke-width="1.2" stroke-linecap="round"/>
              <line x1="28" y1="62" x2="36" y2="62" stroke="#bbf7d0" stroke-width="1.2" stroke-linecap="round"/>
              <line x1="28" y1="67" x2="36" y2="67" stroke="#bbf7d0" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <h1 class="text-lg font-semibold text-gray-900">Žaisk Padelį</h1>
          </div>
          <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600 font-medium">beta</span>
        </div>
      </div>
    </header>

    <main>
      <NuxtPage />
    </main>
  </div>
</template>
