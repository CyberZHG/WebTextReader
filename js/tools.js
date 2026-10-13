const SEARCH_LIMIT = 300;
let textMarks = store.get('textBookmarks', []);

const chapterTitle = i => reader.chapters.length > 1 ? reader.chapters[chapterAt(i)].title : '';
const lineMeta = i => [chapterTitle(i), `第 ${i + 1} 行`].filter(Boolean).join(' · ');

function snippet(line, k, len) {
  const box = el('div', 'snip');
  const start = Math.max(0, k - 20);
  box.append(
    (start > 0 ? '…' : '') + line.slice(start, k),
    el('mark', '', line.slice(k, k + len)),
    line.slice(k + len, k + len + 40) + (k + len + 40 < line.length ? '…' : ''),
  );
  return box;
}

function focusSearch() {
  $('#searchPanel').open = true;
  $('#searchInput').focus();
}

function clearSearch() {
  $('#searchResults').replaceChildren();
  $('#searchMsg').textContent = '';
}

function runSearch() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const list = $('#searchResults');
  list.replaceChildren();
  if (!q) {
    $('#searchMsg').textContent = '';
    return;
  }
  let total = 0;
  reader.lines.forEach((line, i) => {
    const k = line.toLowerCase().indexOf(q);
    if (k < 0 || ++total > SEARCH_LIMIT) return;
    const li = el('li');
    li.append(el('div', 'meta', lineMeta(i)), snippet(line, k, q.length));
    li.onclick = () => goTo(i);
    list.append(li);
  });
  $('#searchMsg').textContent = !total ? '没有找到' : total > SEARCH_LIMIT ? `找到 ${total} 处，仅显示前 ${SEARCH_LIMIT} 处` : `找到 ${total} 处`;
}

function bookmarks() {
  if (reader.kind === 'file') return reader.file ? (reader.file.bookmarks ||= []) : [];
  return textMarks;
}

function persistBookmarks() {
  if (reader.kind === 'file') reader.file && db.putMeta(reader.file).catch(() => {});
  else store.set('textBookmarks', textMarks);
}

function resetTextBookmarks() {
  textMarks = [];
  store.set('textBookmarks', textMarks);
}

const bookmarkSet = () => new Set(bookmarks().map(b => b.i));

function toggleBookmark() {
  if (!reader.lines.length || (reader.kind === 'file' && !reader.file)) return;
  const list = bookmarks();
  const k = list.findIndex(b => b.i === reader.pos);
  if (k >= 0) {
    list.splice(k, 1);
  } else {
    const note = prompt('书签备注（可留空）', '');
    if (note === null) return;
    list.push({ i: reader.pos, note: note.trim(), at: Date.now() });
    list.sort((a, b) => a.i - b.i);
  }
  persistBookmarks();
  renderBookmarks();
  decorate();
  syncBookmarkBtn();
}

function removeBookmark(i) {
  const list = bookmarks();
  const k = list.findIndex(b => b.i === i);
  if (k < 0) return;
  list.splice(k, 1);
  persistBookmarks();
  renderBookmarks();
  decorate();
  syncBookmarkBtn();
}

function renderBookmarks() {
  const list = bookmarks().filter(b => b.i < reader.lines.length);
  $('#bmCount').textContent = list.length ? `（${list.length}）` : '';
  $('#bookmarkList').replaceChildren(...list.map(b => {
    const li = el('li');
    const info = el('div', 'grow');
    const line = reader.lines[b.i];
    info.append(el('div', 'meta', lineMeta(b.i)), el('div', 'snip', line.length > 60 ? line.slice(0, 60) + '…' : line));
    if (b.note) info.append(el('div', 'note', b.note));
    const del = el('button', 'icon-btn small');
    del.type = 'button';
    del.title = '删除书签';
    del.setAttribute('aria-label', '删除书签');
    del.innerHTML = ICONS.close;
    del.onclick = e => {
      e.stopPropagation();
      removeBookmark(b.i);
    };
    li.append(info, del);
    li.onclick = () => goTo(b.i);
    return li;
  }));
  $('#bookmarkEmpty').hidden = list.length > 0;
}

function syncBookmarkBtn() {
  const on = reader.lines.length > 0 && bookmarkSet().has(reader.pos);
  const btn = $('#bookmarkBtn');
  const tip = on ? '移除书签（B）' : '添加书签（B）';
  btn.classList.toggle('on', on);
  btn.dataset.tip = tip;
  btn.setAttribute('aria-label', tip);
}

function bindTools() {
  $('#searchBtn').onclick = runSearch;
  $('#searchInput').onkeydown = e => e.key === 'Enter' && runSearch();
  $('#bookmarkBtn').onclick = toggleBookmark;
}
