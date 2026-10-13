const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem('wtr.' + k);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem('wtr.' + k, JSON.stringify(v));
    } catch {}
  },
  all() {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('wtr.')) out[k.slice(4)] = JSON.parse(localStorage.getItem(k));
      }
    } catch {}
    return out;
  },
};

const db = (() => {
  let conn;
  const open = () => conn ||= new Promise((resolve, reject) => {
    const r = indexedDB.open('web-text-reader', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('meta', { keyPath: 'id' });
      r.result.createObjectStore('texts');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  const tx = async (names, mode, fn) => {
    const d = await open();
    return new Promise((resolve, reject) => {
      const t = d.transaction(names, mode);
      const req = fn(...names.map(n => t.objectStore(n)));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = t.onabort = () => reject(t.error);
    });
  };
  return {
    list: () => tx(['meta'], 'readonly', s => s.getAll()),
    putMeta: m => tx(['meta'], 'readwrite', s => s.put(m)),
    getText: id => tx(['texts'], 'readonly', s => s.get(id)),
    add: (m, text) => tx(['meta', 'texts'], 'readwrite', (ms, ts) => { ms.put(m); ts.put(text, m.id); }),
    remove: id => tx(['meta', 'texts'], 'readwrite', (ms, ts) => { ms.delete(id); ts.delete(id); }),
  };
})();

const settings = {
  theme: store.get('theme', 'dark'),
  lang: store.get('lang', 'zh-CN'),
  voices: store.get('voices', {}),
  dialogVoices: store.get('dialogVoices', {}),
  rate: store.get('rate', 1),
  pitch: store.get('pitch', 1),
  mode: store.get('mode', 'file'),
  gap: store.get('gap', 3),
  timer: store.get('timer', 0),
  chapterLimit: store.get('chapterLimit', 0),
  fontSize: store.get('fontSize', 18),
  lineHeight: store.get('lineHeight', 1.8),
  pageWidth: store.get('pageWidth', 880),
  follow: store.get('follow', true),
  wakeLock: store.get('wakeLock', true),
  mediaSession: store.get('mediaSession', false),
  cps: store.get('cps', 4.5),
  rules: store.get('rules', { skip: '', replace: '' }),
};

const setSetting = (key, value) => {
  settings[key] = value;
  store.set(key, value);
};

const reader = { kind: null, lines: [], chapters: [], pos: 0, chapter: -1, file: null, skip: new Uint8Array(0), prefix: new Float64Array(1) };
const player = { session: 0, playing: false, voice: null, deadline: 0, chaptersLeft: 0, waitUntil: 0, notice: '' };
const synth = window.speechSynthesis;
const IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const MINUTE = 60000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtNum = n => Math.floor(n).toLocaleString('zh-CN');
const fmtDur = ms => {
  const m = Math.floor(ms / MINUTE);
  const h = Math.floor(m / 60);
  return h ? `${fmtNum(h)} 小时 ${m % 60} 分` : `${m} 分钟`;
};
const clock = ms => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = String(Math.floor(t / 60) % 60).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${m}:${pad(t % 60)}` : `${m}:${pad(t % 60)}`;
};

function bindRange(id, key, fmt, onChange) {
  const input = $('#' + id);
  const out = $('#' + id + 'Out');
  input.value = settings[key];
  out.textContent = fmt(settings[key]);
  input.oninput = () => {
    setSetting(key, Number(input.value));
    out.textContent = fmt(settings[key]);
    onChange?.();
  };
}

function bindCheck(id, key, onChange) {
  const input = $('#' + id);
  input.checked = settings[key];
  input.onchange = () => {
    setSetting(key, input.checked);
    onChange?.();
  };
}

function bindFolds() {
  $$('details[data-fold]').forEach(d => {
    const key = 'fold.' + d.dataset.fold;
    d.open = store.get(key, false);
    d.ontoggle = () => store.set(key, d.open);
  });
}

const pages = {};
let pageOpenedHere = false;

function openPage(name) {
  if (location.hash === '#' + name) return;
  if (document.body.classList.contains('page-open')) {
    location.replace('#' + name);
  } else {
    pageOpenedHere = true;
    location.hash = name;
  }
}

function closePage() {
  if (pageOpenedHere) {
    history.back();
  } else {
    history.replaceState(null, '', location.pathname + location.search);
    route();
  }
}

function route() {
  const name = location.hash.slice(1);
  let shown = false;
  for (const [key, page] of Object.entries(pages)) {
    const on = key === name;
    $(page.el).hidden = !on;
    if (on) {
      shown = true;
      page.render?.(true);
    }
  }
  if (!shown) pageOpenedHere = false;
  document.body.classList.toggle('page-open', shown);
}

const pageVisible = name => pages[name] && !$(pages[name].el).hidden;

addEventListener('hashchange', route);
addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.body.classList.contains('page-open') && !document.querySelector('dialog[open]')) closePage();
});
document.addEventListener('click', e => {
  const open = e.target.closest('[data-page]');
  if (open) openPage(open.dataset.page);
  else if (e.target.closest('[data-close]')) closePage();
});
