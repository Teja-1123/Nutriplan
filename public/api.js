/* Nourish & Nest – data layer.
   Replaces localStorage with the server API. Loads the signed-in user's data first,
   then starts the page script named in data-main. Pages marked data-auth="required"
   redirect to login when signed out. */
(function () {
  const tag = document.currentScript;
  const main = tag.dataset.main, authRequired = tag.dataset.auth === 'required';
  const FIELDS = { 'nn-saved': 'saved', 'nn-calendar-plans': 'plans', 'nn-plan': 'plan', 'nn-shopping-list': 'shopping', 'nn-recent-searches': 'recent', 'nn-pantry': 'pantry' };
  const cache = {}, queues = {};
  let user = null;

  async function api(path, options = {}) {
    const res = await fetch('/api' + path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.status = res.status; throw e; }
    return data;
  }
  window.nnApi = api;

  function toast(message) {
    const el = document.createElement('div');
    el.textContent = message;
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#213b32;color:#fff;padding:12px 18px;border-radius:12px;font:500 14px "DM Sans",sans-serif;z-index:9999';
    document.body.append(el);
    setTimeout(() => el.remove(), 3500);
  }

  // Drop-in replacement for the localStorage calls the page scripts already make
  window.store = {
    getItem(key) {
      const f = FIELDS[key];
      if (!f || !(f in cache)) return null;
      if (f === 'recent' && !cache.recent.length) return null; // lets the page show its default chips
      return JSON.stringify(cache[f]);
    },
    setItem(key, json) {
      const f = FIELDS[key];
      if (!f) return;
      cache[f] = JSON.parse(json);
      if (!user) { if (f === 'recent' || f === 'pantry') return; location.href = 'login.html'; return; } // guests can browse, not save
      // Writes for the same field are sent one after another so the last change always wins
      queues[f] = (queues[f] || Promise.resolve())
        .then(() => api('/data/' + f, { method: 'PUT', body: { value: cache[f] } }))
        .catch(e => { if (e.status === 401) location.href = 'login.html'; else toast('Could not save your changes. Check your connection.'); });
    }
  };

  /* ---------- Avatar + account menu  ---------- */
  let menu;
  function paint(el, u) {
    el.textContent = u.avatar || (u.name.trim()[0] || '?').toUpperCase();
    el.style.background = u.avatarColor || '#527462';
  }
  window.nnPaint = paint;
  window.nnRefreshAccount = function () {
    if (!user || !menu) return;
    const u = window.nnUser;
    document.querySelectorAll('.avatar-btn .avatar, .menu-head .avatar').forEach(el => paint(el, u));
    menu.querySelector('.menu-name').textContent = u.name;
  };

  function buildAccount() {
    const link = document.querySelector('#auth-link');
    if (!link) return;
    if (!user) { link.textContent = 'Sign in'; link.classList.add('signin-pill'); return; }

    const wrap = document.createElement('div');
    wrap.className = 'account';
    wrap.innerHTML = '<button type="button" class="avatar-btn" aria-haspopup="menu" aria-expanded="false" aria-label="Account menu"><span class="avatar"></span></button>';
    const btn = wrap.firstElementChild;

    menu = document.createElement('div');
    menu.className = 'account-menu'; menu.setAttribute('role', 'menu'); menu.hidden = true;
    menu.innerHTML = '<div class="menu-head"><span class="avatar"></span><div><span class="menu-name"></span><span class="menu-email"></span></div></div>' +
      '<a role="menuitem" href="profile.html">👤 Manage account</a>' +
      '<a role="menuitem" href="saved.html">♥ Saved recipes</a>' +
      '<a role="menuitem" href="planner.html">📅 Meal planner</a>' +
      '<a role="menuitem" href="pantry.html">🥕 Pantry match</a>' +
      '<a role="menuitem" href="shopping-list.html">🛒 Shopping list</a>' +
      '<div class="menu-sep"></div>' +
      '<button type="button" role="menuitem" class="menu-item" id="theme-item">🌙 Dark mode <span class="menu-pill"></span></button>' +
      '<div class="menu-sep"></div>' +
      '<button type="button" role="menuitem" class="menu-item danger" id="logout-item">↪ Log out</button>';
    document.body.append(menu);   // lives on <body> so the scrolling nav can never clip it
    menu.querySelector('.menu-email').textContent = user.email;
    link.replaceWith(wrap);
    window.nnRefreshAccount();

    const pill = menu.querySelector('.menu-pill');
    const showTheme = () => { pill.textContent = document.documentElement.dataset.theme === 'dark' ? 'On' : 'Off'; };
    showTheme();
    const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

    btn.onclick = e => {
      e.stopPropagation();
      if (!menu.hidden) return close();
      const r = btn.getBoundingClientRect();
      menu.style.top = (r.bottom + 10) + 'px';
      menu.style.right = Math.max(12, window.innerWidth - r.right) + 'px';
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    };
    document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, { passive: true });
    menu.querySelector('#theme-item').onclick = () => { window.nnToggleTheme(); showTheme(); };
    menu.querySelector('#logout-item').onclick = async () => {
      try { await api('/auth/logout', { method: 'POST', body: {} }); } finally { location.href = 'login.html'; }
    };
  }

  function greet() {
    const el = document.querySelector('.hero .eyebrow');
    if (!el || !user) return;
    const h = new Date().getHours();
    el.textContent = ('Good ' + (h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening') + ', ' + user.name.split(' ')[0]).toUpperCase();
  }

  async function init() {
    try { user = (await api('/me')).user; } catch { /* server unreachable */ }
    if (!user && authRequired) { location.replace('login.html'); return; }
    Object.assign(cache, { saved: [], plans: {}, plan: {}, shopping: [], recent: [], pantry: [] });
    if (user) {
      try { Object.assign(cache, await api('/data')); }
      catch (e) { if (e.status === 401) { location.replace('login.html'); return; } toast('Could not load your saved data.'); }
    }
    window.nnUser = user;
    buildAccount();
    greet();
    
    const load = list => { if (!list.length) return; const s = document.createElement('script'); s.src = list[0]; s.onload = () => load(list.slice(1)); document.body.append(s); };
    if (main) load(main.split(',').map(x => x.trim()));
  }
  init();
})();
