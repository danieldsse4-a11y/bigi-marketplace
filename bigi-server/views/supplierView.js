const { escapeHtml } = require('./layout');
const { categoryById } = require('../lib/siteData');
const { normalizePhone } = require('../lib/catalog');

// Deliberately NOT using views/layout.js's page() shell here — this page
// needs the real site header (same markup as bigi/vendor.html) plus a
// full-viewport fixed background image, which the shared admin shell isn't
// built for.

function waLink(phone, name) {
  const intl = normalizePhone(phone);
  if (!intl) return null;
  const msg = encodeURIComponent(`שלום ${name}, ראיתי את הפרופיל שלכם ורציתי לשאול לגבי זמינות ומחיר.`);
  return `https://wa.me/${intl}?text=${msg}`;
}

function supplierViewPage(supplier, { baseUrl }) {
  const {
    name, category, city, description, phone, contactEmail, links,
    backgroundImage, productImages, video,
  } = supplier;
  const packages = supplier.packages || [];

  const categoryLabel = categoryById(category)?.name || category;
  // Link previews (WhatsApp etc.) need absolute image URLs; local-dev uploads are relative.
  const absolute = (url) => (/^https?:\/\//i.test(url) ? url : `${baseUrl}${url}`);
  const shareImage = backgroundImage ? absolute(backgroundImage) : `${baseUrl}/og-image.jpg`;
  const shareSummary = [categoryLabel, city].filter(Boolean).join(' · ');
  const shareDescription = description
    ? (description.length > 150 ? `${description.slice(0, 150)}…` : description)
    : `${shareSummary} — בביגי ספקים`;
  const whatsapp = waLink(phone, name);
  // Only http(s) links are clickable; a bare "instagram.com/x" gets https:// added.
  const linkHref = !links ? null
    : /^https?:\/\//i.test(links) ? links
    : /^[a-z][a-z0-9+.-]*:/i.test(links) ? null
    : `https://${links}`;

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#6C5CE7">
<meta name="robots" content="noindex, nofollow">
<script>document.documentElement.classList.add('js');</script>
<title>${escapeHtml(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="ביגי ספקים">
<meta property="og:locale" content="he_IL">
<meta property="og:title" content="${escapeHtml(shareSummary ? `${name} — ${shareSummary}` : name)}">
<meta property="og:description" content="${escapeHtml(shareDescription)}">
<meta property="og:image" content="${escapeHtml(shareImage)}">
<meta name="twitter:card" content="summary_large_image">
<style>
  /* Full-viewport, fixed background photo — this is the page's background,
     not just the hero's. Blurred + darkened so text on top (and the glass
     card below) both stay readable. */
  .supplier-page-bg{
    position:fixed; inset:0; z-index:-2;
    background-image:url('${escapeHtml(backgroundImage)}');
    background-size:cover; background-position:center; background-repeat:no-repeat;
    transform:scale(1.08); /* hides the blurred edge from peeking in */
    filter:blur(10px);
  }
  .supplier-page-bg-overlay{
    position:fixed; inset:0; z-index:-1;
    background:linear-gradient(180deg, rgba(20,17,38,0.5), rgba(20,17,38,0.7));
  }

  /* Solid white, like the rest of the site's cards. A translucent "glass" card
     over a dark photo left the text at roughly 2:1 contrast — and browsers
     without backdrop-filter made it worse — so readability wins here. */
  .supplier-glass-card{
    background:var(--white);
    border:1px solid rgba(255,255,255,0.5);
    border-radius:var(--radius-lg); box-shadow:0 24px 60px rgba(10,8,24,0.45);
    margin-top:-56px; position:relative; z-index:5;
  }
  .supplier-section{ padding:28px 32px; border-bottom:1px solid rgba(0,0,0,0.06); }
  .supplier-section:last-child{ border-bottom:none; }
  .supplier-section h3{ font-size:15px; margin-bottom:14px; }

  .supplier-gallery-item{
    aspect-ratio:1; border-radius:var(--radius-md); overflow:hidden; position:relative;
    transition:transform .4s var(--ease-spring); box-shadow:var(--shadow-sm);
  }
  .supplier-gallery-item:hover{ transform:scale(1.05) rotate(-1deg); }
  .supplier-gallery-item img{ width:100%; height:100%; object-fit:cover; display:block; }
  .supplier-gallery-item figcaption{
    position:absolute; inset-inline:0; bottom:0; padding:8px 10px 6px;
    background:linear-gradient(0deg, rgba(0,0,0,0.72), transparent);
    color:#fff; font-size:11.5px; line-height:1.3;
  }
  .supplier-contact a{ display:inline-block; padding:4px 0; }

  /* Small pills in the card's top-left corner, styled like the header's nav buttons.
     Without JS every panel simply stays visible and the pills stay hidden. */
  .profile-tabs{ display:none; }
  .js .profile-tabs{ display:flex; justify-content:flex-end; gap:8px; padding:16px 20px 0; }
  .profile-tab{
    padding:8px 14px; border-radius:var(--radius-pill); font-weight:600; font-size:14px;
    color:var(--ink-soft); background:transparent;
    transition:background .25s var(--ease-out), color .25s var(--ease-out);
  }
  .profile-tab:hover{ background:var(--primary-soft); color:var(--primary); }
  .profile-tab[aria-selected="true"]{ background:var(--primary-soft); color:var(--primary); }
  .profile-tab:focus-visible{ outline:3px solid var(--primary-light); outline-offset:2px; }
  .js .tab-panel{ display:none; }
  .js .tab-panel.active{ display:block; }
  .tab-empty{ color:var(--muted); font-size:14px; text-align:center; padding:18px 0; }
  .package-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; }
  .package-card{ text-align:start; border:1.5px solid var(--line); border-radius:var(--radius-md); padding:18px; background:#fff; }
  .package-card h4{ font-size:16px; margin-bottom:6px; }
  .package-price{ font-size:22px; font-weight:800; color:var(--primary); margin-bottom:12px; }
  .package-price.is-quote{ font-size:14.5px; font-weight:700; color:var(--muted); }
  .package-card ul{ list-style:none; margin:0; padding:0; display:grid; gap:7px; font-size:14px; color:var(--ink-soft); }
  .package-card li{ padding-inline-start:22px; position:relative; }
  .package-card li::before{ content:"✓"; position:absolute; inset-inline-start:0; color:var(--success); font-weight:800; }
  @media (max-width:760px){
    .js .profile-tabs{ padding:12px 14px 0; gap:6px; }
    .profile-tab{ padding:8px 12px; font-size:13.5px; }
    .supplier-section{ padding:20px 18px; }
    .supplier-glass-card{ margin-top:-48px; }
    .supplier-gallery-item figcaption{ font-size:12.5px; }
    .supplier-contact a{ padding:8px 0; word-break:break-all; }
  }
</style>
</head>
<body>

<div class="supplier-page-bg"></div>
<div class="supplier-page-bg-overlay"></div>

<header class="site-header">
  <div class="wrap">
    <a href="/index.html" class="logo">ביגי ספקים<span class="dot">.</span></a>
    <nav class="main-nav">
      <a href="/index.html">בית</a>
      <a href="/vendors.html">כל הספקים</a>
      <a href="/join.html">הצטרפות כספק</a>
    </nav>
  </div>
</header>

<section class="profile-hero">
  <div class="wrap profile-hero-inner">
    <div>
      <h1>${escapeHtml(name)}</h1>
      <div class="profile-hero-meta">
        <span>${escapeHtml(categoryLabel)}</span>
        ${city ? `<span>📍 ${escapeHtml(city)}</span>` : ''}
      </div>
      ${whatsapp ? `
      <div class="profile-hero-actions">
        <a href="${whatsapp}" target="_blank" rel="noopener" class="btn whatsapp-cta">צרו קשר בוואטסאפ</a>
      </div>` : ''}
    </div>
  </div>
</section>

<div class="wrap" style="max-width:900px;">
  <div class="supplier-glass-card">

    <div class="profile-tabs" role="tablist" aria-label="חלקי הפרופיל">
      <button type="button" class="profile-tab" role="tab" id="tab-about" aria-controls="panel-about" data-tab="about" aria-selected="true">אודות</button>
      <button type="button" class="profile-tab" role="tab" id="tab-packages" aria-controls="panel-packages" data-tab="packages" aria-selected="false" tabindex="-1">חבילות</button>
      <button type="button" class="profile-tab" role="tab" id="tab-reviews" aria-controls="panel-reviews" data-tab="reviews" aria-selected="false" tabindex="-1">ביקורות</button>
    </div>

    <div class="supplier-section tab-panel active" id="panel-about" role="tabpanel" aria-labelledby="tab-about">
      ${(description || phone || contactEmail || links) ? `
      ${description ? `<p style="font-size:15px; line-height:1.7; color:var(--ink-soft); margin-bottom:${(phone||contactEmail||links) ? '18px' : '0'};">${escapeHtml(description)}</p>` : ''}
      ${(phone || contactEmail || links) ? `
      <div class="supplier-contact" style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
        ${phone ? `<div>📞 <a href="tel:${escapeHtml(phone)}" style="color:var(--primary); font-weight:700;">${escapeHtml(phone)}</a></div>` : ''}
        ${contactEmail ? `<div>✉️ <a href="mailto:${escapeHtml(contactEmail)}" style="color:var(--primary); font-weight:700;">${escapeHtml(contactEmail)}</a></div>` : ''}
        ${links ? `<div>🔗 ${linkHref
          ? `<a href="${escapeHtml(linkHref)}" target="_blank" rel="noopener" style="color:var(--primary); font-weight:700;">${escapeHtml(links)}</a>`
          : `<span style="font-weight:700;">${escapeHtml(links)}</span>`}</div>` : ''}
      </div>` : ''}` : '<p class="tab-empty">בעל העסק עדיין לא הוסיף פרטים.</p>'}
    </div>

    <div class="supplier-section tab-panel" id="panel-packages" role="tabpanel" aria-labelledby="tab-packages">
      <h3>חבילות</h3>
      ${packages.length ? `<div class="package-grid">${packages.map((p) => `
        <article class="package-card">
          <h4>${escapeHtml(p.name)}</h4>
          <div class="package-price${p.price ? '' : ' is-quote'}">${p.price ? `₪${Number(p.price).toLocaleString('he-IL')}` : 'מחיר בהתאם להצעה'}</div>
          ${p.items && p.items.length ? `<ul>${p.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
        </article>`).join('')}</div>`
        : '<p class="tab-empty">בעל העסק עדיין לא הוסיף חבילות.</p>'}
    </div>

    <div class="supplier-section tab-panel" id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews">
      <h3>ביקורות</h3>
      <p class="tab-empty">עדיין אין ביקורות.</p>
    </div>

    <div class="supplier-section">
      <h3>${video ? 'תמונות וסרטון' : 'תמונות'}</h3>
      <div class="gallery-grid">
        ${!video ? '' : video.kind === 'link' ? `
          <a class="supplier-gallery-item media-tile" href="${escapeHtml(video.url)}" target="_blank" rel="noopener"
             style="background-image:url('${escapeHtml(backgroundImage)}'); background-size:cover; background-position:center;">
            <span class="media-tile-label">סרטון</span>
          </a>
        ` : `
          <figure class="supplier-gallery-item media-tile" style="margin:0; background-image:url('${escapeHtml(backgroundImage)}'); background-size:cover; background-position:center;"
             data-lb-type="${video.embed ? 'embed' : 'video'}" data-lb-src="${escapeHtml(video.embed || video.url)}"
             data-lb-poster="${escapeHtml(backgroundImage)}" data-lb-caption="${escapeHtml(name)}">
            <span class="media-tile-label">סרטון</span>
          </figure>
        `}
        ${productImages.map((p) => `
          <figure class="supplier-gallery-item" style="margin:0;" data-lb-type="image" data-lb-src="${escapeHtml(p.file)}" data-lb-caption="${escapeHtml(p.caption)}">
            <img src="${escapeHtml(p.file)}" alt="${escapeHtml(p.caption)}">
            <figcaption>${escapeHtml(p.caption)}</figcaption>
          </figure>
        `).join('')}
      </div>
    </div>

  </div>
</div>

<footer class="site-footer" style="margin-top:60px; padding-top:32px;">
  <div class="wrap">
    <div class="footer-bottom">
      <span>© 2026 ביגי ספקים. כל הזכויות שמורות.</span>
    </div>
  </div>
</footer>

<script src="/lightbox.js"></script>
<script>window.Lightbox && window.Lightbox.attach(document.querySelector('.gallery-grid'));</script>
<script>
(function(){
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.profile-tab'));
  if(!tabs.length) return;
  function select(name, focus){
    tabs.forEach(function(tab){
      var on = tab.getAttribute('data-tab') === name;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
      document.getElementById('panel-' + tab.getAttribute('data-tab')).classList.toggle('active', on);
      if(on && focus) tab.focus();
    });
  }
  tabs.forEach(function(tab, i){
    tab.addEventListener('click', function(){
      var name = tab.getAttribute('data-tab');
      select(name);
      try{ history.replaceState(history.state, '', '#' + name); }catch(e){}
    });
    // The page is right-to-left, so the left arrow moves on and the right one goes back.
    tab.addEventListener('keydown', function(e){
      var next = e.key === 'ArrowLeft' ? i + 1 : e.key === 'ArrowRight' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
      if(next === null) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length].getAttribute('data-tab'), true);
    });
  });
  function fromHash(){
    var name = location.hash.slice(1);
    if(['about', 'packages', 'reviews'].indexOf(name) !== -1) select(name);
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);
})();
</script>

</body>
</html>`;
}

module.exports = { supplierViewPage };
