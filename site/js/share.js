const share = { blob: null, url: '' };

function drawShareCard() {
  const css = getComputedStyle(document.documentElement);
  const color = n => css.getPropertyValue(n).trim();
  const W = 1080, H = 1420;
  const cv = el('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const font = (size, weight = 400) => `${weight} ${size}px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;
  const text = (s, x, y, size, fill, weight, align = 'left') => {
    g.font = font(size, weight);
    g.fillStyle = fill;
    g.textAlign = align;
    g.fillText(s, x, y);
  };
  const box = (x, y, w, h, r, fill, stroke) => {
    g.beginPath();
    g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = 2;
      g.stroke();
    }
  };
  const fit = (s, max, size) => {
    g.font = font(size, 600);
    if (g.measureText(s).width <= max) return s;
    while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  };

  const { stats, unlocked, DEFS } = Achv;
  const bg = color('--bg'), surface = color('--surface'), border = color('--border');
  const fg = color('--text'), muted = color('--muted'), accent = color('--accent');

  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  text('我的听书成就', 80, 150, 64, fg, 700);
  text(`${dayKey()} · 离线文本朗读`, 80, 205, 30, muted);

  const items = [
    ['累计收听', fmtDur(stats.listenMs)],
    ['收听字数', Achv.fmtChars(stats.chars)],
    ['听完书籍', `${stats.books.length} 本`],
    ['最长连续', `${Achv.streaks().best} 天`],
  ];
  items.forEach(([label, value], k) => {
    const x = 80 + (k % 2) * 480, y = 260 + Math.floor(k / 2) * 210;
    box(x, y, 440, 180, 24, surface, border);
    text(label, x + 36, y + 62, 30, muted);
    text(value, x + 36, y + 138, 56, fg, 700);
  });

  const done = DEFS.filter(d => unlocked[d.id]).sort((a, b) => unlocked[b.id] - unlocked[a.id]);
  text(`已解锁 ${done.length} / ${DEFS.length} 个成就`, 80, 735, 36, fg, 700);
  box(80, 760, 920, 16, 8, surface);
  if (done.length) box(80, 760, 920 * done.length / DEFS.length, 16, 8, accent);
  done.slice(0, 6).forEach((d, k) => {
    const x = 80 + (k % 2) * 480, y = 810 + Math.floor(k / 2) * 96;
    box(x, y, 440, 80, 40, surface, border);
    box(x + 16, y + 16, 48, 48, 24, accent);
    text(fit(d.name, 330, 32), x + 84, y + 52, 32, fg, 600);
  });

  text('近半年', 80, 1135, 28, muted);
  heatDays(26).forEach((d, k) => {
    const x = 80 + Math.floor(k / 7) * 23, y = 1155 + (k % 7) * 23;
    if (d.future) return;
    const level = heatLevel(d.ms);
    g.globalAlpha = level ? [0, 0.3, 0.5, 0.75, 1][level] : 1;
    box(x, y, 18, 18, 4, level ? accent : surface);
    g.globalAlpha = 1;
  });
  g.fillStyle = border;
  g.fillRect(80, H - 92, W - 160, 2);
  text('https://cyberzhg.github.io/WebTextReader/', 80, H - 40, 28, accent, 600);
  text('WebTextReader', W - 80, H - 40, 28, muted, 600, 'right');
  return cv;
}

async function openShare() {
  const cv = drawShareCard();
  share.blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  URL.revokeObjectURL(share.url);
  share.url = URL.createObjectURL(share.blob);
  $('#shareImg').src = share.url;
  const file = new File([share.blob], 'achievements.png', { type: 'image/png' });
  $('#shareSend').hidden = !navigator.canShare?.({ files: [file] });
  $('#shareDlg').showModal();
}

function bindShare() {
  $('#shareBtn').onclick = openShare;
  $('#shareClose').onclick = () => $('#shareDlg').close();
  $('#shareSave').onclick = () => {
    const a = el('a');
    a.href = share.url;
    a.download = `听书成就-${dayKey()}.png`;
    a.click();
  };
  $('#shareSend').onclick = async () => {
    try {
      await navigator.share({ files: [new File([share.blob], `听书成就-${dayKey()}.png`, { type: 'image/png' })], title: '我的听书成就' });
    } catch {}
  };
}
