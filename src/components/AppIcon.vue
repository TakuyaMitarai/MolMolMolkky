<script setup>
// Line icons drawn on a 24px grid (stroke = currentColor). These replace the
// emoji the app used to rely on, so every glyph shares one weight and colour.
defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 22 },
})

const paths = {
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  up: 'M5 15l7-7 7 7',
  down: 'M5 9l7 7 7-7',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  trash: 'M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5',
  undo: 'M8.5 5.5L4 10l4.5 4.5M4 10h10a5 5 0 010 10h-3',
  shuffle:
    'M3 7h3.2c2.4 0 3.7 1.1 4.9 3.1l1.8 3.8c1.2 2 2.5 3.1 4.9 3.1H21M3 17h3.2c1.5 0 2.6-.4 3.5-1.3M21 7h-3.2c-1.5 0-2.6.4-3.5 1.3M18 4l3 3-3 3M18 14l3 3-3 3',
  swap: 'M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4',
  user: 'M12 11.5a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c0-3.5 3.3-6 7.5-6s7.5 2.5 7.5 6',
  users:
    'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c0-3.2 2.9-5.5 6.5-5.5s6.5 2.3 6.5 5.5M16 4.3a3.5 3.5 0 010 6.4M18 14.9c2.1.7 3.5 2.5 3.5 5.1',
  pencil: 'M4 20l1-4.5L16.5 4a2.1 2.1 0 013 0l.5.5a2.1 2.1 0 010 3L8.5 19 4 20zM14.5 6l3.5 3.5',
  chart: 'M5 20v-8M11 20V5M17 20v-5M3 20h18',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4.5v5M9 14.5v5',
  download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14',
  upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14',
  home: 'M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5.5h4V20',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9zM12 12.6a.6.6 0 100-1.2.6.6 0 000 1.2z',
  trophy:
    'M8 4h8v5.5a4 4 0 01-8 0V4zM8 6H4.5c0 2.3 1.4 4 3.6 4.3M16 6h3.5c0 2.3-1.4 4-3.6 4.3M12 13.5v3.5M8.5 20h7M10 17h4',
  play: 'M8 5.5v13l10.5-6.5L8 5.5z',
  reset: 'M4 4.5V9h4.5M4.4 9A8 8 0 1112 20a8 8 0 01-7-4.1',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.6v.2',
}
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="paths[name]" />
  </svg>
</template>
