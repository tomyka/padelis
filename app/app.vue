<template>
  <div class="min-h-screen bg-gray-50/80 flex flex-col">
    <!-- Accent gradient bar -->
    <div class="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 shrink-0"></div>

    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-gray-200/60 bg-white/90 shadow-sm backdrop-blur-xl shrink-0">
      <div class="mx-auto max-w-6xl px-4 sm:px-6">
        <div class="flex h-14 items-center justify-between">
          <a href="/" class="flex items-center gap-2.5 group select-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" class="h-7 w-5 shrink-0 transition-transform duration-300 group-hover:rotate-[-8deg]" aria-hidden="true">
              <ellipse cx="12" cy="10.5" rx="9" ry="10" fill="#16a34a"/>
              <ellipse cx="12" cy="10.5" rx="7" ry="7.8" fill="#22c55e"/>
              <circle cx="9.5" cy="8" r="1" fill="#16a34a"/><circle cx="12" cy="8" r="1" fill="#16a34a"/><circle cx="14.5" cy="8" r="1" fill="#16a34a"/>
              <circle cx="9.5" cy="11" r="1" fill="#16a34a"/><circle cx="12" cy="11" r="1" fill="#16a34a"/><circle cx="14.5" cy="11" r="1" fill="#16a34a"/>
              <circle cx="9.5" cy="14" r="1" fill="#16a34a"/><circle cx="12" cy="14" r="1" fill="#16a34a"/><circle cx="14.5" cy="14" r="1" fill="#16a34a"/>
              <rect x="10.5" y="19" width="3" height="10" rx="1.5" fill="#15803d"/>
              <line x1="10.5" y1="22" x2="13.5" y2="22" stroke="#bbf7d0" stroke-width="0.6"/><line x1="10.5" y1="25" x2="13.5" y2="25" stroke="#bbf7d0" stroke-width="0.6"/>
            </svg>
            <span class="text-lg font-bold tracking-tight text-gray-900">
              Žaisk <span class="text-emerald-600">Padelį</span>
            </span>
          </a>
        </div>
      </div>
    </header>

    <main class="flex-1">
      <NuxtPage />
    </main>

    <!-- Footer -->
    <footer class="border-t border-gray-200/50 bg-white/50 py-5 shrink-0">
      <div class="mx-auto max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-gray-400">
        <span>© {{ new Date().getFullYear() }} Žaisk Padelį</span>
        <a href="https://buymeacoffee.com/zaiskpadeli" target="_blank" rel="noopener"
          class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/60 px-3 py-1.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition">
          <span class="text-base leading-none">☕</span>
          Paremk projektą
        </a>
        <span>Duomenys atnaujinami kas 5 min · Kaina už 30 min</span>
      </div>
    </footer>
  </div>
</template>
