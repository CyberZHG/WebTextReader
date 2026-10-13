let voices = [];

const norm = l => (l || '').replace(/_/g, '-');
const sameLang = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();
const langName = (() => {
  try {
    const dn = new Intl.DisplayNames(['zh-CN'], { type: 'language' });
    return l => { try { return dn.of(l) || l; } catch { return l; } };
  } catch {
    return l => l;
  }
})();

const QUALITY = [/natural/i, /premium/i, /enhanced/i, /online/i];

function voiceScore(v) {
  const i = QUALITY.findIndex(re => re.test(v.name));
  return (i < 0 ? 0 : (QUALITY.length - i) * 4) + (v.default ? 2 : 0) + (v.localService ? 1 : 0);
}

function langVoices() {
  return voices
    .filter(v => sameLang(v.lang, settings.lang))
    .sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name));
}

function loadVoices() {
  voices = synth.getVoices();
  const langs = [...new Set(voices.map(v => norm(v.lang)).filter(Boolean))];
  if (!langs.some(l => sameLang(l, settings.lang))) langs.push(settings.lang);
  const rank = l => sameLang(l, 'zh-CN') ? 0 : /^zh/i.test(l) ? 1 : 2;
  langs.sort((a, b) => rank(a) - rank(b) || langName(a).localeCompare(langName(b), 'zh-CN'));
  const sel = $('#langSel');
  sel.replaceChildren(...langs.map(l => new Option(`${langName(l)} (${l})`, l)));
  sel.value = langs.find(l => sameLang(l, settings.lang));
  fillVoices();
}

function fillVoices() {
  const list = langVoices();
  const label = v => v.name + (v.localService ? '' : '（在线）');
  const pick = (sel, saved) => { sel.value = list.some(v => v.voiceURI === saved) ? saved : ''; };
  $('#voiceSel').replaceChildren(
    new Option(IOS ? '自动（系统默认）' : list.length ? `自动（${list[0].name}）` : '自动（无匹配语音）', ''),
    ...list.map(v => new Option(label(v), v.voiceURI)),
  );
  pick($('#voiceSel'), settings.voices[settings.lang]);
  $('#dialogSel').replaceChildren(
    new Option('与旁白相同', ''),
    ...list.map(v => new Option(label(v), v.voiceURI)),
  );
  pick($('#dialogSel'), settings.dialogVoices[settings.lang]);
}

function currentVoice() {
  const list = langVoices();
  const uri = settings.voices[settings.lang];
  const chosen = list.find(v => v.voiceURI === uri);
  if (chosen || IOS) return chosen || null;
  return list[0] || null;
}

function dialogueVoice() {
  const uri = settings.dialogVoices[settings.lang];
  const v = uri && langVoices().find(x => x.voiceURI === uri);
  return v && v !== currentVoice() ? v : null;
}

const TIMER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720, 1440];
const CHAPTER_OPTIONS = [0, 1, 2, 3, 5, 10, 20];

function bindVoicePanel() {
  $('#langSel').onchange = e => {
    setSetting('lang', e.target.value);
    fillVoices();
  };
  $('#voiceSel').onchange = e => {
    settings.voices[settings.lang] = e.target.value;
    store.set('voices', settings.voices);
  };
  $('#dialogSel').onchange = e => {
    settings.dialogVoices[settings.lang] = e.target.value;
    store.set('dialogVoices', settings.dialogVoices);
  };
  bindRange('rate', 'rate', v => v.toFixed(1), updateStatus);
  bindRange('pitch', 'pitch', v => v.toFixed(1));
  bindRange('gap', 'gap', v => `${v} 秒`);

  const timer = $('#timerSel');
  timer.replaceChildren(...TIMER_OPTIONS.map(m => new Option(!m ? '不限' : m < 60 ? `${m} 分钟` : `${m / 60} 小时`, m)));
  timer.value = TIMER_OPTIONS.includes(settings.timer) ? settings.timer : 0;
  timer.onchange = () => {
    setSetting('timer', Number(timer.value));
    if (player.playing) player.deadline = settings.timer ? Date.now() + settings.timer * MINUTE : 0;
    updateStatus();
  };

  const chapters = $('#chapterLimitSel');
  chapters.replaceChildren(...CHAPTER_OPTIONS.map(n => new Option(n ? (n === 1 ? '1 章（本章结束）' : `${n} 章`) : '不限', n)));
  chapters.value = CHAPTER_OPTIONS.includes(settings.chapterLimit) ? settings.chapterLimit : 0;
  chapters.onchange = () => {
    setSetting('chapterLimit', Number(chapters.value));
    if (player.playing && hasChapters()) player.chaptersLeft = settings.chapterLimit;
    updateStatus();
  };
}
