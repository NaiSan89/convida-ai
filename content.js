// Roda dentro do facebook.com: abre o diálogo de reações e clica em "Convidar".
(() => {
  if (window.__convidarReacoes) return;
  window.__convidarReacoes = true;

  const INVITE_LABELS = ['convidar', 'invite'];
  const TRIGGER_RE = /(v[eê]r? quem reagiu|see who reacted|todas as reações|all reactions)/i;
  const ALL_TAB_RE = /^(tudo|todas|all)$/i;
  const BLOCK_RE = /(não pode usar este recurso|can.t use this feature|bloqueado temporariamente|temporarily blocked|tente novamente mais tarde|try again later)/i;
  const CLOSE_RE = /^(fechar|close)$/i;

  let running = false;
  let settings = { minDelay: 3000, maxDelay: 7000 };

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const randDelay = () => settings.minDelay + Math.random() * (settings.maxDelay - settings.minDelay);
  const send = msg => browser.runtime.sendMessage(msg).catch(() => null);
  const labelOf = el => (el.getAttribute('aria-label') || el.innerText || '').trim().toLowerCase();

  async function waitFor(fn, timeout = 15000, step = 500) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const v = fn();
      if (v) return v;
      await sleep(step);
    }
    return null;
  }

  // ---------- overlay na página ----------
  let box;
  function ui(text) {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;background:#1c1e21;color:#fff;'
        + 'font:13px system-ui,sans-serif;padding:8px 10px;border-radius:8px;box-shadow:0 2px 8px #0006;'
        + 'display:flex;gap:10px;align-items:center;max-width:420px';
      const t = document.createElement('span');
      const b = document.createElement('button');
      b.textContent = 'Parar';
      b.style.cssText = 'background:#e41e3f;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer';
      b.onclick = () => { running = false; send({ type: 'stopAll' }); ui('Parado'); };
      box.append(t, b);
      document.body.append(box);
    }
    box.firstChild.textContent = text;
    send({ type: 'status', text });
  }

  // ---------- diálogo de reações ----------
  function inviteButtons(root) {
    return [...root.querySelectorAll('[role="button"], button')].filter(b =>
      !b.dataset.crDone
      && b.getAttribute('aria-disabled') !== 'true'
      && INVITE_LABELS.includes(labelOf(b)));
  }

  function findScroller(dialog) {
    let best = null;
    for (const el of dialog.querySelectorAll('div')) {
      if (el.scrollHeight <= el.clientHeight + 20) continue;
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && (!best || el.scrollHeight > best.scrollHeight)) best = el;
    }
    return best;
  }

  function isBlocked() {
    for (const d of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
      if (BLOCK_RE.test(d.innerText)) return true;
    }
    return false;
  }

  async function processDialog(dialog, tag = '') {
    let invited = 0, idle = 0, scroller = null;
    while (running && idle < 5 && dialog.isConnected) {
      const btns = inviteButtons(dialog);
      if (btns.length) {
        idle = 0;
        for (const b of btns) {
          if (!running) break;
          const r = await send({ type: 'canInvite' });
          if (r && r.allowed === false) {
            running = false;
            ui('Limite diário atingido');
            return { invited, status: 'cap' };
          }
          b.dataset.crDone = '1';
          b.scrollIntoView({ block: 'nearest' });
          b.click();
          invited++;
          send({ type: 'invited' });
          ui(`${tag}Convidados neste post: ${invited}`);
          await sleep(randDelay());
          if (isBlocked()) {
            running = false;
            send({ type: 'blocked' });
            ui('⚠ Bloqueio do Facebook detectado. Parado.');
            return { invited, status: 'blocked' };
          }
        }
      } else {
        send({ type: 'hb' });
        if (!scroller || !scroller.isConnected) scroller = findScroller(dialog);
        if (!scroller) { idle++; await sleep(1000); continue; }
        const h = scroller.scrollHeight;
        scroller.scrollTop = h;
        await sleep(1800);
        if (scroller.scrollHeight === h && !inviteButtons(dialog).length) idle++;
      }
    }
    return { invited, status: running ? 'ok' : 'stopped' };
  }

  function findTrigger(root) {
    // Layout atual: <span role="toolbar" aria-label="Vê quem reagiu a isto"> com um botão por tipo de reação.
    // Não clicar no número ao lado: ele fica dentro do botão de reagir e removeria a reação.
    for (const el of root.querySelectorAll('[aria-label]')) {
      if (!TRIGGER_RE.test(el.getAttribute('aria-label'))) continue;
      return el.querySelector('[role="button"]') || el.closest('[role="button"]') || el;
    }
    for (const el of root.querySelectorAll('[role="button"]')) {
      if (el.textContent.length < 200 && TRIGGER_RE.test(el.textContent)) return el;
    }
    return null;
  }

  function closeDialog(dialog) {
    const btn = [...dialog.querySelectorAll('[aria-label]')].find(e => CLOSE_RE.test(e.getAttribute('aria-label')));
    if (btn) btn.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
  }

  async function openAndProcess(trigger, tag) {
    const before = new Set(document.querySelectorAll('[role="dialog"]'));
    trigger.scrollIntoView({ block: 'center' });
    await sleep(600);
    trigger.click();
    const dialog = await waitFor(() => [...document.querySelectorAll('[role="dialog"]')]
      .reverse().find(d => !before.has(d) && d.querySelector('[role="tab"]')), 15000);
    if (!dialog) return { invited: 0, status: 'nodialog' };
    await sleep(1500);
    // o diálogo abre na aba da reação clicada; trocar para "Tudo"
    const allTab = [...dialog.querySelectorAll('[role="tab"]')].find(t => ALL_TAB_RE.test(t.innerText.trim()));
    if (allTab && allTab.getAttribute('aria-selected') !== 'true') {
      allTab.click();
      await sleep(2000);
    }
    const res = await processDialog(dialog, tag);
    if (dialog.isConnected) closeDialog(dialog);
    await sleep(800);
    return res;
  }

  // ---------- modos ----------
  async function runOpenDialog() {
    const dialog = [...document.querySelectorAll('[role="dialog"]')].reverse()
      .find(d => d.querySelector('[role="tab"]'));
    if (!dialog) return ui('Abra antes a lista de reações de um post');
    settings = await send({ type: 'getSettings' }) || settings;
    running = true;
    const r = await processDialog(dialog);
    running = false;
    ui(`Concluído: ${r.invited} convidados (${r.status})`);
  }

  async function runFeed() {
    settings = await send({ type: 'getSettings' }) || settings;
    running = true;
    const SEL = '[aria-posinset], [role="article"]';
    const seen = new WeakSet();
    let posts = 0, total = 0, noNew = 0;
    while (running && noNew < 6) {
      const batch = [...document.querySelectorAll(SEL)]
        .filter(a => !seen.has(a) && !a.parentElement.closest(SEL));
      if (!batch.length) noNew++; else noNew = 0;
      for (const post of batch) {
        if (!running) break;
        seen.add(post);
        const trig = findTrigger(post);
        if (!trig) continue;
        posts++;
        const r = await openAndProcess(trig, `Feed · post ${posts} · total ${total} · `);
        total += r.invited;
        if (r.status === 'cap' || r.status === 'blocked') return;
        await sleep(settings.postPause * (0.5 + Math.random() * 0.5));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(3000);
    }
    const ended = running;
    running = false;
    ui(`${ended ? 'Fim do feed' : 'Parado'}: ${posts} posts, ${total} convidados`);
  }

  async function runJob() {
    const r = await send({ type: 'getJob' });
    if (!r || !r.job) return;
    settings = r.settings;
    running = true;
    ui('Procurando reações do post...');
    await sleep(3000);
    const trig = await waitFor(() => findTrigger(document), 25000, 1000);
    if (!running) return send({ type: 'jobDone', status: 'stopped' });
    if (!trig) {
      ui('Post sem lista de reações, pulando');
      return send({ type: 'jobDone', status: 'notrigger' });
    }
    const res = await openAndProcess(trig);
    send({ type: 'jobDone', status: res.status, invited: res.invited });
  }

  browser.runtime.onMessage.addListener(msg => {
    if (msg.cmd === 'stop') { running = false; ui('Parado'); return; }
    if (running) return Promise.resolve({ error: 'Já está rodando' });
    if (msg.cmd === 'runDialog') runOpenDialog();
    if (msg.cmd === 'runFeed') runFeed();
    return Promise.resolve({ ok: true });
  });

  runJob();
})();
