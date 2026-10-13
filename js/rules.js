const rules = { skip: [], replace: [] };

const charCount = s => s.replace(/\s/g, '').length;

function compileRules() {
  const errors = [];
  rules.skip = [];
  rules.replace = [];
  settings.rules.skip.split('\n').forEach((raw, n) => {
    const src = raw.trim();
    if (!src) return;
    try {
      rules.skip.push(new RegExp(src, 'i'));
    } catch (e) {
      errors.push(`跳过规则第 ${n + 1} 行：${e.message}`);
    }
  });
  settings.rules.replace.split('\n').forEach((raw, n) => {
    const line = raw.trim();
    if (!line) return;
    try {
      const m = line.match(/^\/(.+)\/([a-z]*)=(.*)$/);
      if (m) {
        rules.replace.push([new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g'), m[3]]);
        return;
      }
      const k = line.indexOf('=');
      if (k <= 0) throw new Error('缺少“=”');
      rules.replace.push([line.slice(0, k), line.slice(k + 1)]);
    } catch (e) {
      errors.push(`替换规则第 ${n + 1} 行：${e.message}`);
    }
  });
  return errors;
}

function speechOf(line) {
  let s = line;
  for (const [from, to] of rules.replace) {
    s = typeof from === 'string' ? s.split(from).join(to) : s.replace(from, to);
  }
  return s;
}

function analyze() {
  const { lines } = reader;
  const n = lines.length;
  const skip = new Uint8Array(n);
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    skip[i] = rules.skip.some(re => re.test(lines[i])) ? 1 : 0;
    prefix[i + 1] = prefix[i] + (skip[i] ? 0 : charCount(rules.replace.length ? speechOf(lines[i]) : lines[i]));
  }
  reader.skip = skip;
  reader.prefix = prefix;
}

function bindRules() {
  $('#skipRules').value = settings.rules.skip;
  $('#replaceRules').value = settings.rules.replace;
  $('#applyRules').onclick = () => {
    setSetting('rules', { skip: $('#skipRules').value, replace: $('#replaceRules').value });
    const errors = compileRules();
    const msg = $('#rulesMsg');
    msg.textContent = errors.length ? errors.join('；') : `已保存：${rules.skip.length} 条跳过规则，${rules.replace.length} 条替换规则`;
    msg.classList.toggle('err', errors.length > 0);
    analyze();
    decorate();
    updateStatus();
  };
}
