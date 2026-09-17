/* ==========================================================================
   ביגי ספקים — לוגיקת אתר משותפת
   ========================================================================== */

(function(){

  /* ---------- Helpers ---------- */
  const $  = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const starsHtml = (rating) => {
    const full = Math.round(rating);
    let html = '';
    for(let i=0;i<5;i++){
      html += `<span class="star-anim" style="animation-delay:${i*70}ms">${i < full ? '★' : '☆'}</span>`;
    }
    return html;
  };
  const emojiForCat = (id) => (CATEGORIES.find(c=>c.id===id) || {}).icon || '⭐';
  const nameForCat = (id) => (CATEGORIES.find(c=>c.id===id) || {}).name || '';
  // Sample suppliers have numeric ids; profiles published from the admin area have string ids.
  const idOf = (raw) => /^\d+$/.test(String(raw)) ? Number(raw) : String(raw);
  const findVendor = (id) => VENDORS.find(v => v.id === id);
  // Suppliers switched to "demo" are only sent to admins (flagged hidden) and never listed.
  const listedVendors = () => VENDORS.filter(v => !v.hidden);
  const profileUrl = (v) => v.url || `vendor.html?id=${encodeURIComponent(v.id)}`;
  const formatPrice = (n) => `₪${Number(n).toLocaleString('he-IL')}`;

  /* ---------- Compare state (localStorage) ---------- */
  const CompareStore = {
    key: 'bigi_compare',
    get(){ try{ return JSON.parse(localStorage.getItem(this.key)) || []; }catch(e){ return []; } },
    set(list){ localStorage.setItem(this.key, JSON.stringify(list)); document.dispatchEvent(new CustomEvent('compare:change')); },
    add(id){ const l = this.get(); if(!l.includes(id) && l.length < 4){ l.push(id); this.set(l);} return this.get(); },
    remove(id){ this.set(this.get().filter(x=>x!==id)); },
    has(id){ return this.get().includes(id); },
    clear(){ this.set([]); }
  };
  window.CompareStore = CompareStore;

  /* ---------- Favorites state (localStorage) ---------- */
  const FavoritesStore = {
    key: 'bigi_favorites',
    get(){ try{ return JSON.parse(localStorage.getItem(this.key)) || []; }catch(e){ return []; } },
    set(list){ localStorage.setItem(this.key, JSON.stringify(list)); document.dispatchEvent(new CustomEvent('favorites:change')); },
    add(id){ const l = this.get(); if(!l.includes(id)){ l.push(id); this.set(l);} return this.get(); },
    remove(id){ this.set(this.get().filter(x=>x!==id)); },
    toggle(id){ this.has(id) ? this.remove(id) : this.add(id); },
    has(id){ return this.get().includes(id); },
    clear(){ this.set([]); }
  };
  window.FavoritesStore = FavoritesStore;

  /* ---------- Server calls ---------- */
  async function api(url, { method = 'GET', json, formData } = {}){
    const options = { method, credentials: 'same-origin', headers: {} };
    if(json !== undefined){ options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(json); }
    if(formData) options.body = formData;
    try{
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    }catch(e){
      return { ok: false, status: 0, data: { error: 'אין חיבור לשרת. בדקו את האינטרנט ונסו שוב.' } };
    }
  }

  // Only same-site paths are allowed as a redirect target after login.
  function safeNext(raw){
    const next = String(raw || '');
    return /^\/(?!\/)[\w\-./?=&%]*$/.test(next) || /^[\w-]+\.html(\?[\w\-=&%.]*)?$/.test(next) ? next : '';
  }

  /* ---------- Signed-in account (server session) ---------- */
  const Account = {
    user: null,
    loaded: false,
    hintKey: 'bigi_account_hint',
    // Last known name/role, so the header doesn't flash "התחברות" while the real check runs.
    hint(){ try{ return JSON.parse(localStorage.getItem(this.hintKey)); }catch(e){ return null; } },
    set(user){
      this.user = user;
      this.loaded = true;
      try{
        if(user) localStorage.setItem(this.hintKey, JSON.stringify({ name: user.name, role: user.role, isAdmin: user.isAdmin }));
        else localStorage.removeItem(this.hintKey);
      }catch(e){}
      document.dispatchEvent(new CustomEvent('account:change'));
    },
    async refresh(){
      const { ok, data } = await api('/api/auth/me');
      if(ok) this.set(data.user || null);
      else { this.loaded = true; document.dispatchEvent(new CustomEvent('account:change')); }
      return this.user;
    },
    ready(){
      if(this.loaded) return Promise.resolve(this.user);
      return new Promise(resolve => document.addEventListener('account:change', () => resolve(this.user), { once: true }));
    },
    async logout(){
      await api('/api/auth/logout', { method: 'POST' });
      this.set(null);
    }
  };

  /* ---------- WhatsApp helper ---------- */
  function whatsappLink(vendor, message){
    const msg = encodeURIComponent(message || `שלום ${vendor.name}, מצאתי אתכם בביגי ספקים ורציתי לשאול לגבי זמינות ומחיר ל${vendor.tag}.`);
    return `https://wa.me/${vendor.phone}?text=${msg}`;
  }
  const whatsappIconSvg = `<svg viewBox="0 0 32 32" fill="currentColor" width="18" height="18"><path d="M16.03 3C9.13 3 3.53 8.6 3.53 15.5c0 2.36.65 4.56 1.78 6.45L3 29l7.24-2.26a12.4 12.4 0 0 0 5.79 1.44h.01c6.9 0 12.5-5.6 12.5-12.5S22.93 3 16.03 3zm0 22.6h-.01a10.4 10.4 0 0 1-5.3-1.45l-.38-.22-4.3 1.34 1.37-4.2-.25-.4a10.32 10.32 0 0 1-1.6-5.57c0-5.75 4.68-10.43 10.44-10.43 2.79 0 5.4 1.09 7.38 3.06a10.35 10.35 0 0 1 3.05 7.38c0 5.75-4.68 10.43-10.4 10.43zm5.72-7.82c-.31-.16-1.86-.92-2.15-1.02-.29-.1-.5-.16-.71.16-.21.31-.82 1.02-1 1.23-.19.21-.37.23-.68.08-.31-.16-1.32-.49-2.51-1.56-.93-.83-1.56-1.85-1.74-2.16-.18-.31-.02-.48.14-.63.14-.14.31-.37.47-.55.16-.19.21-.31.31-.52.1-.21.05-.39-.02-.55-.08-.16-.71-1.72-.98-2.36-.26-.62-.52-.54-.71-.55h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.62 0 1.54 1.13 3.03 1.29 3.24.16.21 2.22 3.39 5.38 4.75.75.33 1.34.52 1.8.66.76.24 1.44.21 1.99.13.61-.09 1.86-.76 2.12-1.5.26-.73.26-1.36.18-1.5-.08-.13-.29-.21-.6-.37z"/></svg>`;
  const heartIconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.6-4.6-10.2-9.6C.2 7.2 2.4 3.2 6.6 3.2c2.1 0 3.7 1.1 5.4 3 1.7-1.9 3.3-3 5.4-3 4.2 0 6.4 4 4.8 8.2C19.6 16.4 12 21 12 21z" stroke-linejoin="round"/></svg>`;

  /* ---------- Ripple effect on buttons ---------- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if(!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
    ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
    btn.appendChild(ripple);
    setTimeout(()=>ripple.remove(), 650);
  });

  /* ---------- Mobile nav toggle ---------- */
  const navToggle = $('.nav-toggle');
  const mainNav = $('.main-nav');
  if(navToggle && mainNav){
    const setMenu = (open) => {
      mainNav.style.cssText = open
        ? 'display:flex;position:absolute;top:calc(var(--header-h) + 6px);right:16px;left:16px;background:#fff;flex-direction:column;align-items:stretch;padding:12px;border-radius:16px;box-shadow:0 10px 30px rgba(26,23,48,0.15);z-index:250;'
        : '';
      navToggle.setAttribute('aria-expanded', String(open));
    };
    navToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenu(mainNav.style.display !== 'flex');
    });
    document.addEventListener('click', (e) => {
      if(mainNav.style.display === 'flex' && !mainNav.contains(e.target)) setMenu(false);
    });
  }

  /* ---------- Reveal on scroll + stagger ---------- */
  function initReveal(){
    const items = $$('.reveal');
    if(!items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    items.forEach(el => io.observe(el));

    $$('.reveal-stagger').forEach(group => {
      Array.from(group.children).forEach((child, i) => child.style.setProperty('--stagger-i', i));
    });
  }

  /* ---------- Count-up with spring/bounce easing ---------- */
  function springEase(t){
    return 1 - Math.pow(2, -9 * t) * Math.cos((t - 0.06) * 22);
  }
  function animateCount(el, target, decimals=0, suffix=''){
    const duration = 1400;
    const start = performance.now();
    function tick(now){
      const p = Math.min((now - start) / duration, 1);
      const eased = p < 1 ? springEase(p) : 1;
      const val = target * eased;
      el.textContent = (decimals ? val.toFixed(decimals) : Math.max(0, Math.round(val)).toLocaleString('he-IL')) + suffix;
      if(p < 1) requestAnimationFrame(tick);
      else el.textContent = (decimals ? target.toFixed(decimals) : target.toLocaleString('he-IL')) + suffix;
    }
    requestAnimationFrame(tick);
  }
  function initStats(){
    const grid = $('#stats-grid');
    if(!grid) return;
    grid.innerHTML = STATS.map(s => `
      <div class="stat-item reveal">
        <strong data-count data-target="${s.value}" data-decimals="${s.decimals||0}" data-suffix="${s.suffix}">0</strong>
        <span>${s.label.includes('היום') ? '<span class="live-dot"></span>' : ''}${s.label}</span>
      </div>
    `).join('');
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          const num = entry.target.querySelector('[data-count]');
          if(num) animateCount(num, parseFloat(num.dataset.target), parseInt(num.dataset.decimals), num.dataset.suffix);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    $$('.stat-item', grid).forEach(el => io.observe(el));
  }

  /* ---------- Categories grid (home) ---------- */
  function initCategories(){
    const grid = $('#cat-grid');
    if(!grid) return;
    grid.innerHTML = CATEGORIES.map(c => `
      <a href="vendors.html?cat=${c.id}" class="cat-card ${c.grad} reveal">
        <div class="cat-icon">${c.icon}</div>
        <h4>${c.name}</h4>
        <span>${c.count} ספקים</span>
      </a>
    `).join('');
  }

  /* ---------- Hero search (home) — passes query to the vendors listing ---------- */
  function initHeroSearch(){
    const btn = $('#hero-search-btn');
    if(!btn) return;
    const go = () => {
      const q = $('#search-what')?.value.trim() || '';
      const city = $('#search-where')?.value || '';
      const params = new URLSearchParams();
      if(q) params.set('q', q);
      if(city) params.set('city', city);
      const qs = params.toString();
      location.href = 'vendors.html' + (qs ? '?' + qs : '');
    };
    btn.addEventListener('click', (e) => { e.preventDefault(); go(); });
    $('#search-what')?.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); go(); }
    });
  }

  /* ---------- Header: "התחברות" or the person's name with a menu.
     Admin links start out hidden in the markup and only appear for an
     account the server confirms is an admin. ---------- */
  function renderAccountUI(user){
    $$('[data-auth-guest]').forEach(el => el.hidden = !!user);
    $$('[data-auth-user]').forEach(el => el.hidden = !user);
    $$('[data-role-supplier]').forEach(el => el.hidden = !(user && user.role === 'supplier'));
    $$('[data-admin-only]').forEach(el => el.hidden = !(user && user.isAdmin));
    $$('[data-admin-confirm]').forEach(el => el.hidden = !(user && user.adminPending));
    if(!user) return;
    $$('.account-name').forEach(el => el.textContent = user.name);
    $$('.account-btn').forEach(el => el.setAttribute('aria-label', `החשבון של ${user.name}`));
    $$('.account-avatar').forEach(el => el.textContent = (user.name || '?').trim().charAt(0));
    $$('.account-email').forEach(el => el.textContent = user.email || '');
  }
  document.addEventListener('account:change', () => renderAccountUI(Account.user));

  function initAccountMenu(){
    const menu = $('.account-menu');
    if(!menu) return;
    const btn = $('.account-btn', menu);
    const dropdown = $('.account-dropdown', menu);
    const setOpen = (open) => {
      dropdown.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', (e) => { e.stopPropagation(); setOpen(dropdown.hidden); });
    document.addEventListener('click', (e) => { if(!dropdown.hidden && !menu.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', (e) => { if(e.key === 'Escape' && !dropdown.hidden){ setOpen(false); btn.focus(); } });

    $('[data-logout]', menu)?.addEventListener('click', async () => {
      await Account.logout();
      location.href = 'index.html';
    });

    const confirmBtn = $('[data-admin-confirm]', menu);
    confirmBtn?.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      const { ok, data } = await api('/api/auth/admin-confirmation', { method: 'POST' });
      confirmBtn.textContent = ok ? '✓ נשלח קישור אישור (בתוקף ל־60 דקות)' : (data.error || 'השליחה נכשלה');
      setTimeout(() => { confirmBtn.disabled = false; confirmBtn.textContent = '🔐 שליחת קישור לאישור הרשאות מנהל'; }, 5000);
    });
  }

  /* ---------- Deals section (home) ---------- */
  function initDeals(){
    const grid = $('#deals-grid');
    if(!grid) return;
    const deals = listedVendors().filter(v => v.badge && v.priceFrom != null).slice(0, 3);
    const badgeClass = { 'מומלץ':'badge-top', 'זמין השבוע':'badge-hot', 'חדש':'badge-new' };
    grid.innerHTML = deals.map(v => `
      <div class="deal-card reveal">
        <div class="deal-media ${v.grad}">
          <span class="badge ${badgeClass[v.badge]}">${esc(v.badge)}</span>
          ${esc(v.emoji)}
        </div>
        <div class="deal-body">
          <h4>${esc(v.name)}</h4>
          <p>${esc(v.tag)} · ${esc(v.city)}</p>
          <div class="deal-price"><strong>${formatPrice(v.priceFrom)}</strong><span>החל מ־</span></div>
        </div>
      </div>
    `).join('');
  }

  /* ---------- Vendor card template ---------- */
  function vendorCardHtml(v, index=0){
    const badgeClass = { 'מומלץ':'badge-top', 'זמין השבוע':'badge-hot', 'חדש':'badge-new' };
    const isFav = FavoritesStore.has(v.id);
    const id = esc(v.id);
    const tagLine = [v.tag, v.city].filter(Boolean).map(esc).join(' · ');
    return `
    <div class="vendor-card stagger-in" style="animation-delay:${(index%9)*60}ms" data-vendor-id="${id}">
      <div class="vendor-media ${v.image ? 'has-photo' : v.grad}"${v.image ? ` style="background-image:url('${esc(encodeURI(v.image).replace(/'/g, '%27'))}')"` : ''}>
        ${v.badge ? `<span class="badge ${badgeClass[v.badge] || 'badge-new'}">${esc(v.badge)}</span>` : ''}
        <button class="vendor-fav ${isFav?'active':''}" aria-label="הוסף למועדפים" data-fav="${id}">${isFav?'❤️':'🤍'}</button>
        <button class="vendor-compare-btn ${CompareStore.has(v.id)?'active':''}" data-compare="${id}">⇄ השוואה</button>
        ${v.image ? '' : esc(v.emoji)}
      </div>
      <div class="vendor-body">
        <div class="vendor-top"><h4>${esc(v.name)}</h4></div>
        <div class="vendor-tag">${tagLine}</div>
        <div class="vendor-meta">
          ${v.rating != null
            ? `<div class="stars">${starsHtml(v.rating)} <span class="rating-num">${v.rating}</span> <span class="review-count">(${v.reviews})</span></div>`
            : `<div class="vendor-new-note">ספק חדש בביגי ✨</div>`}
        </div>
        <div class="vendor-meta" style="margin-top:8px;">
          <span class="vendor-price">${v.priceFrom != null ? `מ־${formatPrice(v.priceFrom)}` : 'מחיר לפי פנייה'}</span>
          <div class="vendor-actions">
            ${v.phone ? `<a href="${esc(whatsappLink(v))}" target="_blank" rel="noopener" class="whatsapp-btn" aria-label="צרו קשר בוואטסאפ" title="צרו קשר בוואטסאפ" onclick="event.stopPropagation()">${whatsappIconSvg}</a>` : ''}
            <a href="${esc(profileUrl(v))}" class="btn btn-ghost btn-sm">לפרופיל</a>
          </div>
        </div>
      </div>
    </div>`;
  }

  /* ---------- Top vendors carousel (home) ---------- */
  function initCarousel(){
    const track = $('#vendor-carousel-track');
    if(!track) return;
    const top = listedVendors().filter(v => v.rating != null).sort((a,b)=>b.rating-a.rating).slice(0,8);
    track.innerHTML = top.map((v,i) => vendorCardHtml(v,i)).join('');
    let offset = 0;
    const cardWidth = 310;
    $('[data-next]')?.addEventListener('click', () => {
      const max = Math.max(0, (top.length * cardWidth) - $('.carousel-wrap').offsetWidth);
      offset = Math.min(offset + cardWidth*2, max);
      track.style.transform = `translateX(${offset}px)`;
    });
    $('[data-prev]')?.addEventListener('click', () => {
      offset = Math.max(offset - cardWidth*2, 0);
      track.style.transform = `translateX(${offset}px)`;
    });
    bindCardEvents(track);
  }

  /* ---------- Card interactions: fav + compare ---------- */
  function bindCardEvents(root=document){
    $$('[data-fav]', root).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        FavoritesStore.toggle(idOf(btn.dataset.fav));
        btn.style.transform = 'scale(1.3)';
        setTimeout(()=> btn.style.transform = '', 250);
      });
    });
    $$('[data-compare]', root).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = idOf(btn.dataset.compare);
        if(CompareStore.has(id)){ CompareStore.remove(id); btn.classList.remove('active'); }
        else if(CompareStore.get().length >= 4){
          btn.textContent = 'מקסימום 4 ספקים';
          setTimeout(() => { btn.textContent = '⇄ השוואה'; }, 1600);
        }
        else { CompareStore.add(id); btn.classList.add('active'); }
      });
    });
  }

  /* ---------- Header compare pill + compare bar (shared) ---------- */
  function renderCompareUI(){
    const pill = $('#compare-pill-count');
    const bar = $('#compare-bar');
    const list = CompareStore.get();
    if(pill) pill.textContent = list.length;
    const pillWrap = $('#compare-pill');
    if(pillWrap) pillWrap.hidden = list.length === 0;

    if(bar){
      const items = $('#compare-items');
      if(list.length === 0){
        bar.classList.remove('open');
      } else {
        bar.classList.add('open');
        items.innerHTML = list.map(id => {
          const v = findVendor(id);
          if(!v) return '';
          return `<div class="compare-chip-item"><span class="mini ${v.grad}">${esc(v.emoji)}</span>${esc(v.name)}<button data-compare-remove="${esc(v.id)}" aria-label="הסרה מההשוואה">✕</button></div>`;
        }).join('');
        $('#compare-count-badge').textContent = list.length;
        $$('[data-compare-remove]', items).forEach(btn => {
          btn.addEventListener('click', () => {
            const id = idOf(btn.dataset.compareRemove);
            CompareStore.remove(id);
            $$('[data-compare]').filter(b => idOf(b.dataset.compare) === id).forEach(b=>b.classList.remove('active'));
          });
        });
      }
    }
  }
  document.addEventListener('compare:change', renderCompareUI);

  /* ---------- Header favorites link + card sync (shared) ---------- */
  function renderFavoritesUI(){
    const list = FavoritesStore.get();
    $$('.nav-fav-count').forEach(el => { el.textContent = list.length; el.hidden = list.length === 0; });
    $$('[data-fav]').forEach(btn => {
      const active = list.includes(idOf(btn.dataset.fav));
      btn.classList.toggle('active', active);
      btn.textContent = active ? '❤️' : '🤍';
    });
  }
  document.addEventListener('favorites:change', renderFavoritesUI);

  /* ---------- Favorites page ---------- */
  function initFavoritesPage(){
    const grid = $('#favorites-grid');
    if(!grid) return;
    function render(){
      const ids = FavoritesStore.get();
      const list = listedVendors().filter(v => ids.includes(v.id));
      const empty = $('#favorites-empty');
      if(list.length === 0){
        grid.innerHTML = '';
        if(empty) empty.hidden = false;
      } else {
        if(empty) empty.hidden = true;
        grid.innerHTML = list.map((v,i) => vendorCardHtml(v,i)).join('');
        bindCardEvents(grid);
      }
      const countEl = $('#favorites-count');
      if(countEl) countEl.textContent = list.length;
    }
    document.addEventListener('favorites:change', render);
    render();
  }

  /* ---------- Login / sign-up page ---------- */
  function initLoginPage(){
    const form = $('#auth-form');
    if(!form) return;

    const params = new URLSearchParams(location.search);
    const next = safeNext(params.get('next'));
    const errorBox = $('#auth-error');
    const submitBtn = $('#auth-submit');
    const nameInput = $('#auth-name');
    const confirmInput = $('#auth-confirm');
    const passwordInput = $('#auth-password');
    let mode = 'login';

    const showError = (message) => {
      errorBox.textContent = message || '';
      errorBox.hidden = !message;
    };

    function setMode(m){
      mode = m;
      const signup = m === 'signup';
      $$('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.authTab === m));
      $('#signup-role-field').hidden = !signup;
      $('#signup-name-field').hidden = !signup;
      $('#signup-confirm-field').hidden = !signup;
      $('#auth-switch-login').hidden = signup;
      $('#auth-switch-signup').hidden = !signup;
      nameInput.required = signup;
      confirmInput.required = signup;
      passwordInput.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
      submitBtn.textContent = signup ? 'יצירת חשבון' : 'התחברות';
      showError('');
    }
    $$('[data-auth-tab]').forEach(t => t.addEventListener('click', () => setMode(t.dataset.authTab)));

    if(params.get('mode') === 'signup') setMode('signup');
    const presetRole = $(`input[name="role"][value="${params.get('role')}"]`);
    if(presetRole) presetRole.checked = true;

    const goOn = (user) => {
      if(next) location.href = next;
      else if(user.role === 'supplier') location.href = 'dashboard.html';
      else location.href = 'index.html';
    };

    // Already signed in when the page opened: nothing to do here.
    let submitted = false;
    Account.ready().then(user => { if(user && !submitted) goOn(user); });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitted = true;
      showError('');
      if(mode === 'signup' && passwordInput.value !== confirmInput.value){
        showError('הסיסמאות לא תואמות.');
        confirmInput.focus();
        return;
      }
      submitBtn.disabled = true;
      const body = { email: $('#auth-email').value.trim(), password: passwordInput.value };
      if(mode === 'signup'){
        body.name = nameInput.value.trim();
        body.role = $('input[name="role"]:checked').value;
      }
      const { ok, data } = await api(`/api/auth/${mode}`, { method: 'POST', json: body });
      submitBtn.disabled = false;
      if(!ok){ showError(data.error || 'משהו השתבש. נסו שוב.'); return; }

      Account.set(data.user);
      if(mode === 'signup' && data.user.adminPending){
        $('#auth-panel').hidden = true;
        $('#admin-pending-email').textContent = data.user.email;
        $('#admin-pending-notice').hidden = false;
        return;
      }
      goOn(data.user);
    });
  }

  /* ---------- Vendors listing page ---------- */
  function initVendorsPage(){
    const grid = $('#vendors-grid');
    if(!grid) return;

    const params = new URLSearchParams(location.search);
    const state = {
      cats: params.get('cat') ? [params.get('cat')] : [],
      cities: params.get('city') ? [params.get('city')] : [],
      query: (params.get('q') || '').trim(),
      minRating: 0,
      maxPrice: 25000,
      sort: 'recommended',
      page: 1,
      perPage: 9,
    };

    // Build sidebar
    const catFilterEl = $('#filter-categories');
    if(catFilterEl){
      catFilterEl.innerHTML = CATEGORIES.map(c => `
        <label class="filter-option">
          <input type="checkbox" value="${c.id}" ${state.cats.includes(c.id)?'checked':''} data-filter="cat">
          ${c.icon} ${c.name} <span style="color:var(--muted);margin-inline-start:auto;">${c.count}</span>
        </label>
      `).join('');
    }
    const cityFilterEl = $('#filter-cities');
    if(cityFilterEl){
      cityFilterEl.innerHTML = CITIES.slice(0,6).map(city => `
        <label class="filter-option">
          <input type="checkbox" value="${city}" data-filter="city"> ${city}
        </label>
      `).join('');
    }

    function updateChips(){
      const chipsRow = $('#chips-row');
      if(!chipsRow) return;
      const chips = [];
      if(state.query) chips.push({ type:'query', value:state.query, label:`"${state.query}"` });
      state.cats.forEach(c => chips.push({ type:'cat', value:c, label: nameForCat(c) }));
      state.cities.forEach(c => chips.push({ type:'city', value:c, label:c }));
      if(state.minRating > 0) chips.push({ type:'rating', value:state.minRating, label:`${state.minRating}+ כוכבים` });

      chipsRow.innerHTML = chips.map(ch => `
        <span class="chip" data-chip-type="${ch.type}" data-chip-value="${esc(ch.value)}">${esc(ch.label)}<button>✕</button></span>
      `).join('') + (chips.length ? `<button class="chip-clear" id="clear-chips">נקה הכל</button>` : '');

      $$('.chip button', chipsRow).forEach(btn => {
        btn.addEventListener('click', () => {
          const chip = btn.closest('.chip');
          chip.classList.add('chip-out');
          const type = chip.dataset.chipType, value = chip.dataset.chipValue;
          setTimeout(() => {
            if(type === 'cat') state.cats = state.cats.filter(v=>v!==value);
            if(type === 'city') state.cities = state.cities.filter(v=>v!==value);
            if(type === 'rating') state.minRating = 0;
            if(type === 'query') state.query = '';
            syncControls(); render();
          }, 200);
        });
      });
      $('#clear-chips')?.addEventListener('click', () => {
        state.cats = []; state.cities = []; state.minRating = 0; state.query = '';
        syncControls(); render();
      });
    }

    function syncControls(){
      $$('[data-filter="cat"]').forEach(cb => cb.checked = state.cats.includes(cb.value));
      $$('[data-filter="city"]').forEach(cb => cb.checked = state.cities.includes(cb.value));
      $$('.rating-chip').forEach(chip => chip.classList.toggle('active', parseFloat(chip.dataset.rating) === state.minRating));
    }

    function getFiltered(){
      const q = state.query.toLowerCase();
      let list = listedVendors().filter(v => {
        if(state.cats.length && !state.cats.includes(v.cat)) return false;
        if(state.cities.length && !state.cities.includes(v.city)) return false;
        if(state.minRating > 0 && (v.rating == null || v.rating < state.minRating)) return false;
        if(v.priceFrom != null && v.priceFrom > state.maxPrice) return false;
        if(q){
          const keywords = (CATEGORIES.find(c => c.id === v.cat) || {}).keywords || '';
          const haystack = `${v.name} ${v.tag} ${v.city} ${nameForCat(v.cat)} ${keywords}`.toLowerCase();
          if(!haystack.includes(q)) return false;
        }
        return true;
      });
      // Suppliers without a price or rating yet go last.
      if(state.sort === 'price-asc') list.sort((a,b)=>(a.priceFrom ?? Infinity)-(b.priceFrom ?? Infinity));
      else if(state.sort === 'price-desc') list.sort((a,b)=>(b.priceFrom ?? -Infinity)-(a.priceFrom ?? -Infinity));
      else if(state.sort === 'rating') list.sort((a,b)=>(b.rating ?? -1)-(a.rating ?? -1));
      return list;
    }

    function render(){
      const filtered = getFiltered();
      const visible = filtered.slice(0, state.page * state.perPage);
      grid.innerHTML = visible.length
        ? visible.map((v,i) => vendorCardHtml(v,i)).join('')
        : `<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--muted);">לא נמצאו ספקים התואמים את הסינון שבחרתם 🔍</div>`;
      bindCardEvents(grid);
      $('#results-count').textContent = `${filtered.length} ספקים נמצאו`;
      const loadMoreWrap = $('#load-more-wrap');
      if(loadMoreWrap) loadMoreWrap.style.display = visible.length < filtered.length ? 'flex' : 'none';
      updateChips();
    }

    document.addEventListener('change', (e) => {
      if(e.target.dataset.filter === 'cat'){
        state.cats = $$('[data-filter="cat"]:checked').map(cb=>cb.value);
        state.page = 1; render();
      }
      if(e.target.dataset.filter === 'city'){
        state.cities = $$('[data-filter="city"]:checked').map(cb=>cb.value);
        state.page = 1; render();
      }
      if(e.target.id === 'price-range'){
        state.maxPrice = parseInt(e.target.value);
        $('#price-max-label').textContent = `₪${state.maxPrice.toLocaleString('he-IL')}`;
        render();
      }
      if(e.target.id === 'sort-select'){
        state.sort = e.target.value; render();
      }
    });

    $$('.rating-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const r = parseFloat(chip.dataset.rating);
        state.minRating = state.minRating === r ? 0 : r;
        syncControls(); state.page = 1; render();
      });
    });

    $('#load-more-btn')?.addEventListener('click', () => { state.page++; render(); });

    // Collapsible filters panel (starts closed — pops open downward on click)
    const filtersToggle = $('#filters-toggle');
    const filtersBody = $('#filters-body');
    if(filtersToggle && filtersBody){
      filtersToggle.addEventListener('click', () => {
        const open = filtersToggle.getAttribute('aria-expanded') === 'true';
        filtersToggle.setAttribute('aria-expanded', String(!open));
        filtersBody.style.maxHeight = open ? '0px' : filtersBody.scrollHeight + 'px';
      });
      // Keep the expanded panel's height correct if its content changes (e.g. active filter counts)
      new ResizeObserver(() => {
        if(filtersToggle.getAttribute('aria-expanded') === 'true'){
          filtersBody.style.maxHeight = filtersBody.scrollHeight + 'px';
        }
      }).observe($('.filters-body-inner'));
    }

    syncControls();
    render();
    renderCompareUI();
  }

  /* ---------- Vendor profile page ---------- */
  function initVendorProfile(){
    const root = $('#vendor-profile');
    if(!root) return;
    const params = new URLSearchParams(location.search);
    const v = findVendor(idOf(params.get('id') || ''));
    if(!v){ location.replace('vendors.html'); return; }
    if(v.url){ location.replace(v.url); return; }

    $('#profile-avatar').textContent = v.emoji;
    $('#profile-name').textContent = v.name;
    $('#profile-tag').textContent = v.tag;
    $('#profile-city').textContent = '📍 ' + v.city;
    $('#profile-rating').innerHTML = `${starsHtml(v.rating)} <strong>${v.rating}</strong> (${v.reviews} ביקורות)`;
    document.title = v.name + ' — ביגי ספקים';
    if(v.badge) $('#profile-badges').innerHTML = `<span class="badge badge-top" style="position:static;display:inline-block;">${v.badge}</span>`;

    // Gallery
    const gallery = $('#gallery-grid');
    const emojis = ['📷','🎬','🖼️','✨','🎉','🏆','💫','📸'];
    gallery.innerHTML = emojis.map((e,i) => `<div class="gallery-item ${['g1','g2','g3','g4','g5','g6','g7','g8'][i%8]}">${e}</div>`).join('');

    // Packages
    const packagesGrid = $('#packages-grid');
    const packs = PACKAGES.events; // demo package set reused across vendors
    packagesGrid.innerHTML = packs.map((p,i) => `
      <div class="package-card ${i===1?'featured':''}">
        ${i===1?'<span class="badge badge-top" style="position:static;display:inline-block;margin-bottom:14px;">הכי פופולרי</span><br>':''}
        <h4>${p.name}</h4>
        <div class="package-price">₪${p.price.toLocaleString('he-IL')}<span> / לאירוע</span></div>
        <ul>${p.items.map(it=>`<li>${it}</li>`).join('')}</ul>
        <a class="btn ${i===1?'btn-primary':'btn-secondary'} btn-block" target="_blank" rel="noopener"
           href="${esc(whatsappLink(v, `שלום ${v.name}, מצאתי אתכם בביגי ספקים ואני מעוניין/ת ב${p.name} (${formatPrice(p.price)}) לאירוע שלי. מה הזמינות שלכם?`))}">בחרו חבילה בוואטסאפ</a>
      </div>
    `).join('');

    // Reviews
    const reviewsList = $('#reviews-list');
    reviewsList.innerHTML = REVIEWS.map(r => `
      <div class="review-item">
        <div class="review-top">
          <span class="review-name">${r.name}</span>
          <span class="review-days">לפני ${r.days} ימים</span>
        </div>
        <div class="stars" style="margin-bottom:6px;">${starsHtml(r.rating)}</div>
        <p class="review-text">${r.text}</p>
      </div>
    `).join('');

    // Tabs
    $$('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.tab-btn').forEach(b=>b.classList.remove('active'));
        $$('.tab-panel').forEach(p=>p.classList.remove('active'));
        btn.classList.add('active');
        $('#panel-' + btn.dataset.tab).classList.add('active');
      });
    });

    // WhatsApp CTA
    const waBtn = $('#profile-whatsapp-btn');
    waBtn.href = whatsappLink(v);
    waBtn.innerHTML = whatsappIconSvg + '<span>צרו קשר בוואטסאפ</span>';

    // Floating compare button
    const floatBtn = $('#floating-compare');
    function syncFloat(){
      floatBtn.classList.toggle('active', CompareStore.has(v.id));
      floatBtn.querySelector('span').textContent = CompareStore.has(v.id) ? 'נוסף להשוואה ✓' : 'הוסיפו להשוואה';
    }
    floatBtn.addEventListener('click', () => {
      if(CompareStore.has(v.id)) CompareStore.remove(v.id); else CompareStore.add(v.id);
      syncFloat();
    });
    syncFloat();

    // Floating favorite button
    const favBtn = $('#floating-fav');
    function syncFav(){
      const active = FavoritesStore.has(v.id);
      favBtn.classList.toggle('active', active);
      favBtn.textContent = active ? '❤️' : '🤍';
    }
    favBtn.addEventListener('click', () => {
      FavoritesStore.toggle(v.id);
      syncFav();
    });
    syncFav();

    renderCompareUI();
  }

  /* ---------- Supplier sign-up form (same fields as the admin "create profile" form) ---------- */
  const MIN_PRODUCT_IMAGES = 5;
  const MAX_PRODUCT_IMAGES = 10;

  function initJoinPage(){
    const form = $('#supplier-form');
    if(!form) return;

    const show = (id) => {
      ['join-loading', 'join-guest', 'join-customer', 'join-done'].forEach(s => $('#' + s).hidden = s !== id);
      form.hidden = id !== 'form';
    };
    const showDone = (profile) => {
      $('#join-done-text').textContent = profile.published
        ? `הפרופיל "${profile.name}" כבר מופיע באתר.`
        : `הפרופיל "${profile.name}" התקבל וממתין לאישור של הצוות שלנו. ברגע שיאושר, הוא יופיע באתר — הסטטוס מופיע בלוח הבקרה שלכם.`;
      show('join-done');
    };

    $('#sf-category').innerHTML = '<option value="">בחרו קטגוריה</option>' +
      CATEGORIES.map(c => `<option value="${esc(c.id)}">${esc(c.icon)} ${esc(c.name)}</option>`).join('');
    $('#sf-city').innerHTML = '<option value="">בחרו עיר (לא חובה)</option>' +
      CITIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');

    // One block per photo: the file and its caption stay together.
    const rows = $('#product-photo-rows');
    const addBtn = $('#add-photo-row-btn');
    function addRow(removable){
      const row = document.createElement('div');
      row.className = 'product-photo-row';
      row.innerHTML = `
        <div class="product-photo-fields">
          <label class="product-photo-label"></label>
          <input type="file" name="productImages" accept="image/png,image/jpeg,image/webp" required>
          <input type="text" name="productCaptions" required maxlength="200" placeholder="מה רואים בתמונה הזו?" class="photo-caption-input">
        </div>
        ${removable ? '<button type="button" class="remove-row-btn" aria-label="הסרת תמונה">✕</button>' : ''}`;
      rows.appendChild(row);
      renumber();
    }
    function renumber(){
      const all = $$('.product-photo-row', rows);
      all.forEach((row, i) => { $('.product-photo-label', row).textContent = `תמונה ${i + 1}`; });
      addBtn.hidden = all.length >= MAX_PRODUCT_IMAGES;
    }
    for(let i = 0; i < MIN_PRODUCT_IMAGES; i++) addRow(false);
    addBtn.addEventListener('click', () => { if($$('.product-photo-row', rows).length < MAX_PRODUCT_IMAGES) addRow(true); });
    rows.addEventListener('click', (e) => {
      const btn = e.target.closest('.remove-row-btn');
      if(btn){ btn.closest('.product-photo-row').remove(); renumber(); }
    });

    const errorBox = $('#supplier-form-error');
    const submitBtn = $('#supplier-form-submit');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.hidden = true;
      submitBtn.disabled = true;
      submitBtn.textContent = 'שולח ומעלה תמונות…';
      const { ok, data } = await api('/api/supplier/profile', { method: 'POST', formData: new FormData(form) });
      submitBtn.disabled = false;
      submitBtn.textContent = 'שליחת הפרופיל לאישור';
      if(ok){ showDone(data.profile); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      if(data.error === 'כבר שלחתם פרופיל.'){ location.href = 'dashboard.html'; return; }
      errorBox.textContent = data.error || 'השליחה נכשלה. נסו שוב.';
      errorBox.hidden = false;
      errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });

    Account.ready().then(async (user) => {
      if(!user) return show('join-guest');
      if(user.role !== 'supplier') return show('join-customer');
      const { ok, data } = await api('/api/supplier/profile');
      if(ok && data.profile) return showDone(data.profile);
      show('form');
    });
  }

  /* ---------- Supplier dashboard (real data only) ---------- */
  function initDashboard(){
    const panel = $('#dash-profile');
    if(!panel) return;

    const states = ['dash-loading', 'dash-guest', 'dash-customer', 'dash-no-profile', 'dash-profile'];
    const show = (id) => states.forEach(s => $('#' + s).hidden = s !== id);

    function renderProfile(p){
      $('#dash-status-badge').textContent = p.published ? '✓ פעיל באתר' : '⏳ ממתין לאישור';
      $('#dash-status-badge').classList.toggle('is-live', p.published);
      $('#dash-status-text').textContent = p.published
        ? 'הפרופיל שלכם מופיע באתר ולקוחות יכולים למצוא אתכם.'
        : 'הצוות שלנו יעבור על הפרופיל. ברגע שיאושר, הוא יופיע באתר.';
      $('#dash-view-link').href = p.viewUrl;

      $('#dash-cover').style.backgroundImage = `url('${encodeURI(p.backgroundImage).replace(/'/g, '%27')}')`;
      $('#dash-profile-name').textContent = p.name;
      $('#dash-profile-meta').textContent = [p.categoryLabel, p.city].filter(Boolean).join(' · ');
      $('#dash-profile-description').textContent = p.description;
      $('#dash-profile-description').hidden = !p.description;

      const details = [
        ['טלפון לוואטסאפ', p.phone],
        ['מייל ליצירת קשר', p.contactEmail],
        ['קישורים', p.links],
        ['נשלח בתאריך', new Date(p.createdAt).toLocaleDateString('he-IL')],
      ];
      $('#dash-details').innerHTML = details.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v ? esc(v) : '<span class="muted">לא הוזן</span>'}</dd></div>`).join('');

      $('#dash-photos').innerHTML = p.productImages.map(img => `
        <figure class="dash-photo">
          <img src="${esc(img.file)}" alt="${esc(img.caption)}" loading="lazy">
          <figcaption>${esc(img.caption)}</figcaption>
        </figure>`).join('');
    }

    Account.ready().then(async (user) => {
      if(!user) return show('dash-guest');
      if(user.role !== 'supplier') return show('dash-customer');
      $('#dash-title').textContent = `שלום, ${user.name}`;
      const { ok, data } = await api('/api/supplier/profile');
      if(!ok) return show('dash-guest');
      if(!data.profile) return show('dash-no-profile');
      renderProfile(data.profile);
      show('dash-profile');
    });
  }

  /* ---------- Testimonial/live stats ticker on home (orders count) ---------- */
  function initLiveTicker(){
    const el = $('#live-orders-count');
    if(!el) return;
    let n = 127;
    setInterval(() => {
      n += Math.random() > 0.5 ? 1 : 0;
      el.textContent = n;
    }, 6000);
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    const hint = Account.hint();
    if(hint) renderAccountUI({ ...hint, isAdmin: false });
    initAccountMenu();
    initCategories();
    initHeroSearch();
    initDeals();
    initCarousel();
    initStats();
    initVendorsPage();
    initVendorProfile();
    initJoinPage();
    initDashboard();
    initFavoritesPage();
    initLoginPage();
    initLiveTicker();
    renderCompareUI();
    renderFavoritesUI();
    initReveal();
    Account.refresh();
  });

})();
