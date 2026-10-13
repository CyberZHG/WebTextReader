const Achv = (() => {
  const defaults = () => ({
    listenMs: 0,
    lines: 0,
    chars: 0,
    chapters: 0,
    books: [],
    files: 0,
    texts: 0,
    daily: {},
    maxSession: 0,
    fastLines: 0,
    nightMs: 0,
    earlyMs: 0,
    timerStops: 0,
  });
  const stats = Object.assign(defaults(), store.get('stats', {}));
  const unlocked = store.get('achv', {});
  let sessionMs = 0;
  let dirty = false;
  let frozen = false;
  let lastRender = 0;

  const dayNum = k => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / DAY;
  };
  const fmtChars = n => n >= 10000 ? `${+(n / 10000).toFixed(1)} 万` : fmtNum(n);
  const fmtDays = n => `${n} 天`;

  function streaks() {
    const nums = Object.keys(stats.daily).map(dayNum).sort((a, b) => a - b);
    let best = 0, run = 0, prev = null;
    for (const n of nums) {
      run = prev !== null && n === prev + 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = n;
    }
    const current = prev !== null && dayNum(dayKey()) - prev <= 1 ? run : 0;
    return { best, current };
  }

  const tier = (group, icon, value, fmt, items) =>
    items.map(([id, name, goal, desc]) => ({ id, group, icon, value, fmt, name, goal, desc }));

  const DEFS = [
    ...tier('收听时长', 'clock', s => s.listenMs, fmtDur, [
      ['time-10m', '初闻其声', 10 * MINUTE, '累计收听 10 分钟'],
      ['time-1h', '渐入佳境', HOUR, '累计收听 1 小时'],
      ['time-10h', '耳濡目染', 10 * HOUR, '累计收听 10 小时'],
      ['time-50h', '听书达人', 50 * HOUR, '累计收听 50 小时'],
      ['time-100h', '百时之功', 100 * HOUR, '累计收听 100 小时'],
      ['time-500h', '声入人心', 500 * HOUR, '累计收听 500 小时'],
    ]),
    ...tier('收听行数', 'lines', s => s.lines, fmtNum, [
      ['lines-1', '第一句', 1, '完整听完第一行'],
      ['lines-100', '百句入耳', 100, '累计听完 100 行'],
      ['lines-1k', '千言万语', 1000, '累计听完 1,000 行'],
      ['lines-10k', '万句不倦', 10000, '累计听完 10,000 行'],
      ['lines-100k', '十万行者', 100000, '累计听完 100,000 行'],
    ]),
    ...tier('收听字数', 'text', s => s.chars, fmtChars, [
      ['chars-10k', '万字起步', 1e4, '累计听完 1 万字'],
      ['chars-100k', '积少成多', 1e5, '累计听完 10 万字'],
      ['chars-1m', '百万字纪元', 1e6, '累计听完 100 万字'],
      ['chars-10m', '著作等身', 1e7, '累计听完 1000 万字'],
    ]),
    ...tier('章节', 'bookmark', s => s.chapters, fmtNum, [
      ['ch-1', '翻开新章', 1, '听完一个章节'],
      ['ch-10', '渐入情节', 10, '累计听完 10 个章节'],
      ['ch-100', '欲罢不能', 100, '累计听完 100 个章节'],
      ['ch-1000', '千章不倦', 1000, '累计听完 1,000 个章节'],
    ]),
    ...tier('书籍', 'book', s => s.books.length, fmtNum, [
      ['book-1', '开卷有益', 1, '听完第一本书'],
      ['book-5', '书山有路', 5, '听完 5 本书'],
      ['book-20', '博览群书', 20, '听完 20 本书'],
      ['book-50', '学富五车', 50, '听完 50 本书'],
    ]),
    ...tier('书架', 'folder', s => s.files, fmtNum, [
      ['file-1', '建立书架', 1, '上传第一个文件'],
      ['file-10', '藏书家', 10, '累计上传 10 个文件'],
      ['file-50', '书香满屋', 50, '累计上传 50 个文件'],
    ]),
    ...tier('坚持', 'calendar', s => Object.keys(s.daily).length, fmtDays, [
      ['days-3', '小试牛刀', 3, '累计 3 天收听'],
      ['days-7', '一周之约', 7, '累计 7 天收听'],
      ['days-30', '月度听众', 30, '累计 30 天收听'],
      ['days-100', '百日之功', 100, '累计 100 天收听'],
    ]),
    ...tier('坚持', 'flame', () => streaks().best, fmtDays, [
      ['streak-3', '三日不辍', 3, '连续 3 天收听'],
      ['streak-7', '七日成习', 7, '连续 7 天收听'],
      ['streak-30', '持之以恒', 30, '连续 30 天收听'],
    ]),
    ...tier('专注', 'hourglass', s => s.maxSession, fmtDur, [
      ['session-1h', '一气呵成', HOUR, '单次连续收听 1 小时'],
      ['session-3h', '废寝忘食', 3 * HOUR, '单次连续收听 3 小时'],
    ]),
    ...tier('特别', 'moon', s => s.nightMs, fmtDur, [
      ['night', '夜猫子', 10 * MINUTE, '在 0:00 至 4:00 之间累计收听 10 分钟'],
    ]),
    ...tier('特别', 'sun', s => s.earlyMs, fmtDur, [
      ['early', '闻鸡起舞', 10 * MINUTE, '在 5:00 至 7:00 之间累计收听 10 分钟'],
    ]),
    ...tier('特别', 'alarm', s => s.timerStops, fmtNum, [
      ['timer-1', '伴你入眠', 1, '设置定时停止并在时间到时自动停止'],
    ]),
    ...tier('特别', 'bolt', s => s.fastLines, fmtNum, [
      ['fast', '一目十行', 100, '以 2 倍及以上语速听完 100 行'],
    ]),
    ...tier('特别', 'clipboard', s => s.texts, fmtNum, [
      ['text-1', '即兴朗读', 1, '完整听完一段粘贴的文本'],
    ]),
  ];

  function toast({ icon, name, desc }) {
    const t = el('div', 'toast');
    const info = el('div');
    const badge = el('div', 'badge');
    badge.innerHTML = ICONS[icon];
    info.append(el('div', 'title', '成就达成'), el('div', 'name', name), el('div', 'desc', desc));
    t.append(badge, info);
    t.onclick = () => openPage('achievements');
    $('#toasts').append(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 5000);
  }

  function save() {
    if (frozen) return;
    dirty = false;
    store.set('stats', stats);
  }

  function check() {
    const fresh = DEFS.filter(d => !unlocked[d.id] && d.value(stats) >= d.goal);
    if (!fresh.length) return;
    fresh.forEach(d => { unlocked[d.id] = Date.now(); });
    if (!frozen) store.set('achv', unlocked);
    save();
    const shown = fresh.length > 3 ? fresh.slice(0, 2) : fresh;
    shown.forEach(toast);
    if (fresh.length > shown.length) {
      toast({ icon: 'trophy', name: `另有 ${fresh.length - shown.length} 个成就达成`, desc: '点击查看全部成就' });
    }
    lastRender = 0;
  }

  function changed() {
    dirty = true;
    check();
    if (pageVisible('achievements') && Date.now() - lastRender > 2000) {
      lastRender = Date.now();
      pages.achievements.render(false);
    }
  }

  const listening = () => player.playing && synth && synth.speaking && !synth.paused;
  let last = Date.now();

  setInterval(() => {
    const now = Date.now();
    const d = Math.min(now - last, MINUTE);
    last = now;
    if (!listening()) return;
    const hour = new Date(now).getHours();
    const key = dayKey(new Date(now));
    stats.listenMs += d;
    stats.daily[key] = (stats.daily[key] || 0) + d;
    sessionMs += d;
    stats.maxSession = Math.max(stats.maxSession, sessionMs);
    if (hour < 4) stats.nightMs += d;
    else if (hour >= 5 && hour < 7) stats.earlyMs += d;
    changed();
  }, 1000);

  setInterval(() => dirty && save(), 5000);
  addEventListener('pagehide', () => dirty && save());
  document.addEventListener('visibilitychange', () => document.hidden && dirty && save());

  return {
    stats,
    unlocked,
    DEFS,
    streaks,
    fmtChars,
    fmtDays,
    check,
    flush: save,
    freeze() {
      frozen = true;
    },
    playStart() {
      sessionMs = 0;
    },
    timerStopped() {
      stats.timerStops++;
      changed();
      save();
    },
    fileAdded() {
      stats.files++;
      changed();
      save();
    },
    lineDone({ text, rate, kind, file, bookEnd, chapterEnd }) {
      stats.lines++;
      stats.chars += charCount(text);
      if (rate >= 2) stats.fastLines++;
      if (chapterEnd) stats.chapters++;
      if (bookEnd) {
        if (kind === 'file' && file && !stats.books.some(b => b.id === file.id)) {
          stats.books.push({ id: file.id, name: file.name, at: Date.now() });
        }
        if (kind === 'text') stats.texts++;
      }
      changed();
    },
  };
})();
