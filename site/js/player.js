const QUOTE = /(“[^”]*”?|「[^」]*」?|『[^』]*』?|"[^"]*"?)/;
const speakable = t => /[\p{L}\p{N}]/u.test(t);

function chunk(text, max = 80) {
  const out = [];
  let cur = '';
  for (let p of text.split(/(?<=[。！？!?；;…，,、：:\s])/)) {
    while (p.length > max) {
      if (cur) { out.push(cur); cur = ''; }
      out.push(p.slice(0, max));
      p = p.slice(max);
    }
    if (cur.length + p.length > max) { out.push(cur); cur = p; } else cur += p;
  }
  if (cur) out.push(cur);
  return out;
}

function segments(text) {
  const dv = dialogueVoice();
  const pieces = dv ? text.split(QUOTE).map((t, k) => [t, k % 2 ? dv : null]) : [[text, null]];
  return pieces.flatMap(([t, voice]) => chunk(t).filter(speakable).map(c => ({ text: c, voice })));
}

function learnSpeed(chars, ms) {
  if (ms < 1500 || chars < 4) return;
  const sample = chars / (ms / 1000) / settings.rate;
  if (sample < 0.5 || sample > 40) return;
  setSetting('cps', settings.cps * 0.9 + sample * 0.1);
}

function updatePlayBtn() {
  const btn = $('#playBtn');
  const tip = player.playing ? '暂停（空格）' : '播放（空格）';
  btn.innerHTML = player.playing ? ICONS.pause : ICONS.play;
  btn.dataset.tip = tip;
  btn.setAttribute('aria-label', tip);
}

function play(how = 'follow') {
  if (!synth || !reader.lines.length) return;
  player.playing = true;
  player.notice = '';
  player.waitUntil = 0;
  player.deadline = settings.timer ? Date.now() + settings.timer * MINUTE : 0;
  player.chaptersLeft = hasChapters() ? settings.chapterLimit : 0;
  updatePlayBtn();
  Achv.playStart();
  syncSystem();
  speakAt(reader.pos, how);
}

function pause() {
  player.session++;
  player.playing = false;
  player.waitUntil = 0;
  if (synth && (synth.speaking || synth.pending)) synth.cancel();
  updatePlayBtn();
  updateStatus();
  syncSystem();
}

function stopAt(i, notice) {
  pause();
  player.notice = notice;
  setPos(i);
}

function advance(i) {
  const s = player.session;
  const next = i + 1;
  const chapterEnd = isChapterEnd(i);
  if (next >= reader.lines.length) {
    pause();
    player.notice = '已读完';
    updateStatus();
    return;
  }
  if (chapterEnd && player.chaptersLeft > 0 && --player.chaptersLeft === 0) {
    stopAt(next, '已听完设定的章节数');
    return;
  }
  if (player.deadline && Date.now() >= player.deadline) {
    stopAt(next, '定时已到');
    Achv.timerStopped();
    return;
  }
  const gap = settings.gap * 1000;
  if (chapterEnd && gap > 0) {
    player.waitUntil = Date.now() + gap;
    setPos(next);
    setTimeout(() => {
      if (s !== player.session) return;
      player.waitUntil = 0;
      speakAt(next);
    }, gap);
    return;
  }
  speakAt(next);
}

function speakAt(i, how = 'follow') {
  const s = ++player.session;
  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();
  const n = reader.lines.length;
  while (i < n - 1 && reader.skip[i] && !isChapterEnd(i)) i++;
  if (i >= n) {
    pause();
    return;
  }
  setPos(i, how);
  const line = reader.lines[i];
  const parts = reader.skip[i] ? [] : segments(speechOf(line));
  if (!parts.length) {
    setTimeout(() => s === player.session && advance(i), 50);
    return;
  }
  const voice = currentVoice();
  let k = 0;
  let started = 0;
  const next = () => {
    if (s !== player.session) return;
    if (k >= parts.length) {
      if (started) learnSpeed(parts.reduce((sum, p) => sum + charCount(p.text), 0), performance.now() - started);
      Achv.lineDone({
        text: line,
        rate: settings.rate,
        kind: reader.kind,
        file: reader.file,
        bookEnd: i === n - 1,
        chapterEnd: isChapterEnd(i),
      });
      advance(i);
      return;
    }
    const part = parts[k++];
    const v = part.voice || voice;
    const u = new SpeechSynthesisUtterance(part.text);
    u.lang = v?.lang || settings.lang;
    if (v) u.voice = v;
    u.rate = settings.rate;
    u.pitch = settings.pitch;
    u.onstart = () => { started ||= performance.now(); };
    u.onend = next;
    u.onerror = e => {
      if (s !== player.session || e.error === 'interrupted' || e.error === 'canceled') return;
      stopAt(i, `朗读出错（${e.error || '未知错误'}），请尝试更换语音`);
    };
    player.voice = v;
    synth.speak(u);
  };
  if (busy) setTimeout(next, 60); else next();
}

function goTo(i) {
  if (!reader.lines.length) return;
  i = Math.max(0, Math.min(i, reader.lines.length - 1));
  if (player.playing) speakAt(i, 'jump'); else setPos(i, 'jump');
}

function step(d) {
  let i = reader.pos + d;
  while (i > 0 && i < reader.lines.length - 1 && reader.skip[i]) i += d;
  goTo(i);
}

function goChapter(d) {
  const c = Math.max(0, Math.min(chapterAt(reader.pos) + d, reader.chapters.length - 1));
  goTo(reader.chapters[c].start);
}

$('#playBtn').onclick = () => player.playing ? pause() : play();
$('#prevLine').onclick = () => step(-1);
$('#nextLine').onclick = () => step(1);
$('#prevCh').onclick = () => goChapter(-1);
$('#nextCh').onclick = () => goChapter(1);
$('#chapterSel').onchange = e => goTo(reader.chapters[Number(e.target.value)].start);

$('#reader').onclick = e => {
  const p = e.target.closest('.line');
  if (!p || getSelection().toString()) return;
  const i = Number(p.dataset.i);
  follow.hold = false;
  if (player.playing) {
    speakAt(i, 'none');
  } else {
    setPos(i, 'none');
    play('none');
  }
};

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest('input, textarea, select, dialog')) return;
  if (document.body.classList.contains('page-open')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    player.playing ? pause() : play();
  } else if (e.key === 'ArrowLeft') {
    step(-1);
  } else if (e.key === 'ArrowRight') {
    step(1);
  } else if (e.key === 'b' || e.key === 'B') {
    toggleBookmark();
  } else if (e.key === '/') {
    e.preventDefault();
    focusSearch();
  }
});

setInterval(() => {
  if (!MOBILE && synth && player.playing && synth.speaking && !synth.paused && player.voice && !player.voice.localService) {
    synth.pause();
    synth.resume();
  }
}, 10000);
