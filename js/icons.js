const svg = body => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
  prevCh: svg('<path d="M6 5v14"/><path d="M18 6v12l-9-6z" fill="currentColor"/>'),
  prevLine: svg('<path d="M15 6l-6 6 6 6"/>'),
  play: svg('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  pause: svg('<path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="3"/>'),
  nextLine: svg('<path d="M9 6l6 6-6 6"/>'),
  nextCh: svg('<path d="M18 5v14"/><path d="M6 6v12l9-6z" fill="currentColor"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  trophy: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v3M8 20h8l-1-3H9z"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  sliders: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  share: svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  shield: svg('<path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z"/><path d="M9 12l2 2 4-4"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  lines: svg('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  text: svg('<path d="M5 6V5h14v1M12 5v14M9 19h6"/>'),
  bookmark: svg('<path d="M6 4h12v16l-6-4-6 4z"/>'),
  book: svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  calendar: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  flame: svg('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-1 1-5 1-9z"/>'),
  hourglass: svg('<path d="M6 3h12M6 21h12M7 3v2c0 3 5 5 5 7s-5 4-5 7v2M17 3v2c0 3-5 5-5 7s5 4 5 7v2"/>'),
  alarm: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3 2 6M19 3l3 3"/>'),
  bolt: svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  clipboard: svg('<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>'),
};

function applyIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(e => { e.innerHTML = ICONS[e.dataset.icon]; });
}
