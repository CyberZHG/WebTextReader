const NUM = '0-9０-９零〇一二三四五六七八九十百千万两';
const TEMPLATES = [
  { name: '中文：第X章/节/回/卷', re: `^\\s*第[${NUM}]+[章节回卷集部篇]` },
  { name: '中文：仅 第X章', re: `^\\s*第[${NUM}]+章` },
  { name: '中文：含序章/楔子/番外', re: `^\\s*(第[${NUM}]+[章节回卷集部篇]|序章|序言|楔子|引子|前言|尾声|后记|番外)` },
  { name: '英文：Chapter N', re: '^\\s*(chapter|chap\\.)\\s*[0-9ivxlcdm]+\\b' },
  { name: 'Markdown 标题', re: '^#{1,6}\\s' },
  { name: '数字编号：1. / 1、', re: '^\\s*[0-9０-９]+\\s*[.、．]\\s*\\S' },
];

const toLines = text => text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(Boolean);
const compile = src => src ? new RegExp(src, 'i') : null;

function detectRegex(lines) {
  for (const t of TEMPLATES) {
    const re = compile(t.re);
    let n = 0;
    for (const l of lines) {
      if (l.length <= MAX_TITLE && re.test(l) && ++n >= 3) return t.re;
    }
  }
  return '';
}

function setMode(mode) {
  setSetting('mode', mode);
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  $('#textPanel').hidden = mode !== 'text';
  $('#filePanel').hidden = mode !== 'file';
  if (mode === 'text') loadText(); else openFile(store.get('lastFile', null));
}

function loadText() {
  const text = $('#textInput').value;
  let pos = 0;
  if (text === store.get('text', '')) {
    pos = store.get('textPos', 0);
  } else {
    store.set('text', text);
    resetTextBookmarks();
  }
  const lines = toLines(text);
  loadReader('text', lines, buildChapters(lines, null), pos);
}

async function refreshFiles() {
  const list = (await db.list()).sort((a, b) => b.addedAt - a.addedAt);
  const sel = $('#fileSel');
  sel.replaceChildren(...(list.length ? list.map(m => new Option(m.name, m.id)) : [new Option('（暂无文件）', '')]));
  sel.disabled = !list.length;
  $('#delFile').disabled = !list.length;
  return list;
}

let openToken = 0;

async function openFile(id) {
  const token = ++openToken;
  pause();
  let list;
  try {
    list = await refreshFiles();
  } catch (e) {
    showMsg('无法访问浏览器存储：' + e.message, true);
    return;
  }
  const meta = list.find(m => m.id === id) || list[0];
  const text = meta ? (await db.getText(meta.id)) || '' : '';
  if (token !== openToken || settings.mode !== 'file') return;
  $('#regexInput').value = meta?.regex || '';
  syncTpl();
  if (!meta) {
    showMsg('');
    loadReader('file', [], buildChapters([], null), 0);
    return;
  }
  store.set('lastFile', meta.id);
  $('#fileSel').value = meta.id;
  const lines = toLines(text);
  let re = null;
  try {
    re = compile(meta.regex);
  } catch {}
  loadReader('file', lines, buildChapters(lines, re), meta.pos || 0, meta);
  reportChapters();
}

function reportChapters() {
  const n = reader.chapters.filter(c => c.heading).length;
  if (n) showMsg(`识别到 ${n} 个章节`);
  else if ($('#regexInput').value.trim()) showMsg(`未匹配到章节，按每 ${SEG} 行分段`);
  else showMsg(`未分章，按每 ${SEG} 行分段`);
}

function showMsg(text, err = false) {
  const m = $('#regexMsg');
  m.textContent = text;
  m.classList.toggle('err', err);
}

async function decode(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('gb18030').decode(buf);
  }
}

const uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);
const isText = f => /^text\//.test(f.type) || /\.(txt|text|md|markdown|log|csv)$/i.test(f.name);

async function uploadFiles(files) {
  files = [...files];
  if (!files.length) return;
  if (settings.mode !== 'file') setMode('file');
  const ok = files.filter(isText);
  if (!ok.length) {
    showMsg('仅支持纯文本文件（.txt / .md 等）', true);
    return;
  }
  let last = null;
  try {
    for (const file of ok) {
      const text = await decode(file);
      const now = Date.now();
      last = { id: uid(), name: file.name, size: file.size, regex: detectRegex(toLines(text)), pos: 0, addedAt: now, updatedAt: now };
      await db.add(last, text);
      Achv.fileAdded();
    }
    navigator.storage?.persist?.().catch(() => {});
  } catch (err) {
    showMsg('保存文件失败：' + err.message, true);
  }
  if (last) await openFile(last.id);
  if (ok.length < files.length) showMsg(`已跳过 ${files.length - ok.length} 个非文本文件`, true);
}

function syncTpl() {
  const v = $('#regexInput').value.trim();
  const i = TEMPLATES.findIndex(t => t.re === v);
  $('#tplSel').value = v === '' ? 'none' : i >= 0 ? String(i) : 'custom';
}

function applyRegex() {
  if (reader.kind !== 'file' || !reader.file) return;
  const src = $('#regexInput').value.trim();
  let re;
  try {
    re = compile(src);
  } catch (e) {
    showMsg('正则无效：' + e.message, true);
    return;
  }
  reader.chapters = buildChapters(reader.lines, re);
  reader.chapter = -1;
  reader.file.regex = src;
  fillChapters();
  setPos(reader.pos, 'jump');
  reportChapters();
}

function bindLibrary() {
  $$('.tabs button').forEach(b => {
    b.onclick = () => b.dataset.mode !== settings.mode && setMode(b.dataset.mode);
  });
  $('#loadText').onclick = () => {
    loadText();
    play();
  };
  $('#clearText').onclick = () => {
    $('#textInput').value = '';
    loadText();
    $('#textInput').focus();
  };
  $('#fileInput').onchange = e => {
    const files = [...e.target.files];
    e.target.value = '';
    uploadFiles(files);
  };
  $('#fileSel').onchange = e => openFile(e.target.value);
  $('#delFile').onclick = async () => {
    const id = $('#fileSel').value;
    const name = $('#fileSel').selectedOptions[0]?.text;
    if (!id || !confirm(`删除“${name}”及其阅读进度和书签？`)) return;
    pause();
    await db.remove(id);
    await openFile(null);
  };
  $('#tplSel').replaceChildren(
    new Option('自定义', 'custom'),
    ...TEMPLATES.map((t, i) => new Option(t.name, i)),
    new Option('不分章', 'none'),
  );
  $('#tplSel').onchange = e => {
    const v = e.target.value;
    if (v === 'custom') {
      $('#regexInput').focus();
      return;
    }
    $('#regexInput').value = v === 'none' ? '' : TEMPLATES[Number(v)].re;
    applyRegex();
  };
  $('#regexInput').oninput = syncTpl;
  $('#regexInput').onkeydown = e => e.key === 'Enter' && applyRegex();
  $('#applyRegex').onclick = applyRegex;
  bindDrop();
}

function bindDrop() {
  let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  const hide = () => {
    depth = 0;
    $('#dropZone').hidden = true;
  };
  addEventListener('dragenter', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    $('#dropZone').hidden = false;
  });
  addEventListener('dragover', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  addEventListener('dragleave', e => {
    if (hasFiles(e) && --depth <= 0) hide();
  });
  addEventListener('drop', e => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    hide();
    uploadFiles(e.dataTransfer.files);
  });
}
