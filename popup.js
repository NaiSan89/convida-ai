const $ = id => document.getElementById(id);
const bg = msg => browser.runtime.sendMessage(msg);

async function toTab(cmd) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  try {
    const r = await browser.tabs.sendMessage(tab.id, { cmd });
    if (r && r.error) $('status').textContent = r.error;
  } catch {
    $('status').textContent = 'Abra uma aba do facebook.com (recarregue a página se acabou de instalar)';
  }
}

let settingsLoaded = false;
async function refresh() {
  const s = await bg({ type: 'getState' });
  $('status').textContent = s.status;
  $('today').textContent = s.stats.today;
  $('cap').textContent = s.settings.dailyCap;
  $('total').textContent = s.stats.total;
  $('qpos').textContent = `${Math.min(s.queue.index + 1, s.queue.total)}/${s.queue.total}`
    + (s.queue.running ? ' ▶' : s.queue.pausedForCap ? ' ⏸' : '');
  if (!settingsLoaded) {
    settingsLoaded = true;
    $('minDelay').value = s.settings.minDelay / 1000;
    $('maxDelay').value = s.settings.maxDelay / 1000;
    $('dailyCap').value = s.settings.dailyCap;
    $('postPause').value = s.settings.postPause / 1000;
    $('index').value = s.queue.index + 1;
  }
}

$('runDialog').onclick = () => toTab('runDialog');
$('runFeed').onclick = () => toTab('runFeed');

$('import').onclick = async () => {
  const token = $('token').value.trim();
  if (!token) return ($('status').textContent = 'Cole o token da página');
  $('status').textContent = 'Importando...';
  const r = await bg({ type: 'importGraph', token });
  if (r && r.count != null) $('index').value = 1;
};

$('loadUrls').onclick = async () => {
  const urls = $('urls').value.split(/\s+/).filter(u => /^https?:\/\/[^/]*facebook\.com\//.test(u));
  if (!urls.length) return ($('status').textContent = 'Nenhuma URL válida do facebook.com');
  await bg({ type: 'setUrls', urls });
  $('index').value = 1;
};

$('startQueue').onclick = async () => {
  await bg({ type: 'setIndex', index: Math.max(0, (+$('index').value || 1) - 1) });
  const r = await bg({ type: 'startQueue' });
  if (r && r.error) $('status').textContent = r.error;
};

$('stopAll').onclick = async () => {
  await bg({ type: 'stopQueue' });
  toTab('stop');
};

$('save').onclick = async () => {
  const min = +$('minDelay').value * 1000;
  const max = Math.max(min, +$('maxDelay').value * 1000);
  await bg({
    type: 'saveSettings',
    settings: { minDelay: min, maxDelay: max, dailyCap: +$('dailyCap').value, postPause: +$('postPause').value * 1000 }
  });
  $('status').textContent = 'Configurações salvas';
};

refresh();
setInterval(refresh, 1000);
