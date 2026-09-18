const { escapeHtml } = require('./layout');
const { categoryById } = require('../lib/siteData');
const { normalizePhone } = require('../lib/catalog');
const { socialLinksOf } = require('../lib/supplierProfile');
const { summarize } = require('../lib/reviews');

// Deliberately NOT using views/layout.js's page() shell here — this page
// needs the real site header (same markup as bigi/vendor.html) plus a
// full-viewport fixed background image, which the shared admin shell isn't
// built for.

// The name the supplier sees in the WhatsApp message, so they know where the
// enquiry came from.
const SITE_NAME = 'ספקים קלאב';

function waLink(phone, text) {
  const intl = normalizePhone(phone);
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

const priceText = (price) => (price ? `₪${Number(price).toLocaleString('he-IL')}` : 'מחיר בהתאם להצעה');

const whatsappIcon = '<svg viewBox="0 0 32 32" fill="currentColor" width="17" height="17" aria-hidden="true"><path d="M16.03 3C9.13 3 3.53 8.6 3.53 15.5c0 2.36.65 4.56 1.78 6.45L3 29l7.24-2.26a12.4 12.4 0 0 0 5.79 1.44h.01c6.9 0 12.5-5.6 12.5-12.5S22.93 3 16.03 3zm0 22.6h-.01a10.4 10.4 0 0 1-5.3-1.45l-.38-.22-4.3 1.34 1.37-4.2-.25-.4a10.32 10.32 0 0 1-1.6-5.57c0-5.75 4.68-10.43 10.44-10.43 2.79 0 5.4 1.09 7.38 3.06a10.35 10.35 0 0 1 3.05 7.38c0 5.75-4.68 10.43-10.4 10.43zm5.72-7.82c-.31-.16-1.86-.92-2.15-1.02-.29-.1-.5-.16-.71.16-.21.31-.82 1.02-1 1.23-.19.21-.37.23-.68.08-.31-.16-1.32-.49-2.51-1.56-.93-.83-1.56-1.85-1.74-2.16-.18-.31-.02-.48.14-.63.14-.14.31-.37.47-.55.16-.19.21-.31.31-.52.1-.21.05-.39-.02-.55-.08-.16-.71-1.72-.98-2.36-.26-.62-.52-.54-.71-.55h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.62 0 1.54 1.13 3.03 1.29 3.24.16.21 2.22 3.39 5.38 4.75.75.33 1.34.52 1.8.66.76.24 1.44.21 1.99.13.61-.09 1.86-.76 2.12-1.5.26-.73.26-1.36.18-1.5-.08-.13-.29-.21-.6-.37z"/></svg>';

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// What the reviews tab offers depends on who is looking: a customer gets the
// form, anyone else gets told why not. Everything typed by a person is escaped.
function reviewsPanel(supplier, list, viewer) {
  const summary = summarize(list);
  const own = viewer ? list.find((r) => r.userId === viewer.id) : null;

  let write;
  if (!supplier.isPublic) {
    write = '<p class="review-note">אפשר לכתוב ביקורת רק אחרי שהפרופיל מפורסם באתר.</p>';
  } else if (!viewer) {
    const next = encodeURIComponent(`/supplier/view/${supplier.id}#reviews`);
    write = `<p class="review-note">כדי לכתוב ביקורת צריך להתחבר. <a href="/login.html?next=${next}" style="color:var(--primary); font-weight:700;">התחברות או הרשמה</a></p>`;
  } else if (viewer.role !== 'customer') {
    write = '<p class="review-note">רק חשבונות לקוח יכולים לכתוב ביקורות.</p>';
  } else {
    write = `
      <form class="review-form" data-supplier="${escapeHtml(supplier.id)}" novalidate>
        <div class="review-form-title">${own ? 'הביקורת שלכם' : 'כתבו ביקורת'}</div>
        <div class="star-input" role="radiogroup" aria-label="דירוג">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star${own && own.rating >= n ? ' on' : ''}" role="radio" data-v="${n}" aria-checked="${own && own.rating === n ? 'true' : 'false'}" aria-label="${n} כוכבים">★</button>`).join('')}
        </div>
        <textarea maxlength="1000" rows="3" placeholder="ספרו על החוויה שלכם (לא חובה)">${own ? escapeHtml(own.text) : ''}</textarea>
        <div class="review-form-error" role="alert" hidden></div>
        <div class="review-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">${own ? 'עדכון הביקורת' : 'פרסום הביקורת'}</button>
          ${own ? '<button type="button" class="btn btn-ghost btn-sm" data-delete-review>מחיקת הביקורת שלי</button>' : ''}
        </div>
      </form>`;
  }

  return `
      <h3>ביקורות${summary.count ? ` <span class="review-avg"><span class="review-star-on">★</span> ${summary.average} · ${summary.count} ${summary.count === 1 ? 'ביקורת' : 'ביקורות'}</span>` : ''}</h3>
      ${write}
      ${list.length ? `<ul class="review-list">${list.map((r) => `
        <li class="review-item${own && r.id === own.id ? ' is-mine' : ''}">
          <div class="review-head">
            <strong>${escapeHtml(r.name)}</strong>
            <span class="review-stars" role="img" aria-label="${r.rating} מתוך 5 כוכבים">${starsText(r.rating)}</span>
            <time datetime="${escapeHtml(r.createdAt)}">${dateFmt.format(new Date(r.createdAt))}</time>
          </div>
          ${r.text ? `<p>${escapeHtml(r.text)}</p>` : ''}
        </li>`).join('')}</ul>` : '<p class="tab-empty">עדיין אין ביקורות.</p>'}`;
}

function supplierViewPage(supplier, { baseUrl, reviews = [], viewer = null }) {
  const {
    name, category, city, description, phone, contactEmail,
    backgroundImage, productImages, video,
  } = supplier;
  const packages = supplier.packages || [];
  const logo = supplier.logo || null;
  // A supplier with no packages gets no חבילות tab at all, rather than a tab
  // that only ever says there is nothing here.
  const tabs = [
    { id: 'about', label: 'אודות' },
    ...(packages.length ? [{ id: 'packages', label: 'חבילות' }] : []),
    { id: 'reviews', label: 'ביקורות' },
  ];

  const categoryLabel = categoryById(category)?.name || category;
  // Link previews (WhatsApp etc.) need absolute image URLs; local-dev uploads are relative.
  const absolute = (url) => (/^https?:\/\//i.test(url) ? url : `${baseUrl}${url}`);
  const shareImage = backgroundImage ? absolute(backgroundImage) : `${baseUrl}/og-image.jpg`;
  const shareSummary = [categoryLabel, city].filter(Boolean).join(' · ');
  const shareDescription = description
    ? (description.length > 150 ? `${description.slice(0, 150)}…` : description)
    : `${shareSummary} — בביגי ספקים`;
  const whatsapp = waLink(phone, `שלום ${name}, מצאתי אתכם ב${SITE_NAME} ורציתי לשאול לגבי זמינות ומחיר.`);
  const socialLinks = socialLinksOf(supplier);

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
  /* The logo sits on a white plate so a transparent or dark logo reads on the photo */
  .profile-hero-brand{ display:flex; align-items:center; gap:16px; }
  .profile-hero-brand h1{ min-width:0; overflow-wrap:anywhere; }
  .profile-logo{
    width:72px; height:72px; flex-shrink:0; object-fit:contain; background:#fff;
    border-radius:18px; padding:6px; box-shadow:0 8px 24px rgba(10,8,24,0.35);
  }
  .review-avg{ font-size:13.5px; font-weight:700; color:var(--ink-soft); margin-inline-start:8px; }
  .review-star-on, .star.on, .review-stars{ color:#F5A623; }
  .review-note{ background:var(--bg-soft); border-radius:var(--radius-md); padding:14px 16px; font-size:14px; color:var(--ink-soft); margin-bottom:18px; }
  .review-form{ background:var(--bg-soft); border-radius:var(--radius-md); padding:16px; margin-bottom:20px; display:grid; gap:12px; }
  .review-form-title{ font-weight:800; font-size:14.5px; }
  .star-input{ display:flex; gap:2px; }
  .star{ width:44px; height:44px; font-size:28px; line-height:1; color:#D0CDE0; background:transparent; border-radius:10px; transition:transform .15s; }
  .star.on{ color:#F5A623; }
  .star:hover{ transform:scale(1.12); }
  .star:focus-visible{ outline:3px solid var(--primary-light); outline-offset:1px; }
  .review-form textarea{
    width:100%; resize:vertical; min-height:84px; font:inherit; font-size:15px; color:var(--ink);
    padding:12px 14px; background:#fff; border:1.5px solid var(--line); border-radius:var(--radius-md); outline:none;
    transition:border-color .2s, box-shadow .2s;
  }
  .review-form textarea:focus{ border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-soft); }
  .review-form-error{ background:var(--accent-soft); color:#B8323C; border-radius:var(--radius-md); padding:10px 14px; font-size:13.5px; font-weight:600; }
  .review-form-actions{ display:flex; gap:10px; flex-wrap:wrap; }
  .review-list{ list-style:none; margin:0; padding:0; display:grid; gap:12px; }
  .review-item{ border:1px solid var(--line); border-radius:var(--radius-md); padding:14px 16px; }
  .review-item.is-mine{ border-color:var(--primary-light); background:var(--primary-soft); }
  .review-head{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .review-head time{ margin-inline-start:auto; font-size:12.5px; color:var(--muted); }
  .review-item p{ margin:8px 0 0; font-size:14.5px; line-height:1.65; color:var(--ink-soft); white-space:pre-wrap; overflow-wrap:anywhere; }
  .social-row{ display:flex; flex-wrap:wrap; gap:8px; }
  .social-btn{
    display:inline-flex; align-items:center; min-height:40px; padding:9px 16px; max-width:100%;
    border-radius:var(--radius-pill); background:var(--primary-soft); color:var(--primary);
    font-weight:700; font-size:14px; overflow-wrap:anywhere;
    transition:background .25s var(--ease-out), color .25s var(--ease-out);
  }
  a.social-btn:hover{ background:var(--primary); color:#fff; }
  .social-btn.is-text{ background:var(--bg-soft); color:var(--ink-soft); }
  .package-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:16px; }
  .package-card{
    display:flex; flex-direction:column; text-align:start; position:relative; overflow:hidden;
    border:1.5px solid var(--line); border-radius:var(--radius-lg); padding:22px 20px; background:#fff;
    transition:border-color .25s var(--ease-out), transform .25s var(--ease-out), box-shadow .25s var(--ease-out);
  }
  /* A coloured edge along the top, so a row of cards doesn't read as plain boxes */
  .package-card::before{ content:""; position:absolute; inset-inline:0; top:0; height:4px; background:var(--grad-main); }
  .package-card:hover{ border-color:var(--primary-light); transform:translateY(-4px); box-shadow:var(--shadow-md); }
  .package-card h4{ font-size:17px; margin-bottom:8px; }
  .package-price{
    font-size:30px; font-weight:800; line-height:1.15; margin-bottom:14px;
    background:var(--grad-main); -webkit-background-clip:text; background-clip:text; color:transparent;
  }
  .package-price.is-quote{
    font-size:15px; font-weight:700; color:var(--muted);
    background:none; -webkit-text-fill-color:currentColor;
  }
  .package-card ul{ list-style:none; margin:0 0 18px; padding:0; display:grid; gap:9px; font-size:14px; color:var(--ink-soft); }
  .package-card li{ padding-inline-start:24px; position:relative; line-height:1.5; }
  .package-card li::before{
    content:"✓"; position:absolute; inset-inline-start:0; top:1px; width:17px; height:17px; border-radius:50%;
    background:#E6F9F5; color:var(--success); font-size:11px; font-weight:800; display:flex; align-items:center; justify-content:center;
  }
  /* Pushed to the bottom so every button in the row lines up */
  .package-cta{ margin-top:auto; justify-content:center; font-size:14.5px; padding:13px 18px; }
  @media (max-width:760px){
    .profile-hero-brand{ gap:12px; }
    .profile-logo{ width:56px; height:56px; border-radius:14px; padding:5px; }
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
      <div class="profile-hero-brand">
        ${logo ? `<img class="profile-logo" src="${escapeHtml(logo)}" alt="הלוגו של ${escapeHtml(name)}" width="72" height="72">` : ''}
        <h1>${escapeHtml(name)}</h1>
      </div>
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
      ${tabs.map((tab, i) => `<button type="button" class="profile-tab" role="tab" id="tab-${tab.id}" aria-controls="panel-${tab.id}" data-tab="${tab.id}" aria-selected="${i === 0}"${i === 0 ? '' : ' tabindex="-1"'}>${tab.label}</button>`).join('')}
    </div>

    <div class="supplier-section tab-panel active" id="panel-about" role="tabpanel" aria-labelledby="tab-about">
      ${(description || phone || contactEmail || socialLinks.length) ? `
      ${description ? `<p style="font-size:15px; line-height:1.7; color:var(--ink-soft); margin-bottom:${(phone||contactEmail||socialLinks.length) ? '18px' : '0'};">${escapeHtml(description)}</p>` : ''}
      ${(phone || contactEmail) ? `
      <div class="supplier-contact" style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
        ${phone ? `<div>📞 <a href="tel:${escapeHtml(phone)}" style="color:var(--primary); font-weight:700;">${escapeHtml(phone)}</a></div>` : ''}
        ${contactEmail ? `<div>✉️ <a href="mailto:${escapeHtml(contactEmail)}" style="color:var(--primary); font-weight:700;">${escapeHtml(contactEmail)}</a></div>` : ''}
      </div>` : ''}
      ${socialLinks.length ? `
      <div class="social-row" style="margin-top:${(phone || contactEmail) ? '16px' : '0'};">
        ${socialLinks.map((l) => l.url
          ? `<a class="social-btn" href="${escapeHtml(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>`
          : `<span class="social-btn is-text">${escapeHtml(l.label)}</span>`).join('')}
      </div>` : ''}` : '<p class="tab-empty">בעל העסק עדיין לא הוסיף פרטים.</p>'}
    </div>

    ${!packages.length ? '' : `
    <div class="supplier-section tab-panel" id="panel-packages" role="tabpanel" aria-labelledby="tab-packages">
      <h3>חבילות</h3>
      <div class="package-grid">${packages.map((p) => {
        const enquiry = waLink(phone, `שלום ${name}, מצאתי אתכם ב${SITE_NAME} ואני מעוניין/ת ב"${p.name}" (${priceText(p.price)}) לאירוע שלי. מה הזמינות שלכם?`);
        return `
        <article class="package-card">
          <h4>${escapeHtml(p.name)}</h4>
          <div class="package-price${p.price ? '' : ' is-quote'}">${escapeHtml(priceText(p.price))}</div>
          ${p.items && p.items.length ? `<ul>${p.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
          ${enquiry ? `<a class="btn whatsapp-cta btn-block package-cta" href="${enquiry}" target="_blank" rel="noopener">${whatsappIcon} בחרו חבילה בוואטסאפ</a>` : ''}
        </article>`;
      }).join('')}</div>
    </div>`}

    <div class="supplier-section tab-panel" id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews">
      ${reviewsPanel(supplier, reviews, viewer)}
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
    // A profile with no packages has no such tab, so the link is simply ignored.
    if(tabs.some(function(tab){ return tab.getAttribute('data-tab') === name; })) select(name);
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);
})();
</script>
<script>
(function(){
  var form = document.querySelector('.review-form');
  if(!form) return;
  var stars = Array.prototype.slice.call(form.querySelectorAll('.star'));
  var errorBox = form.querySelector('.review-form-error');
  var textarea = form.querySelector('textarea');
  var rating = 0;
  stars.forEach(function(star){ if(star.classList.contains('on')) rating = Math.max(rating, Number(star.getAttribute('data-v'))); });

  function paint(){
    stars.forEach(function(star){
      var v = Number(star.getAttribute('data-v'));
      star.classList.toggle('on', v <= rating);
      star.setAttribute('aria-checked', v === rating ? 'true' : 'false');
    });
  }
  stars.forEach(function(star){
    star.addEventListener('click', function(){ rating = Number(star.getAttribute('data-v')); paint(); });
  });

  function request(method, body){
    var options = { method: method, credentials: 'same-origin', headers: {} };
    if(body){ options.headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
    return fetch('/api/suppliers/' + encodeURIComponent(form.getAttribute('data-supplier')) + '/reviews/mine', options)
      .then(function(res){ return res.json().catch(function(){ return {}; }).then(function(data){ return { ok: res.ok, status: res.status, data: data }; }); });
  }
  function fail(message){
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
  function done(){
    if(location.hash !== '#reviews') location.hash = '#reviews';
    location.reload();
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    errorBox.hidden = true;
    if(!rating){ fail('יש לבחור דירוג בכוכבים.'); return; }
    var button = form.querySelector('button[type=submit]');
    button.disabled = true;
    request('PUT', { rating: rating, text: textarea.value })
      .then(function(r){
        if(r.ok) return done();
        button.disabled = false;
        fail(r.status === 401 ? 'החיבור פג — התחברו מחדש ונסו שוב.' : (r.data.error || 'השמירה נכשלה. נסו שוב.'));
      })
      .catch(function(){ button.disabled = false; fail('אין חיבור לשרת. נסו שוב.'); });
  });

  var del = form.querySelector('[data-delete-review]');
  if(del) del.addEventListener('click', function(){
    if(!window.confirm('למחוק את הביקורת שלכם?')) return;
    del.disabled = true;
    request('DELETE')
      .then(function(r){ if(r.ok) return done(); del.disabled = false; fail(r.data.error || 'המחיקה נכשלה. נסו שוב.'); })
      .catch(function(){ del.disabled = false; fail('אין חיבור לשרת. נסו שוב.'); });
  });
})();
</script>

</body>
</html>`;
}

module.exports = { supplierViewPage };
