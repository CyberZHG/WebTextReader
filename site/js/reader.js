const SEG = 200;
const MAX_TITLE = 60;
const follow = { hold: false };

function buildChapters(lines, re) {
  const marks = [];
  if (re) lines.forEach((l, i) => { if (l.length <= MAX_TITLE && re.test(l)) marks.push(i); });
  const chapters = [];
  if (!marks.length) {
    for (let s = 0, n = 1; s < lines.length; s += SEG, n++) {
      chapters.push({ title: `第 ${n} 段`, start: s, end: Math.min(s + SEG, lines.length) });
    }
    if (!chapters.length) chapters.push({ title: '全文', start: 0, end: 0 });
    return chapters;
  }
  if (marks[0] > 0) chapters.push({ title: '开头', start: 0, end: marks[0] });
  marks.forEach((m, k) => chapters.push({
    title: lines[m],
    start: m,
    end: k + 1 < marks.length ? marks[k + 1] : lines.length,
    heading: true,
  }));
  return chapters;
}

function chapterAt(pos) {
  const ch = reader.chapters;
  let lo = 0, hi = ch.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ch[mid].start <= pos) lo = mid; else hi = mid - 1;
  }
  return lo;
}

const hasChapters = () => reader.kind === 'file' && reader.chapters.length > 1;
const isChapterEnd = i => hasChapters() && i === reader.chapters[chapterAt(i)].end - 1;

function fillChapters() {
  const sel = $('#chapterSel');
  sel.replaceChildren(...reader.chapters.map((c, i) => new Option(c.title.length > 40 ? c.title.slice(0, 40) + '…' : c.title, i)));
  const multi = reader.chapters.length > 1;
  sel.hidden = !multi;
  $('#prevCh').hidden = !multi;
  $('#nextCh').hidden = !multi;
}

function renderChapter(c) {
  const box = $('#reader');
  reader.chapter = c;
  if (!reader.lines.length) {
    box.replaceChildren(el('p', 'empty', reader.kind === 'file' ? '请上传或选择一个文本文件' : '请输入文本后点击“载入并朗读”'));
    return;
  }
  const { start, end } = reader.chapters[c];
  const frag = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    const p = el('p', 'line', reader.lines[i]);
    p.dataset.i = i;
    frag.append(p);
  }
  box.replaceChildren(frag);
  decorate();
  $('#chapterSel').value = c;
}

function decorate() {
  const c = reader.chapters[reader.chapter];
  if (!c || !reader.lines.length) return;
  const marks = bookmarkSet();
  [...$('#reader').children].forEach((p, k) => {
    const i = c.start + k;
    p.classList.toggle('title', k === 0 && !!c.heading);
    p.classList.toggle('skipped', !!reader.skip[i]);
    p.classList.toggle('marked', marks.has(i));
    p.classList.toggle('active', i === reader.pos);
  });
}

const activeLine = () => $('#reader .line.active');

function inView(e) {
  const r = e.getBoundingClientRect();
  return r.bottom > 60 && r.top < innerHeight - $('.controls').offsetHeight;
}

function updateFollowBtn() {
  const a = activeLine();
  $('#followBtn').hidden = !a || inView(a) || document.body.classList.contains('page-open');
}

function setPos(i, how = 'follow') {
  reader.pos = Math.max(0, Math.min(i, reader.lines.length - 1));
  const c = chapterAt(reader.pos);
  const changed = c !== reader.chapter;
  if (changed) {
    renderChapter(c);
    updateMediaMeta();
  }
  const box = $('#reader');
  box.querySelector('.line.active')?.classList.remove('active');
  const p = box.children[reader.pos - reader.chapters[c].start];
  if (how === 'jump') follow.hold = false;
  if (p?.classList.contains('line')) {
    p.classList.add('active');
    if (how === 'jump' || (how === 'follow' && settings.follow && !follow.hold)) {
      p.scrollIntoView({ block: 'center', behavior: changed ? 'auto' : 'smooth' });
    }
  }
  updateFollowBtn();
  updateStatus();
  syncBookmarkBtn();
  saveProgress();
}

function fmtLeft(ms) {
  if (ms < MINUTE) return '不到 1 分钟';
  return fmtDur(ms);
}

function updateStatus() {
  const n = reader.lines.length;
  if (!n) {
    $('#status').textContent = '';
    return;
  }
  const parts = [];
  const c = reader.chapters[reader.chapter];
  const speed = settings.cps * settings.rate / 1000;
  const p = reader.prefix;
  if (reader.file) parts.push(reader.file.name);
  if (reader.chapters.length > 1) parts.push(`章节 ${reader.chapter + 1}/${reader.chapters.length}`);
  parts.push(`行 ${reader.pos + 1}/${n}`);
  parts.push(`${((reader.pos + 1) / n * 100).toFixed(1)}%`);
  if (c && reader.chapters.length > 1) parts.push(`本章约 ${fmtLeft((p[c.end] - p[reader.pos]) / speed)}`);
  parts.push(`${reader.kind === 'file' ? '全书' : '全文'}约 ${fmtLeft((p[n] - p[reader.pos]) / speed)}`);
  if (player.playing) {
    const now = Date.now();
    if (player.waitUntil > now) parts.push(`${Math.ceil((player.waitUntil - now) / 1000)} 秒后开始下一章`);
    if (player.deadline) parts.push(`定时剩余 ${clock(player.deadline - now)}`);
    if (player.chaptersLeft > 0) parts.push(`还剩 ${player.chaptersLeft} 章`);
  } else if (player.notice) {
    parts.push(player.notice);
  }
  $('#status').textContent = parts.join(' · ');
}

function saveProgress() {
  if (!reader.lines.length) return;
  if (reader.kind === 'text') {
    store.set('textPos', reader.pos);
  } else if (reader.file) {
    reader.file.pos = reader.pos;
    reader.file.updatedAt = Date.now();
    db.putMeta(reader.file).catch(() => {});
  }
}

function loadReader(kind, lines, chapters, pos, file = null) {
  pause();
  Object.assign(reader, { kind, lines, chapters, file, chapter: -1 });
  analyze();
  fillChapters();
  if (lines.length) {
    setPos(pos, 'jump');
  } else {
    renderChapter(0);
    updateStatus();
  }
  updateMediaMeta();
  renderBookmarks();
  clearSearch();
}

function holdFollow() {
  if (player.playing && !document.body.classList.contains('page-open')) follow.hold = true;
}

['wheel', 'touchmove'].forEach(t => addEventListener(t, holdFollow, { passive: true }));
addEventListener('keydown', e => {
  if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key)) holdFollow();
});

let followFrame = 0;
addEventListener('scroll', () => {
  followFrame ||= requestAnimationFrame(() => {
    followFrame = 0;
    updateFollowBtn();
  });
}, { passive: true });

$('#followBtn').onclick = () => {
  follow.hold = false;
  activeLine()?.scrollIntoView({ block: 'center', behavior: 'smooth' });
};
