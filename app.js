/* Paria – cute to-do app with a monthly paid-access gate (works as an iPhone "Add to Home Screen" app) */
(function () {
  'use strict';
  const cfg = window.PARIA_CONFIG || {};
  const M = window.MESSAGES || { morning: ['Good morning, Paria 💗'], inspire: ['you are wonderful.'] };
  const $app = document.getElementById('app');
  const PRI = ['🌿', '🌼', '🔥'];
  const enc = new TextEncoder();

  /* ───────── storage ───────── */
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  /* ───────── helpers ───────── */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = sel => document.querySelector(sel);
  const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  // "today", protected against the phone clock being set backwards
  function today() {
    const t = dayNum(), m = LS.get('paria_maxday', 0), v = Math.max(t, m);
    if (v > m) LS.set('paria_maxday', v);
    return v;
  }
  const utcDate = n => new Date(n * 86400000);
  const shortDate = n => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(utcDate(n));
  const longDate = n => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(utcDate(n));
  const pick = list => list[((dayNum() % list.length) + list.length) % list.length];

  // Persian (Solar Hijri) date
  const FA_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const FA_DAYS = ['یکشنبه', 'دوشنبه', 'سه\u200cشنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']; // index = getUTCDay()
  const faDigits = s => String(s).replace(/\d/g, d => String.fromCharCode(0x06F0 + Number(d)));
  function toJalali(gy, gm, gd) {
    const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy;
    if (gy > 1600) { jy = 979; gy -= 1600; } else { jy = 0; gy -= 621; }
    const gy2 = gm > 2 ? gy + 1 : gy;
    let days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + gdm[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    let jm, jd;
    if (days < 186) { jm = 1 + Math.floor(days / 31); jd = 1 + days % 31; }
    else { jm = 7 + Math.floor((days - 186) / 30); jd = 1 + (days - 186) % 30; }
    return [jy, jm, jd];
  }
  function faDate(n) {
    const d = utcDate(n);
    const [jy, jm, jd] = toJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    return FA_DAYS[d.getUTCDay()] + ' ' + faDigits(jd) + ' ' + FA_MONTHS[jm - 1] + ' ' + faDigits(jy);
  }

  /* ───────── crypto ───────── */
  function b64(buf) { let s = ''; new Uint8Array(buf).forEach(b => s += String.fromCharCode(b)); return btoa(s); }
  function unb64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return unb64(s); };

  async function hashPw(pw, saltB64) {
    const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: unb64(saltB64), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return b64(bits);
  }

  // Activation code = PARIA1.<payload>.<signature>, signed by Pouya's private key (admin.html)
  async function verifyCode(code, username) {
    const parts = String(code).replace(/\s+/g, '').split('.');
    if (parts.length !== 3 || parts[0] !== 'PARIA1') return { ok: false, reason: 'format' };
    if (!cfg.PUBLIC_KEY) return { ok: false, reason: 'nokey' };
    const key = await crypto.subtle.importKey('jwk', cfg.PUBLIC_KEY, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const data = unb64u(parts[1]), sig = unb64u(parts[2]);
    const good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, data);
    if (!good) return { ok: false, reason: 'bad' };
    const p = JSON.parse(new TextDecoder().decode(data));
    if (p.u !== username) return { ok: false, reason: 'user', who: p.u };
    return { ok: true, until: p.e };
  }

  /* ───────── state ───────── */
  const S = {
    stage: 'boot', account: null, until: 0, tab: 0, filter: 0, sel: null,
    bad: false, scold: false, todos: [], newPri: 1, timer: null
  };
  const save = () => LS.set('paria_todos', S.todos);
  const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const smsHref = () => 'sms:' + String(cfg.SHAYAN_PHONE || '').replace(/\s+/g, '');
  const installHint = () => (isIOS() && !isStandalone())
    ? `<div class="install">📲 <b>Install first:</b> tap <b>Share</b> ⬆️ then <b>Add to Home Screen</b>. Then open Paria from your Home Screen and create your account there.</div>` : '';

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  async function copyText(txt) {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0;left:-999px'; document.body.appendChild(ta);
      ta.focus(); ta.select(); ta.setSelectionRange(0, 99999);
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove(); return ok;
    }
  }
  function screen(html) { clearTimeout(S.timer); closeModal(); $app.innerHTML = '<div class="screen">' + html + '</div>'; window.scrollTo(0, 0); }

  /* ───────── routing ───────── */
  async function refreshLicense() {
    S.until = 0;
    const code = LS.get('paria_code', '');
    if (code && S.account) { try { const r = await verifyCode(code, S.account.username); if (r.ok) S.until = r.until; } catch (e) {} }
  }
  async function route() {
    if (!S.account) return showRegister();
    if (!LS.get('paria_loggedin', false)) return showLogin();
    await refreshLicense();
    if (!S.until || S.until < today()) return showPay(false);
    syncPush(true);
    S.scold = false; S.bad = false; S.tab = 0; S.sel = null;
    showAsk();
  }

  /* ───────── auth screens ───────── */
  function showRegister() {
    S.stage = 'register';
    screen(`<div class="card"><span class="big-emoji">🌸</span>
      <h1 class="display">Welcome to Paria 💗</h1>
      <p class="sub">Create your account to get started</p>
      <input class="field" id="u" placeholder="Choose a username" autocapitalize="none" autocomplete="username" autocorrect="off" spellcheck="false" maxlength="24">
      <input class="field" id="p1" type="password" placeholder="Password (at least 6 characters)" autocomplete="new-password">
      <input class="field" id="p2" type="password" placeholder="Repeat the password" autocomplete="new-password">
      <div class="err" id="err"></div>
      <button class="btn" data-act="register">Create my account</button></div>${installHint()}`);
  }
  function showLogin() {
    S.stage = 'login';
    screen(`<div class="card"><span class="big-emoji">💗</span>
      <h1 class="display">Hello again!</h1>
      <input class="field" id="u" placeholder="Username" value="${esc(S.account.username)}" autocapitalize="none" autocomplete="username" autocorrect="off" spellcheck="false">
      <input class="field" id="p1" type="password" placeholder="Password" autocomplete="current-password">
      <div class="err" id="err"></div>
      <button class="btn" data-act="login">Log in</button>
      <button class="link" data-act="forgot">Forgot my password</button></div>${installHint()}`);
  }
  async function doRegister() {
    const u = $('#u').value.trim().toLowerCase(), p1 = $('#p1').value, p2 = $('#p2').value, err = $('#err');
    if (!/^[a-z0-9_.]{3,24}$/.test(u)) { err.textContent = 'Username: 3–24 letters, numbers, dots or underscores.'; return; }
    if (p1.length < 6) { err.textContent = 'The password needs at least 6 characters.'; return; }
    if (p1 !== p2) { err.textContent = "The two passwords don't match."; return; }
    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await hashPw(p1, salt);
    S.account = { username: u, salt, hash };
    LS.set('paria_account', S.account); LS.set('paria_loggedin', true);
    route();
  }
  async function doLogin() {
    const u = $('#u').value.trim().toLowerCase(), p = $('#p1').value, err = $('#err');
    const ok = u === S.account.username && (await hashPw(p, S.account.salt)) === S.account.hash;
    if (!ok) { err.textContent = 'Wrong username or password 🙈'; return; }
    LS.set('paria_loggedin', true); route();
  }

  /* ───────── payment / activation ───────── */
  function showPay(canGoBack) {
    S.stage = 'pay';
    screen(`${canGoBack ? '<button class="link" data-act="backHome" style="align-self:flex-start">← Back</button>' : ''}
      <div class="card"><span class="big-emoji">💳</span>
      <h2 class="display">Almost there, ${esc(S.account.username)} 💗</h2>
      <p>Pay Pouya to get credit for 1 month and send the receipt to Pouya's Telegram.</p>
      <div class="copyrow" data-copy="price"><div><span class="lbl">Price</span><span class="val">${esc(cfg.PRICE_TEXT || '')}</span></div><span class="tap">tap to copy 📋</span></div>
      <div class="copyrow" data-copy="card"><div><span class="lbl">Card number</span><span class="val">${esc(cfg.CARD_TEXT || '')}</span></div><span class="tap">tap to copy 📋</span></div>
      <a class="btn" style="margin-top:14px" href="https://t.me/${esc(cfg.TELEGRAM_USERNAME || '')}" target="_blank" rel="noopener">Open Pouya's Telegram ✈️</a>
      <button class="btn ghost" data-act="copyreq">Copy my request message 📋</button>
      <hr>
      <p class="sub">When Pouya has seen your receipt he will send you an activation code. Paste it here:</p>
      <textarea class="field" id="code" placeholder="PARIA1.…" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="off"></textarea>
      <div class="err" id="err"></div>
      <button class="btn" data-act="activate">Unlock for 1 month 🔓</button>
      <button class="link" data-act="logout">Log out</button></div>`);
  }
  async function doActivate() {
    const raw = $('#code').value, err = $('#err');
    if (!raw.trim()) { err.textContent = 'Paste the code that Pouya sent you.'; return; }
    try {
      const r = await verifyCode(raw, S.account.username);
      if (!r.ok) {
        err.textContent = {
          format: "That doesn't look like a code. Paste the whole code from Pouya.",
          nokey: "This app isn't ready for codes yet. Pouya still has to finish the setup.",
          bad: "That code isn't valid. Please copy it again.",
          user: `That code is for the username “${r.who}”, but you are “${S.account.username}”.`
        }[r.reason] || 'That code did not work.';
        return;
      }
      if (r.until < today()) { err.textContent = 'That code has already expired. Ask Pouya for a new one.'; return; }
      LS.set('paria_code', raw.replace(/\s+/g, '')); S.until = Math.max(S.until, r.until);
      toast('Unlocked! 💗');
      syncPush(true, true);
      S.scold = false; S.bad = false; S.tab = 0; S.sel = null;
      showAsk();
    } catch (e) { err.textContent = 'Something went wrong. Please try again.'; }
  }

  /* ───────── page 1 & 2 ───────── */
  function showAsk() {
    S.stage = 'ask';
    if (S.scold) {
      screen(`<div class="card"><span class="big-emoji">😑</span><h1 class="display">bring my life, her name is Paria😑</h1></div>`);
      S.timer = setTimeout(() => { S.scold = false; showAsk(); }, 2400); return;
    }
    screen(`<div class="card"><span class="big-emoji">🌸</span><h1 class="display">Hey ... Are you Paria 🤨 ?</h1>
      <div class="row2"><button class="btn" data-act="yes">yes</button><button class="btn ghost" data-act="no">no</button></div></div>`);
  }
  function showMood() {
    S.stage = 'mood';
    if (S.bad) {
      screen(`<div class="card"><span class="big-emoji">☹️</span><h2 class="display">why?! ☹️You have to text Shayan. Hurry!</h2>
        <a class="btn" data-act="afterSms" href="${esc(smsHref())}">Text Shayan😍</a></div>`);
      return;
    }
    screen(`<div class="card"><span class="big-emoji">😍</span><h1 class="display">Hello my love 😍, how are you today? </h1>
      <div class="row2"><button class="btn" data-act="amazing">amazing</button><button class="btn ghost" data-act="bad">bad</button></div></div>`);
  }

  /* ───────── page 3: to-do + history ───────── */
  const navHTML = () => `<nav class="nav"><div class="in">
    <button data-act="tab0" class="${S.tab === 0 ? 'on' : ''}"><b>✅</b>To do</button>
    <button data-act="tab1" class="${S.tab === 1 ? 'on' : ''}"><b>📅</b>History</button></div></nav>`;
  const addbarHTML = () => `<div class="addbar"><div class="legend">🌿 easy · 🌼 normal · 🔥 important (tap the emoji to change)</div>
    <div class="addrow"><button class="round" id="newpri" data-act="newpri">${PRI[S.newPri]}</button>
    <input class="field" id="newtext" placeholder="Add something lovely to do…" enterkeyhint="done" autocomplete="off" maxlength="200">
    <button class="round go" data-act="add" aria-label="Add task">+</button></div></div>`;
  const rowHTML = (t, note) => `<div class="row ${t.done ? 'done' : ''}" data-id="${t.id}">
    <button class="chk" data-act="toggle" aria-label="Done">${t.done ? '✓' : ''}</button>
    <button class="pri" data-act="pri">${PRI[Math.min(2, Math.max(0, t.p))]}</button>
    <div class="txt"><div class="title">${esc(t.title)}</div>${note ? `<div class="note">${esc(note)}</div>` : ''}</div>
    <button class="del" data-act="del" aria-label="Delete">🗑</button></div>`;

  function showHome() {
    S.stage = 'home';
    if (S.sel == null) S.sel = today();
    clearTimeout(S.timer); closeModal();
    $app.innerHTML = '<div class="home" id="home"></div>' + navHTML();
    window.scrollTo(0, 0);
    S.tab === 0 ? fillToday() : fillHistory();
  }
  const rerender = () => (S.tab === 0 ? renderToday() : renderHistory());

  function fillToday() {
    const t = today();
    $('#home').innerHTML = `
      <div class="card"><div class="date-fa">${esc(faDate(t))}</div><div class="date-en">${esc(longDate(t))}</div>
        <div class="hey">Hey my dear Paria, ${esc(pick(M.inspire))}</div></div>
      <div class="actions"><a class="btn" href="${esc(smsHref())}">Text Shayan 💬</a><button class="round" data-act="settings" aria-label="Settings">⚙️</button></div>
      <div id="prog"></div><div class="chips" id="filters"></div><div class="list" id="list"></div>${addbarHTML()}`;
    renderToday();
  }
  function renderToday() {
    const t = today();
    const shown = S.todos.filter(x => x.day === t || x.dd === t || (!x.done && x.day < t));
    const done = shown.filter(x => x.done).length, total = shown.length;
    $('#prog').innerHTML = `<div class="prog"><div class="top"><span>${total && done === total ? 'All done! So proud of you 🥳' : "Today's progress"}</span><span>${done} / ${total} 💖</span></div>
      <div class="bar"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div></div>`;
    $('#filters').innerHTML = [['All', total], ['To do', total - done], ['Done', done]]
      .map((c, i) => `<button class="chip ${S.filter === i ? 'on' : ''}" data-act="filter" data-i="${i}">${c[0]}  ${c[1]}</button>`).join('');
    let vis = S.filter === 1 ? shown.filter(x => !x.done) : S.filter === 2 ? shown.filter(x => x.done) : shown.slice();
    vis.sort((a, b) => a.done - b.done);
    $('#list').innerHTML = vis.length
      ? vis.map(x => rowHTML(x, x.day < t ? 'from ' + shortDate(x.day) : '')).join('')
      : `<div class="empty"><span class="big-emoji">🌷</span><p>${total ? 'Nothing in this list 🌸' : 'Nothing here yet.<br>Add something small and lovely 💗'}</p></div>`;
  }

  function fillHistory() {
    $('#home').innerHTML = `
      <div class="card"><div class="hhead"><button class="round" data-act="prev" aria-label="Previous day">◀</button>
        <div class="mid"><div class="date-fa" id="hfa"></div><div class="date-en" id="hen"></div><div class="rel" id="hrel"></div></div>
        <button class="round" data-act="next" aria-label="Next day">▶</button></div></div>
      <div class="row2" style="margin-top:10px"><label class="btn pick">📅 Pick a date<input type="date" id="pickdate"></label>
        <button class="btn ghost" data-act="gotoday" style="flex:.6">Today</button></div>
      <div class="chips" id="dayChips"></div><div class="list" id="hlist"></div>${addbarHTML()}`;
    renderHistory();
  }
  function renderHistory() {
    const t = today(), sel = S.sel;
    $('#hfa').textContent = faDate(sel); $('#hen').textContent = longDate(sel);
    const d = sel - t; $('#hrel').textContent = d === 0 ? 'Today' : d === -1 ? 'Yesterday' : d === 1 ? 'Tomorrow' : '';
    const days = [...new Set(S.todos.flatMap(x => [x.day, x.dd]).filter(x => x >= 0))].sort((a, b) => b - a).slice(0, 30);
    $('#dayChips').innerHTML = days.map(x => `<button class="chip ${x === sel ? 'on' : ''}" data-act="chip" data-day="${x}">${esc(shortDate(x))}</button>`).join('');
    const doneThat = S.todos.filter(x => x.dd === sel);
    const planned = S.todos.filter(x => x.day === sel && x.dd !== sel);
    let html = '';
    if (!doneThat.length && !planned.length) html += `<div class="empty"><span class="big-emoji">🌸</span><p>Nothing recorded for this day.<br>You can add something below 💗</p></div>`;
    if (doneThat.length) html += `<div class="sect">Done ✅  ${doneThat.length}</div>` + doneThat.map(x => rowHTML(x, x.day !== sel ? 'planned for ' + shortDate(x.day) : '')).join('');
    if (planned.length) html += `<div class="sect">Planned 📝  ${planned.length}</div>` + planned.map(x => rowHTML(x, x.done ? '✓ finished on ' + shortDate(x.dd) : '')).join('');
    $('#hlist').innerHTML = html;
  }

  function addTodo() {
    const el = $('#newtext'); const title = el.value.trim(); if (!title) return;
    S.todos.unshift({ id: Date.now() * 1000 + Math.floor(Math.random() * 1000), title, p: S.newPri, done: false, day: S.tab === 0 ? today() : S.sel, dd: -1 });
    el.value = ''; save(); rerender(); el.focus();
  }

  /* ───────── settings & notifications ───────── */
  function closeModal() { const m = $('#modal'); if (m) m.remove(); }
  function showSettings() {
    const left = S.until - today();
    document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="modal"><div class="card">
      <h3>Little settings ⚙️</h3>
      <p>👤 <b>${esc(S.account.username)}</b></p>
      <div class="note-box">🔓 Access until <b>${esc(longDate(S.until))}</b> (${left} day${left === 1 ? '' : 's'} left)</div>
      <div class="note-box">💌 Today's note:<br>${esc(pick(M.morning))}</div>
      <button class="btn" data-act="enablePush">Turn on good-morning notifications 🔔</button>
      <button class="btn ghost" data-act="testPush">Send a test note 💌</button>
      <button class="btn ghost" data-act="renew">Renew / enter a new code 🔑</button>
      <button class="btn ghost" data-act="logout">Log out</button>
      <button class="link" data-act="closeModal">Close</button></div></div>`);
  }
  function initPush() {
    if (!cfg.ONESIGNAL_APP_ID) return;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    const s = document.createElement('script');
    s.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'; s.defer = true; document.head.appendChild(s);
    const base = location.pathname.replace(/[^/]*$/, '');
    window.OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({ appId: cfg.ONESIGNAL_APP_ID, serviceWorkerPath: base + 'sw.js', serviceWorkerParam: { scope: base }, allowLocalhostAsSecureOrigin: true, notifyButton: { enable: false } });
        window._os = OneSignal;
      } catch (e) {}
    });
  }
  // Keep the push subscription in line with the paid access
  function syncPush(active, fromActivation) {
    try {
      if (!window._os) return;
      if (active) {
        if (S.account) window._os.User.addTag('username', S.account.username);
        if (window.Notification && Notification.permission === 'granted') window._os.User.PushSubscription.optIn();
      } else window._os.User.PushSubscription.optOut();
    } catch (e) {}
  }
  async function enablePush() {
    if (!('Notification' in window)) { toast('Add Paria to your Home Screen first 📲 (Share ▸ Add to Home Screen)'); return; }
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications are off. Turn them on in iPhone Settings ▸ Notifications ▸ Paria'); return; }
    syncPush(true);
    try { if (window._os) await window._os.User.PushSubscription.optIn(); } catch (e) {}
    toast('Good-morning notifications are on 💗');
  }
  async function testPush() {
    if (!('Notification' in window)) { toast('Add Paria to your Home Screen first 📲 (Share ▸ Add to Home Screen)'); return; }
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') { toast('Notifications are off. Turn them on in iPhone Settings ▸ Notifications ▸ Paria'); return; }
    const opts = { body: pick(M.morning), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) await reg.showNotification('Good morning, Paria ☀️💗', opts); else new Notification('Good morning, Paria ☀️💗', opts);
    } catch (e) { toast('Could not show a notification here'); }
  }

  /* ───────── events ───────── */
  document.addEventListener('click', async function (e) {
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const which = cp.dataset.copy;
      const ok = await copyText(which === 'card' ? cfg.CARD_COPY : cfg.PRICE_COPY);
      toast(ok ? (which === 'card' ? 'Card number copied ✓' : 'Price copied ✓') : 'Could not copy, please long-press the text');
      return;
    }
    if (e.target.id === 'modal') return closeModal();
    const a = e.target.closest('[data-act]'); if (!a) return;
    const act = a.dataset.act, row = a.closest('.row'), id = row ? Number(row.dataset.id) : null;
    switch (act) {
      case 'register': return doRegister();
      case 'login': return doLogin();
      case 'forgot':
        if (confirm('Reset the account on this phone? You will create a new username and password. Your tasks stay.')) {
          LS.del('paria_account'); LS.del('paria_loggedin'); S.account = null; showRegister();
        } return;
      case 'logout': closeModal(); LS.set('paria_loggedin', false); syncPush(false); return showLogin();
      case 'copyreq': {
        const msg = `Hi Pouya 💗 This is Paria. I paid for 1 month, the receipt is attached. My username: ${S.account.username}`;
        toast((await copyText(msg)) ? 'Message copied ✓ now paste it in Telegram' : 'Could not copy'); return;
      }
      case 'activate': return doActivate();
      case 'backHome': return showHome();
      case 'renew': closeModal(); return showPay(true);
      case 'yes': S.stage = 'mood'; S.bad = false; return showMood();
      case 'no': S.scold = true; return showAsk();
      case 'amazing': S.tab = 0; return showHome();
      case 'bad': S.bad = true; return showMood();
      case 'afterSms': setTimeout(() => { S.bad = false; showMood(); }, 700); return;
      case 'tab0': S.tab = 0; return showHome();
      case 'tab1': S.tab = 1; S.sel = today(); return showHome();
      case 'settings': return showSettings();
      case 'closeModal': return closeModal();
      case 'enablePush': return enablePush();
      case 'testPush': return testPush();
      case 'filter': S.filter = Number(a.dataset.i); return renderToday();
      case 'newpri': S.newPri = (S.newPri + 1) % 3; a.textContent = PRI[S.newPri]; return;
      case 'add': return addTodo();
      case 'toggle': { const t = S.todos.find(x => x.id === id); if (!t) return; t.done = !t.done; t.dd = t.done ? (S.tab === 0 ? today() : S.sel) : -1; save(); return rerender(); }
      case 'pri': { const t = S.todos.find(x => x.id === id); if (!t) return; t.p = (t.p + 1) % 3; save(); return rerender(); }
      case 'del': S.todos = S.todos.filter(x => x.id !== id); save(); return rerender();
      case 'prev': S.sel -= 1; return renderHistory();
      case 'next': S.sel += 1; return renderHistory();
      case 'gotoday': S.sel = today(); return renderHistory();
      case 'chip': S.sel = Number(a.dataset.day); return renderHistory();
    }
  });
  document.addEventListener('change', function (e) {
    if (e.target.id === 'pickdate' && e.target.value) {
      const [y, m, d] = e.target.value.split('-').map(Number);
      S.sel = Math.floor(Date.UTC(y, m - 1, d) / 86400000); renderHistory();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.id === 'newtext') { e.preventDefault(); addTodo(); }
    if (e.key === 'Enter' && e.target.id === 'p1' && S.stage === 'login') doLogin();
  });
  // when she comes back to the app, make sure her month is still paid
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !S.account || !['ask', 'mood', 'home'].includes(S.stage)) return;
    if (S.until < today()) { syncPush(false); showPay(false); }
  });

  /* ───────── background flowers ───────── */
  function startFlowers() {
    const c = $('#bg'), ctx = c.getContext('2d'); if (!ctx) return;
    let seed = 11; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const fl = Array.from({ length: 18 }, () => ({ x: rnd(), y: rnd(), r: 22 + rnd() * 40, ph: rnd() * 360, dir: rnd() > .5 ? 1 : -1 }));
    let w, h, dpr;
    const resize = () => { dpr = window.devicePixelRatio || 1; w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const flower = (x, y, r, rot) => {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) { const a = (rot + i * 60) * Math.PI / 180; ctx.beginPath(); ctx.arc(x + r * .55 * Math.cos(a), y + r * .55 * Math.sin(a), r * .5, 0, 6.2832); ctx.fill(); }
      ctx.fillStyle = '#FFE9A8'; ctx.beginPath(); ctx.arc(x, y, r * .3, 0, 6.2832); ctx.fill();
    };
    const calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const draw = ts => {
      ctx.clearRect(0, 0, w, h);
      const spin = (ts / 70000 % 1) * 360, bob = Math.sin(ts / 5000 * Math.PI);
      fl.forEach(f => flower(f.x * w, f.y * h + bob * 13 * f.dir, f.r, spin * f.dir + f.ph));
      if (!calm && !document.hidden) requestAnimationFrame(draw);
    };
    resize(); addEventListener('resize', () => { resize(); if (calm) draw(0); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !calm) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  /* ───────── start ───────── */
  if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  initPush();
  S.account = LS.get('paria_account', null);
  S.todos = LS.get('paria_todos', []);
  startFlowers();
  route();
})();
