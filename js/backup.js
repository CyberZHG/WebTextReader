const BACKUP_MAGIC = 'WTRB';
const BACKUP_KEY = new TextEncoder().encode('WebTextReader/backup/2026');

function scramble(bytes) {
  for (let i = 0; i < bytes.length; i++) bytes[i] ^= BACKUP_KEY[i % BACKUP_KEY.length] ^ ((i * 131) & 255);
  return bytes;
}

async function pipeBytes(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

async function packBackup(obj) {
  let data = new TextEncoder().encode(JSON.stringify(obj));
  const gzip = 'CompressionStream' in window;
  if (gzip) data = await pipeBytes(data, new CompressionStream('gzip'));
  scramble(data);
  const out = new Uint8Array(5 + data.length);
  out.set(new TextEncoder().encode(BACKUP_MAGIC));
  out[4] = gzip ? 1 : 0;
  out.set(data, 5);
  return out;
}

async function unpackBackup(buf) {
  const bytes = new Uint8Array(buf);
  if (new TextDecoder().decode(bytes.slice(0, 4)) !== BACKUP_MAGIC) throw new Error('不是有效的备份文件');
  let data = scramble(bytes.slice(5));
  if (bytes[4] === 1) data = await pipeBytes(data, new DecompressionStream('gzip'));
  const obj = JSON.parse(new TextDecoder().decode(data));
  if (obj.app !== 'WebTextReader') throw new Error('不是有效的备份文件');
  return obj;
}

function backupMsg(text, err = false) {
  const m = $('#backupMsg');
  m.textContent = text;
  m.classList.toggle('err', err);
}

async function exportBackup() {
  try {
    Achv.flush();
    const files = [];
    if ($('#backupFiles').checked) {
      for (const meta of await db.list()) files.push({ meta, text: (await db.getText(meta.id)) || '' });
    }
    const data = await packBackup({ app: 'WebTextReader', version: 1, exportedAt: Date.now(), prefs: store.all(), files });
    const d = new Date();
    const a = el('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
    a.download = `WebTextReader-${dayKey(d).replace(/-/g, '')}-${pad(d.getHours())}${pad(d.getMinutes())}.wtrbak`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    backupMsg(`已导出：设置、进度、统计、成就${files.length ? `，以及 ${files.length} 个文件` : ''}`);
  } catch (e) {
    backupMsg('导出失败：' + e.message, true);
  }
}

async function importBackup(file) {
  try {
    const obj = await unpackBackup(await file.arrayBuffer());
    const when = new Date(obj.exportedAt).toLocaleString('zh-CN');
    if (!confirm(`导入 ${when} 的备份？\n当前的设置、统计和成就将被覆盖，备份中的文件会合并到书架。`)) return;
    pause();
    Achv.freeze();
    Object.keys(store.all()).forEach(k => localStorage.removeItem('wtr.' + k));
    for (const [k, v] of Object.entries(obj.prefs || {})) store.set(k, v);
    for (const { meta, text } of obj.files || []) await db.add(meta, text);
    location.reload();
  } catch (e) {
    backupMsg('导入失败：' + e.message, true);
  }
}

function bindBackup() {
  $('#exportBtn').onclick = exportBackup;
  $('#importInput').onchange = e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importBackup(file);
  };
}
