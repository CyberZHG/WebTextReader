const system = { lock: null, audio: null, handlers: false };

async function acquireWakeLock() {
  if (system.lock || document.hidden || !('wakeLock' in navigator)) return;
  try {
    system.lock = await navigator.wakeLock.request('screen');
    system.lock.addEventListener('release', () => { system.lock = null; });
  } catch {}
}

function releaseWakeLock() {
  system.lock?.release().catch(() => {});
  system.lock = null;
}

function silentWav(seconds = 2, rate = 8000) {
  const n = seconds * rate;
  const v = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([v.buffer], { type: 'audio/wav' }));
}

function mediaAudio() {
  if (!system.audio) {
    const a = new Audio(silentWav());
    a.loop = true;
    system.audio = a;
  }
  return system.audio;
}

const mediaOn = () => settings.mediaSession && 'mediaSession' in navigator;

function syncSystem() {
  if (navigator.audioSession) {
    try {
      navigator.audioSession.type = player.playing ? 'playback' : 'auto';
    } catch {}
  }
  if (player.playing && settings.wakeLock) acquireWakeLock();
  else releaseWakeLock();
  if (mediaOn()) {
    bindMediaSession();
    if (player.playing) mediaAudio().play().catch(() => {});
    else system.audio?.pause();
    navigator.mediaSession.playbackState = player.playing ? 'playing' : 'paused';
    updateMediaMeta();
  } else {
    system.audio?.pause();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }
}

function updateMediaMeta() {
  if (!mediaOn() || !window.MediaMetadata) return;
  const c = reader.chapters[reader.chapter];
  const source = reader.file ? reader.file.name : '粘贴的文本';
  navigator.mediaSession.metadata = new MediaMetadata({
    title: c?.heading ? c.title : source,
    artist: source,
    album: '文本朗读',
    artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
  });
}

function bindMediaSession() {
  if (system.handlers) return;
  system.handlers = true;
  const chapterOrLine = d => () => hasChapters() ? goChapter(d) : step(d);
  const actions = {
    play: () => play(),
    pause: () => pause(),
    stop: () => pause(),
    previoustrack: chapterOrLine(-1),
    nexttrack: chapterOrLine(1),
    seekbackward: () => step(-1),
    seekforward: () => step(1),
  };
  for (const [name, fn] of Object.entries(actions)) {
    try {
      navigator.mediaSession.setActionHandler(name, fn);
    } catch {}
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && player.playing && settings.wakeLock) acquireWakeLock();
});
