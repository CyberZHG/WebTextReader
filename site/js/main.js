pages.settings = { el: '#settingsPage' };

applyIcons();
applyTheme();
applyDisplay();
bindDisplay();
bindVoicePanel();
compileRules();
bindRules();
bindLibrary();
bindTools();
bindBackup();
bindShare();
bindHeatmap();
bindFolds();
$('#iosHint').hidden = !IOS;
$('#aboutBtn').onclick = () => $('#aboutDlg').showModal();
$('#aboutClose').onclick = () => $('#aboutDlg').close();
$('#textInput').value = store.get('text', '');

if (synth) {
  synth.cancel();
  loadVoices();
  synth.onvoiceschanged = loadVoices;
  addEventListener('pagehide', () => synth.cancel());
} else {
  $('#warn').hidden = false;
}

new ResizeObserver(() => {
  document.documentElement.style.setProperty('--controls-h', $('.controls').offsetHeight + 'px');
}).observe($('.controls'));

setInterval(() => player.playing && (player.deadline || player.waitUntil || player.chaptersLeft) && updateStatus(), 1000);

setMode(settings.mode === 'text' ? 'text' : 'file');
updatePlayBtn();
Achv.check();
route();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !player.playing) location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
