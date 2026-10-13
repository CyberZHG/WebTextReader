const WIDTHS = [[680, '窄'], [880, '中'], [1100, '宽'], [0, '全宽']];

function applyTheme() {
  const dark = settings.theme === 'dark';
  const btn = $('#themeBtn');
  document.documentElement.dataset.theme = settings.theme;
  btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
  btn.title = dark ? '切换到浅色模式' : '切换到深色模式';
  btn.setAttribute('aria-label', btn.title);
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#1b1e23' : '#ffffff');
}

function applyDisplay() {
  const s = document.documentElement.style;
  s.setProperty('--read-size', settings.fontSize + 'px');
  s.setProperty('--read-lh', settings.lineHeight);
  s.setProperty('--page-width', settings.pageWidth ? settings.pageWidth + 'px' : '100%');
}

function bindDisplay() {
  $('#themeBtn').onclick = () => {
    setSetting('theme', settings.theme === 'dark' ? 'light' : 'dark');
    applyTheme();
  };
  bindRange('fontSize', 'fontSize', v => `${v}px`, applyDisplay);
  bindRange('lineHeight', 'lineHeight', v => v.toFixed(1), applyDisplay);
  const width = $('#pageWidth');
  width.replaceChildren(...WIDTHS.map(([v, name]) => new Option(name, v)));
  width.value = WIDTHS.some(([v]) => v === settings.pageWidth) ? settings.pageWidth : 880;
  width.onchange = () => {
    setSetting('pageWidth', Number(width.value));
    applyDisplay();
  };
  bindCheck('followChk', 'follow', () => {
    follow.hold = false;
    updateFollowBtn();
  });
  bindCheck('wakeChk', 'wakeLock', syncSystem);
  bindCheck('mediaChk', 'mediaSession', syncSystem);
  if (!('wakeLock' in navigator)) {
    $('#wakeChk').disabled = true;
    $('#wakeHint').textContent = '当前浏览器不支持屏幕常亮。';
  }
  if (!('mediaSession' in navigator)) {
    $('#mediaChk').disabled = true;
    $('#mediaHint').textContent = '当前浏览器不支持系统媒体控制。';
  }
}
