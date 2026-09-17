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

  /* ---------- Vendor auth / session (demo — localStorage, no real backend) ---------- */
  const VendorAuth = {
    key: 'bigi_vendor_session',
    get(){ try{ return JSON.parse(localStorage.getItem(this.key)); }catch(e){ return null; } },
    isLoggedIn(){ return !!this.get(); },
    login(vendor){
      if(!vendor) return;
      localStorage.setItem(this.key, JSON.stringify({ vendorId: vendor.id, name: vendor.name, verifiedPhone: null }));
      document.dispatchEvent(new CustomEvent('vendorauth:change'));
    },
    logout(){ localStorage.removeItem(this.key); document.dispatchEvent(new CustomEvent('vendorauth:change')); },
    setVerifiedPhone(phone){
      const s = this.get(); if(!s) return;
      s.verifiedPhone = phone;
      localStorage.setItem(this.key, JSON.stringify(s));
      document.dispatchEvent(new CustomEvent('vendorauth:change'));
    }
  };
  window.VendorAuth = VendorAuth;

  /* ---------- Customer auth / session (demo — localStorage, no real backend) ---------- */
  const CustomerAuth = {
    key: 'bigi_customer_session',
    get(){ try{ return JSON.parse(localStorage.getItem(this.key)); }catch(e){ return null; } },
    isLoggedIn(){ return !!this.get(); },
    login(name){
      localStorage.setItem(this.key, JSON.stringify({ name }));
      document.dispatchEvent(new CustomEvent('customerauth:change'));
    },
    logout(){ localStorage.removeItem(this.key); document.dispatchEvent(new CustomEvent('customerauth:change')); }
  };
  window.CustomerAuth = CustomerAuth;

  /* ---------- Profile checklist completion overrides (localStorage) ---------- */
  const ChecklistStore = {
    key: 'bigi_checklist_overrides',
    get(){ try{ return JSON.parse(localStorage.getItem(this.key)) || {}; }catch(e){ return {}; } },
    setDone(label, done){
      const o = this.get(); o[label] = done;
      localStorage.setItem(this.key, JSON.stringify(o));
      document.dispatchEvent(new CustomEvent('checklist:change'));
    }
  };
  window.ChecklistStore = ChecklistStore;

  /* ---------- In-site chat (demo — localStorage, no real backend) ---------- */
  const ChatStore = {
    key: 'bigi_chats',
    getAll(){ try{ return JSON.parse(localStorage.getItem(this.key)) || {}; }catch(e){ return {}; } },
    saveAll(all){ localStorage.setItem(this.key, JSON.stringify(all)); document.dispatchEvent(new CustomEvent('chats:change')); },
    getThread(vendorId){ return this.getAll()[vendorId] || []; },
    addMessage(vendorId, msg){
      const all = this.getAll();
      if(!all[vendorId]) all[vendorId] = [];
      all[vendorId].push(msg);
      this.saveAll(all);
    },
    listConversationIds(){ const all = this.getAll(); return Object.keys(all).filter(id => all[id].length).map(idOf); }
  };
  window.ChatStore = ChatStore;

  /* ---------- WhatsApp helper ---------- */
  function whatsappLink(vendor){
    const session = VendorAuth.get();
    const phone = (session && session.vendorId === vendor.id && session.verifiedPhone) ? session.verifiedPhone : vendor.phone;
    const msg = encodeURIComponent(`שלום ${vendor.name}, מצאתי אתכם בביגי ספקים ורציתי לשאול לגבי זמינות ומחיר ל${vendor.tag}.`);
    return `https://wa.me/${phone}?text=${msg}`;
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

  /* ---------- Hidden admin shortcut (home) — only ever shown to a browser
     that already holds a valid, whitelisted admin session; never a hint for
     anyone else, since the link itself starts out `hidden` in the markup. ---------- */
  function initAdminAccessLink(){
    const links = $$('[data-admin-link]');
    if(!links.length) return;
    fetch('/admin-suppliers/session-status', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if(data?.isAdmin) links.forEach(l => l.hidden = false); })
      .catch(() => {}); // e.g. running on the plain static server with no backend — stay hidden
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

  /* ---------- Vendor-only / guest-only nav links + chat badge (shared) ---------- */
  function syncAuthUI(){
    const loggedIn = VendorAuth.isLoggedIn();
    $$('[data-vendor-only]').forEach(el => el.hidden = !loggedIn);
    $$('[data-guest-only]').forEach(el => el.hidden = loggedIn);
  }
  document.addEventListener('vendorauth:change', syncAuthUI);

  /* ---------- Customer-only / customer-guest-only UI (shared) ---------- */
  function syncCustomerAuthUI(){
    const session = CustomerAuth.get();
    const loggedIn = !!session;
    $$('[data-customer-guest]').forEach(el => el.hidden = loggedIn);
    $$('[data-customer-logged-in]').forEach(el => el.hidden = !loggedIn);
    if(loggedIn) $$('.customer-name-slot').forEach(el => el.textContent = session.name);
  }
  document.addEventListener('customerauth:change', syncCustomerAuthUI);

  function initCustomerLoginPage(){
    const form = $('#customer-login-form');
    if(!form) return;

    let mode = 'login';
    const tabs = $$('.auth-tab');
    const nameField = $('#signup-name-field');
    const confirmField = $('#signup-confirm-field');
    const nameInput = $('#customer-login-name');
    const confirmInput = $('#customer-login-confirm');
    const submitBtn = $('#auth-submit-btn');

    function setMode(m){
      mode = m;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.authTab === m));
      if(nameField) nameField.hidden = m !== 'signup';
      if(confirmField) confirmField.hidden = m !== 'signup';
      if(nameInput) nameInput.required = m === 'signup';
      if(confirmInput) confirmInput.required = m === 'signup';
      if(submitBtn) submitBtn.textContent = m === 'signup' ? 'הרשמה' : 'התחברות';
      $('#customer-login-password')?.setAttribute('autocomplete', m === 'signup' ? 'new-password' : 'current-password');
    }
    tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.authTab)));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#customer-login-email').value.trim();
      const name = mode === 'signup'
        ? (nameInput.value.trim() || 'משתמש חדש')
        : (email.split('@')[0] || 'אורח');
      CustomerAuth.login(name);
      location.href = 'index.html';
    });

    $('#google-auth-btn')?.addEventListener('click', () => {
      CustomerAuth.login('משתמש Google');
      location.href = 'index.html';
    });
  }

  function renderChatBadge(){
    const count = ChatStore.listConversationIds().length;
    $$('.nav-chat-count').forEach(el => { el.textContent = count; el.hidden = count === 0; });
  }
  document.addEventListener('chats:change', renderChatBadge);

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
        <button class="btn ${i===1?'btn-primary':'btn-secondary'} btn-block" data-pick-package="${p.name}" data-pick-price="${p.price}">בחרו חבילה</button>
      </div>
    `).join('');
    $$('[data-pick-package]', packagesGrid).forEach(btn => {
      btn.addEventListener('click', () => {
        if(ChatStore.getThread(v.id).length === 0){
          ChatStore.addMessage(v.id, { from:'vendor', text:`שלום! תודה שפניתם ל${v.name} 👋 איך אפשר לעזור?`, time: Date.now() - 1000 });
        }
        ChatStore.addMessage(v.id, {
          from: 'user',
          text: `שלום! מעוניין/ת ב${btn.dataset.pickPackage} (₪${parseInt(btn.dataset.pickPrice).toLocaleString('he-IL')}) לאירוע שלי. מה הזמינות שלכם?`,
          time: Date.now()
        });
        location.href = `chat.html?id=${v.id}`;
      });
    });

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

    // In-site chat CTA
    const chatBtn = $('#profile-chat-btn');
    if(chatBtn) chatBtn.href = `chat.html?id=${v.id}`;

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

  /* ---------- Join page: category picker + form ---------- */
  function initJoinPage(){
    const grid = $('#cat-picker-grid');
    if(!grid) return;
    grid.innerHTML = CATEGORIES.map(c => `
      <div class="cat-pick" data-cat="${c.id}">
        <div class="icon">${c.icon}</div>
        <span>${c.name}</span>
      </div>
    `).join('');
    let selected = new Set();
    $$('.cat-pick', grid).forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.cat;
        if(selected.has(id)){ selected.delete(id); el.classList.remove('selected'); }
        else { selected.add(id); el.classList.add('selected'); }
      });
    });

    // Media upload (required) — photos/videos of past work
    const fileInput = $('#media-upload');
    const fileList = $('#media-upload-list');
    const dropzone = $('#media-dropzone');
    if(fileInput){
      fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files || []);
        dropzone?.classList.toggle('has-files', files.length > 0);
        if(fileList) fileList.innerHTML = files.map(f => `<span class="upload-chip">${f.type.startsWith('video') ? '🎬' : '📷'} ${f.name}</span>`).join('');
      });
    }

    const form = $('#join-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      form.style.display = 'none';
      $('#form-success').classList.add('show');
      // Demo: joining logs you in as a vendor so you can explore the dashboard
      VendorAuth.login(listedVendors()[0]);
    });
  }

  /* ---------- Vendor dashboard ---------- */
  function initDashboard(){
    const root = $('#dashboard-page');
    const locked = $('#dashboard-locked');
    if(!root) return;

    if(!VendorAuth.isLoggedIn()){
      root.hidden = true;
      if(locked) locked.hidden = false;
      return;
    }
    root.hidden = false;
    if(locked) locked.hidden = true;

    $('#dash-logout')?.addEventListener('click', () => {
      VendorAuth.logout();
      location.href = 'index.html';
    });

    const session = VendorAuth.get();
    const vendor = findVendor(session.vendorId) || listedVendors()[0];
    if(!vendor){
      root.hidden = true;
      if(locked) locked.hidden = false;
      return;
    }

    $('#dash-vendor-name').textContent = vendor.name;
    $('#dash-vendor-emoji').textContent = vendor.emoji;

    // Stats cards
    $('#dash-stats-grid').innerHTML = DASHBOARD_STATS.map(s => `
      <div class="dash-stat-card reveal">
        <div class="icon ${s.grad}">${s.icon}</div>
        <strong data-count data-target="${s.value}" data-decimals="${s.decimals||0}" data-suffix="${s.suffix}">0</strong>
        <div class="dash-stat-label">${s.label}</div>
        <div class="delta">${s.delta}</div>
      </div>
    `).join('');
    const statIo = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('in-view');
          const num = entry.target.querySelector('[data-count]');
          if(num) animateCount(num, parseFloat(num.dataset.target), parseInt(num.dataset.decimals), num.dataset.suffix);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    $$('.dash-stat-card', $('#dash-stats-grid')).forEach(el => statIo.observe(el));

    // Weekly chart
    const maxVal = Math.max(...WEEKLY_VIEWS.map(d => d.value));
    const chart = $('#weekly-chart');
    chart.innerHTML = WEEKLY_VIEWS.map(d => `
      <div class="chart-bar-col">
        <div class="chart-bar-track"><div class="chart-bar" style="height:${Math.round((d.value/maxVal)*100)}%"></div></div>
        <span>${d.day}</span>
      </div>
    `).join('');
    const chartIo = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){ entry.target.classList.add('in-view'); obs.unobserve(entry.target); }
      });
    }, { threshold: 0.3 });
    $$('.chart-bar-col', chart).forEach(el => chartIo.observe(el));

    // Leads
    function renderLeads(){
      $('#leads-list').innerHTML = LEADS.map(l => `
        <div class="lead-item">
          <div class="lead-avatar">${l.initials}</div>
          <div class="lead-body">
            <div class="lead-top"><span class="lead-name">${l.name}</span><span class="lead-time">${l.time}</span></div>
            <div class="lead-meta">${l.eventType} · ${l.date}</div>
            <p class="lead-message">${l.message}</p>
            <div class="lead-actions">
              <span class="lead-status ${l.status === 'חדש' ? 'new' : 'answered'}">${l.status}</span>
              ${l.status === 'חדש' ? `<button class="btn btn-ghost btn-sm" data-mark-answered="${l.id}">סמנו כנענה</button>` : ''}
              <a href="tel:+972500000000" class="btn btn-secondary btn-sm">התקשרו</a>
            </div>
          </div>
        </div>
      `).join('');
      $$('[data-mark-answered]').forEach(btn => {
        btn.addEventListener('click', () => {
          const lead = LEADS.find(l => l.id === parseInt(btn.dataset.markAnswered));
          if(lead){ lead.status = 'נענה'; renderLeads(); }
        });
      });
    }
    renderLeads();

    // Reviews (reuse global REVIEWS)
    $('#dash-reviews-list').innerHTML = REVIEWS.map(r => `
      <div class="review-item">
        <div class="review-top">
          <span class="review-name">${r.name}</span>
          <span class="review-days">לפני ${r.days} ימים</span>
        </div>
        <div class="stars" style="margin-bottom:6px;">${starsHtml(r.rating)}</div>
        <p class="review-text">${r.text}</p>
      </div>
    `).join('');

    // Profile completion checklist (with localStorage overrides, e.g. phone verification)
    const PHONE_LABEL = 'אימות מספר טלפון';
    function renderChecklist(){
      const overrides = ChecklistStore.get();
      const currentSession = VendorAuth.get() || session;
      const items = PROFILE_CHECKLIST.map(i => ({ ...i, done: overrides[i.label] !== undefined ? overrides[i.label] : i.done }));
      const doneCount = items.filter(i => i.done).length;
      const pct = Math.round((doneCount / items.length) * 100);
      $('#progress-pct').textContent = pct + '%';
      requestAnimationFrame(() => { $('#progress-fill').style.width = pct + '%'; });

      $('#checklist').innerHTML = items.map(i => `
        <div class="checklist-item ${i.done ? 'done' : ''}">
          <span class="dot">${i.done ? '✓' : ''}</span>
          <span class="checklist-label">${i.label}${i.label === PHONE_LABEL && i.done && currentSession.verifiedPhone ? ` (${currentSession.verifiedPhone})` : ''}</span>
          ${(!i.done && i.label === PHONE_LABEL) ? `<button class="checklist-verify-btn" id="open-phone-verify">אמתו עכשיו</button>` : ''}
        </div>
      `).join('') + `
        <div class="phone-verify-panel" id="phone-verify-panel" hidden>
          <input type="tel" id="phone-verify-input" placeholder="050-1234567" autocomplete="tel">
          <button class="btn btn-primary btn-sm" id="phone-verify-submit">אמתו</button>
        </div>
      `;

      $('#open-phone-verify')?.addEventListener('click', () => {
        $('#phone-verify-panel').hidden = false;
        $('#phone-verify-input')?.focus();
      });
      $('#phone-verify-submit')?.addEventListener('click', () => {
        const raw = $('#phone-verify-input').value.trim();
        if(!raw){ $('#phone-verify-input').focus(); return; }
        const digits = raw.replace(/\D/g,'');
        const normalized = digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '');
        VendorAuth.setVerifiedPhone(normalized);
        ChecklistStore.setDone(PHONE_LABEL, true);
        renderChecklist();
      });
    }
    renderChecklist();

    // Packages mini list
    $('#pkg-mini-list').innerHTML = PACKAGES.events.map(p => `
      <div class="pkg-mini">
        <span class="pkg-mini-name">${p.name}</span>
        <span class="pkg-mini-price">₪${p.price.toLocaleString('he-IL')}</span>
      </div>
    `).join('');
  }

  /* ---------- Vendor login (demo) ---------- */
  function initLoginPage(){
    const form = $('#login-form');
    if(!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      VendorAuth.login(listedVendors()[0]);
      location.href = 'dashboard.html';
    });
    $('#google-vendor-auth-btn')?.addEventListener('click', () => {
      VendorAuth.login(listedVendors()[0]);
      location.href = 'dashboard.html';
    });
  }

  /* ---------- In-site chat page (inbox + thread) ---------- */
  function initChatPage(){
    const layout = $('#chat-layout');
    if(!layout) return;

    const VENDOR_REPLIES = [
      'תודה שפניתם! נבדוק זמינות ונחזור אליכם בהקדם 🙌',
      'שמחים לעזור! אילו פרטים תוכלו לשתף לגבי האירוע?',
      'בהחלט אפשרי, אשלח הצעת מחיר מסודרת בהקדם.',
      'תודה על הפנייה, ניצור קשר בקרוב עם כל הפרטים.',
    ];

    const params = new URLSearchParams(location.search);
    let activeId = params.get('id') ? idOf(params.get('id')) : null;

    function timeAgo(ts){
      const mins = Math.floor((Date.now() - ts) / 60000);
      if(mins < 1) return 'עכשיו';
      if(mins < 60) return `לפני ${mins} דק'`;
      const hrs = Math.floor(mins / 60);
      if(hrs < 24) return `לפני ${hrs} שע'`;
      return `לפני ${Math.floor(hrs / 24)} ימים`;
    }

    function seedIfEmpty(vendorId){
      const vendor = VENDORS.find(v => v.id === vendorId);
      if(vendor && ChatStore.getThread(vendorId).length === 0){
        ChatStore.addMessage(vendorId, { from:'vendor', text:`שלום! תודה שפניתם ל${vendor.name} 👋 איך אפשר לעזור?`, time: Date.now() });
      }
    }

    function renderInbox(){
      const ids = ChatStore.listConversationIds();
      const list = $('#chat-conversations');
      const empty = $('#chat-inbox-empty');
      if(ids.length === 0){
        list.innerHTML = '';
        if(empty) empty.hidden = false;
        return;
      }
      if(empty) empty.hidden = true;
      const rows = ids.map(id => {
        const v = VENDORS.find(x => x.id === id);
        const thread = ChatStore.getThread(id);
        return v && thread.length ? { v, last: thread[thread.length - 1] } : null;
      }).filter(Boolean).sort((a,b) => b.last.time - a.last.time);

      list.innerHTML = rows.map(({v,last}) => `
        <div class="chat-conv-item ${activeId===v.id?'active':''}" data-conv="${v.id}">
          <div class="chat-conv-avatar ${v.grad}">${v.emoji}</div>
          <div style="min-width:0; flex:1;">
            <div class="chat-conv-top"><span class="chat-conv-name">${v.name}</span><span class="chat-conv-time">${timeAgo(last.time)}</span></div>
            <div class="chat-conv-preview">${last.from==='user'?'אתם: ':''}${esc(last.text)}</div>
          </div>
        </div>
      `).join('');
      $$('.chat-conv-item', list).forEach(el => {
        el.addEventListener('click', () => openThread(idOf(el.dataset.conv)));
      });
      renderChatBadge();
    }

    function renderMessages(vendorId){
      const thread = ChatStore.getThread(vendorId);
      const box = $('#chat-messages');
      box.innerHTML = thread.map(m => `
        <div class="chat-bubble ${m.from}">${esc(m.text)}<span class="time">${new Date(m.time).toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'})}</span></div>
      `).join('');
      box.scrollTop = box.scrollHeight;
    }

    function openThread(vendorId){
      const v = VENDORS.find(x => x.id === vendorId);
      if(!v) return;
      activeId = vendorId;
      seedIfEmpty(vendorId);
      $('#chat-thread-empty').hidden = true;
      $('#chat-thread-active').hidden = false;
      $('#chat-thread-avatar').textContent = v.emoji;
      $('#chat-thread-avatar').className = 'chat-thread-avatar ' + v.grad;
      $('#chat-thread-name').textContent = v.name;
      $('#chat-thread-profile-link').href = `vendor.html?id=${v.id}`;
      layout.classList.add('thread-open');
      renderMessages(vendorId);
      renderInbox();
      history.replaceState(null, '', `chat.html?id=${vendorId}`);
    }

    $('#chat-back-btn')?.addEventListener('click', () => {
      layout.classList.remove('thread-open');
      activeId = null;
      history.replaceState(null, '', 'chat.html');
      renderInbox();
    });

    $('#chat-input-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if(!activeId) return;
      const input = $('#chat-input');
      const text = input.value.trim();
      if(!text) return;
      ChatStore.addMessage(activeId, { from:'user', text, time: Date.now() });
      input.value = '';
      renderMessages(activeId);
      renderInbox();

      const typing = $('#chat-typing');
      typing.hidden = false;
      setTimeout(() => {
        typing.hidden = true;
        const reply = VENDOR_REPLIES[Math.floor(Math.random() * VENDOR_REPLIES.length)];
        ChatStore.addMessage(activeId, { from:'vendor', text: reply, time: Date.now() });
        renderMessages(activeId);
        renderInbox();
      }, 1400);
    });

    renderInbox();
    if(activeId) openThread(activeId);
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
    initCategories();
    initHeroSearch();
    initAdminAccessLink();
    initDeals();
    initCarousel();
    initStats();
    initVendorsPage();
    initVendorProfile();
    initJoinPage();
    initDashboard();
    initFavoritesPage();
    initLoginPage();
    initCustomerLoginPage();
    initChatPage();
    initLiveTicker();
    renderCompareUI();
    renderFavoritesUI();
    syncAuthUI();
    syncCustomerAuthUI();
    renderChatBadge();
    initReveal();

    $('#customer-account-pill')?.addEventListener('click', (e) => {
      e.preventDefault();
      CustomerAuth.logout();
    });
  });

})();
