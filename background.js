// Gerencia fila de posts, contadores diários e importação via Graph API.

const DEFAULTS = {
  settings: { minDelay: 3000, maxDelay: 7000, dailyCap: 300, postPause: 4000 },
  stats: { day: '', today: 0, total: 0 },
  queue: { urls: [], index: 0, running: false, pausedForCap: false, tabId: null },
  status: 'Parado'
};

const JOB_TIMEOUT = 180000; // sem sinal do post por 3 min -> pula

let workerTabId = null;
let watchdog = null;

async function get(key) {
  const o = await browser.storage.local.get(key);
  return o[key] ?? structuredClone(DEFAULTS[key]);
}
const set = (key, value) => browser.storage.local.set({ [key]: value });
const setStatus = text => set('status', text);
const today = () => new Date().toLocaleDateString('sv'); // AAAA-MM-DD

async function getStats() {
  const s = await get('stats');
  if (s.day !== today()) {
    s.day = today();
    s.today = 0;
    await set('stats', s);
  }
  return s;
}

function kick() {
  clearTimeout(watchdog);
  watchdog = setTimeout(() => advance('timeout'), JOB_TIMEOUT);
}

async function openCurrent() {
  const q = await get('queue');
  if (!q.running) return;
  if (q.index >= q.urls.length) {
    q.running = false;
    await set('queue', q);
    await setStatus(`Fila concluída (${q.urls.length} posts)`);
    return;
  }
  let tabId = q.tabId;
  try {
    await browser.tabs.get(tabId);
  } catch {
    const w = await browser.windows.create({ url: 'about:blank' });
    tabId = w.tabs[0].id;
    q.tabId = tabId;
    await set('queue', q);
  }
  workerTabId = tabId;
  await setStatus(`Post ${q.index + 1}/${q.urls.length}`);
  await browser.tabs.update(tabId, { url: q.urls[q.index] });
  kick();
}

async function advance(result) {
  clearTimeout(watchdog);
  const q = await get('queue');
  if (!q.running) return;
  q.index++;
  await set('queue', q);
  if (result === 'timeout') await setStatus(`Post ${q.index} sem resposta, pulando`);
  const s = await get('settings');
  setTimeout(openCurrent, s.postPause * (0.7 + Math.random() * 0.6));
}

async function stopQueue(text) {
  clearTimeout(watchdog);
  const q = await get('queue');
  q.running = false;
  q.pausedForCap = false;
  await set('queue', q);
  await browser.alarms.clear('resume');
  if (text) await setStatus(text);
}

async function pauseForCap() {
  clearTimeout(watchdog);
  const q = await get('queue');
  q.running = false;
  q.pausedForCap = true;
  await set('queue', q);
  // retoma amanhã entre 00:10 e 01:10
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(0, 10, 0, 0);
  browser.alarms.create('resume', { when: t.getTime() + Math.random() * 3600000 });
  await setStatus(`Limite diário atingido. Retoma automaticamente em ${t.toLocaleDateString()}`);
}

browser.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'resume') return;
  const q = await get('queue');
  if (!q.pausedForCap) return;
  q.running = true;
  q.pausedForCap = false;
  await set('queue', q);
  openCurrent();
});

async function importGraph(token) {
  let url = 'https://graph.facebook.com/me/posts?fields=permalink_url,reactions.limit(0).summary(total_count)'
    + `&limit=100&access_token=${encodeURIComponent(token)}`;
  const urls = [];
  let scanned = 0;
  while (url) {
    const r = await fetch(url);
    const j = await r.json();
    if (j.error) throw new Error(j.error.message);
    for (const p of j.data) {
      scanned++;
      const n = p.reactions?.summary?.total_count ?? 1;
      if (n > 0 && p.permalink_url) urls.push(p.permalink_url);
    }
    await setStatus(`Importando... ${scanned} posts lidos, ${urls.length} com reações`);
    url = j.paging?.next;
  }
  return urls;
}

browser.runtime.onMessage.addListener(async (msg, sender) => {
  const fromWorker = sender.tab && sender.tab.id === workerTabId;
  if (fromWorker) kick();

  switch (msg.type) {
    // --- vindas do content script ---
    case 'getSettings':
      return get('settings');
    case 'getJob': {
      const q = await get('queue');
      const job = q.running && sender.tab?.id === q.tabId;
      if (job) workerTabId = q.tabId;
      return { job, settings: await get('settings') };
    }
    case 'canInvite': {
      const [s, st] = await Promise.all([getStats(), get('settings')]);
      return { allowed: s.today < st.dailyCap };
    }
    case 'invited': {
      const s = await getStats();
      s.today++;
      s.total++;
      await set('stats', s);
      return;
    }
    case 'hb':
      return;
    case 'status':
      return setStatus(msg.text);
    case 'jobDone':
      if (!fromWorker) return;
      if (msg.status === 'cap') return pauseForCap();
      if (msg.status === 'blocked' || msg.status === 'stopped') return stopQueue();
      return advance(msg.status);
    case 'blocked':
      return stopQueue('⚠ Facebook bloqueou o recurso temporariamente. Tudo parado. Espere ao menos 24h.');
    case 'stopAll':
      return stopQueue('Parado pelo usuário');

    // --- vindas do popup ---
    case 'startQueue': {
      const q = await get('queue');
      if (!q.urls.length) return { error: 'Fila vazia' };
      const s = await getStats();
      const st = await get('settings');
      if (s.today >= st.dailyCap) {
        q.running = false;
        await set('queue', q);
        await pauseForCap();
        return;
      }
      q.running = true;
      q.pausedForCap = false;
      await set('queue', q);
      openCurrent();
      return;
    }
    case 'stopQueue':
      if (workerTabId) browser.tabs.sendMessage(workerTabId, { cmd: 'stop' }).catch(() => {});
      return stopQueue('Fila parada');
    case 'setUrls': {
      const q = await get('queue');
      q.urls = [...new Set(msg.urls)];
      q.index = 0;
      q.running = false;
      q.pausedForCap = false;
      await set('queue', q);
      await setStatus(`${q.urls.length} posts na fila`);
      return { count: q.urls.length };
    }
    case 'setIndex': {
      const q = await get('queue');
      q.index = Math.max(0, Math.min(msg.index, q.urls.length));
      await set('queue', q);
      return;
    }
    case 'importGraph':
      try {
        const urls = await importGraph(msg.token);
        const q = await get('queue');
        q.urls = urls;
        q.index = 0;
        q.running = false;
        await set('queue', q);
        await setStatus(`Importados ${urls.length} posts com reações`);
        return { count: urls.length };
      } catch (e) {
        await setStatus('Erro na importação: ' + e.message);
        return { error: e.message };
      }
    case 'saveSettings':
      return set('settings', msg.settings);
    case 'getState': {
      const [settings, stats, queue, status] = await Promise.all(
        [get('settings'), getStats(), get('queue'), get('status')]);
      return { settings, stats, queue: { ...queue, urls: undefined, total: queue.urls.length }, status };
    }
  }
});
