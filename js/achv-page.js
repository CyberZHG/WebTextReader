const heatLevel = ms => !ms ? 0 : ms < 15 * MINUTE ? 1 : ms < 30 * MINUTE ? 2 : ms < HOUR ? 3 : 4;

function heatDays(weeks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (today.getDay() + 6) % 7 - (weeks - 1) * 7);
  const days = [];
  for (let k = 0; k < weeks * 7; k++) {
    const d = new Date(start);
    d.setDate(start.getDate() + k);
    const key = dayKey(d);
    days.push({ key, future: d > today, ms: Achv.stats.daily[key] || 0 });
  }
  return days;
}

function renderHeatmap(first) {
  if (first) hideHeatTip();
  const wrap = $('#heatmap');
  const prev = wrap.querySelector('.heat-scroll')?.scrollLeft;
  const days = heatDays(53);
  const grid = el('div', 'heat-grid');
  let count = 0, total = 0;
  for (const d of days) {
    const cell = el('div', d.future ? 'heat-cell future' : `heat-cell l${heatLevel(d.ms)}`);
    if (!d.future) {
      cell.dataset.tip = `${d.key}：${d.ms ? fmtDur(d.ms) : '未收听'}`;
      if (d.ms) {
        count++;
        total += d.ms;
      }
    }
    grid.append(cell);
  }
  const scroll = el('div', 'heat-scroll');
  scroll.append(grid);
  const legend = el('div', 'heat-legend');
  legend.append(el('span', '', `过去一年收听 ${count} 天，共 ${fmtDur(total)}`), el('span', 'grow'), '少');
  for (let l = 0; l <= 4; l++) legend.append(el('span', `heat-cell l${l}`));
  legend.append('多');
  wrap.replaceChildren(scroll, legend);
  scroll.scrollLeft = first || prev === undefined ? scroll.scrollWidth : prev;
}

function renderAchvPage(first) {
  const { stats, unlocked, DEFS, fmtChars, fmtDays } = Achv;
  $('#achvCount').textContent = `已解锁 ${DEFS.filter(d => unlocked[d.id]).length} / ${DEFS.length}`;

  const { best, current } = Achv.streaks();
  const items = [
    ['累计收听', fmtDur(stats.listenMs)],
    ['今日收听', fmtDur(stats.daily[dayKey()] || 0)],
    ['收听行数', fmtNum(stats.lines)],
    ['收听字数', fmtChars(stats.chars)],
    ['听完章节', fmtNum(stats.chapters)],
    ['听完书籍', fmtNum(stats.books.length)],
    ['上传文件', fmtNum(stats.files)],
    ['收听天数', fmtDays(Object.keys(stats.daily).length)],
    ['当前连续', fmtDays(current)],
    ['最长连续', fmtDays(best)],
    ['最长单次', fmtDur(stats.maxSession)],
  ];
  $('#statGrid').replaceChildren(...items.map(([label, value]) => {
    const c = el('div', 'stat');
    c.append(el('div', 'label', label), el('div', 'value', value));
    return c;
  }));

  renderHeatmap(first);

  const books = $('#bookList');
  books.replaceChildren();
  if (stats.books.length) {
    const ul = el('ul', 'books');
    [...stats.books].reverse().forEach(b => {
      const li = el('li');
      li.append(el('span', 'name', b.name), el('span', 'date', dayKey(new Date(b.at))));
      ul.append(li);
    });
    books.append(el('h2', '', '听完的书'), ul);
  }

  const list = $('#achvList');
  list.replaceChildren();
  let grid = null, group = null;
  for (const d of DEFS) {
    if (d.group !== group) {
      group = d.group;
      grid = el('div', 'achv-grid');
      list.append(el('h2', '', group), grid);
    }
    const at = unlocked[d.id];
    const v = Math.min(d.value(stats), d.goal);
    const card = el('div', at ? 'achv done' : 'achv');
    const badge = el('div', 'badge');
    badge.innerHTML = ICONS[d.icon];
    const info = el('div', 'info');
    const track = el('div', 'bar-track');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${(at ? 1 : v / d.goal) * 100}%`;
    track.append(fill);
    info.append(
      el('div', 'name', d.name),
      el('div', 'desc', d.desc),
      track,
      el('div', 'meta', at ? `达成于 ${dayKey(new Date(at))}` : `${d.fmt(v)} / ${d.fmt(d.goal)}`),
    );
    card.append(badge, info);
    grid.append(card);
  }
}

function showHeatTip(cell) {
  const tip = $('#heatTip');
  tip.textContent = cell.dataset.tip;
  tip.hidden = false;
  const r = cell.getBoundingClientRect();
  const w = tip.offsetWidth;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${r.top - tip.offsetHeight - 6}px`;
  tip.dataset.key = cell.dataset.tip;
}

function hideHeatTip() {
  $('#heatTip').hidden = true;
}

function bindHeatmap() {
  const map = $('#heatmap');
  map.addEventListener('pointerover', e => {
    const cell = e.target.closest('.heat-cell[data-tip]');
    if (cell && e.pointerType === 'mouse') showHeatTip(cell);
  });
  map.addEventListener('pointerleave', hideHeatTip);
  map.addEventListener('click', e => {
    const cell = e.target.closest('.heat-cell[data-tip]');
    if (!cell) return hideHeatTip();
    const tip = $('#heatTip');
    if (!tip.hidden && tip.dataset.key === cell.dataset.tip) hideHeatTip();
    else showHeatTip(cell);
  });
  document.addEventListener('click', e => { if (!e.target.closest('#heatmap')) hideHeatTip(); });
  map.addEventListener('scroll', hideHeatTip, true);
  $('#achvPage').addEventListener('scroll', hideHeatTip);
}

pages.achievements = { el: '#achvPage', render: renderAchvPage };
