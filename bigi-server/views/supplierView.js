const { escapeHtml } = require('./layout');

// Deliberately NOT using views/layout.js's page() shell here — this page
// needs the real site header (same markup as bigi/vendor.html) plus a
// full-viewport fixed background image, which the shared admin shell isn't
// built for.

function waLink(phone, name) {
  const digits = String(phone || '').replace(/\D/g, '').replace(/^0/, '');
  if (!digits) return null;
  const msg = encodeURIComponent(`שלום ${name}, ראיתי את הפרופיל שלכם ורציתי לשאול לגבי זמינות ומחיר.`);
  return `https://wa.me/972${digits}?text=${msg}`;
}

function supplierViewPage(supplier) {
  const {
    name, category, description, phone, contactEmail, links,
    backgroundImage, productImages,
  } = supplier;

  const whatsapp = waLink(phone, name);

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛍️</text></svg>">
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

  /* A frosted-glass card instead of the site's normal solid-white profile
     card — a flat opaque block looked out of place floating over a photo;
     this keeps the same shape/shadow but lets the photo read through. */
  .supplier-glass-card{
    background:rgba(255,255,255,0.82); backdrop-filter:blur(24px); -webkit-backdrop-filter:blur(24px);
    border:1px solid rgba(255,255,255,0.4);
    border-radius:var(--radius-lg); box-shadow:var(--shadow-lg);
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
        <span>${escapeHtml(category)}</span>
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

    ${(description || phone || contactEmail || links) ? `
    <div class="supplier-section">
      ${description ? `<p style="font-size:15px; line-height:1.7; color:var(--ink-soft); margin-bottom:${(phone||contactEmail||links) ? '18px' : '0'};">${escapeHtml(description)}</p>` : ''}
      ${(phone || contactEmail || links) ? `
      <div style="display:flex; flex-direction:column; gap:8px; font-size:14px;">
        ${phone ? `<div>📞 <a href="tel:${escapeHtml(phone)}" style="color:var(--primary); font-weight:700;">${escapeHtml(phone)}</a></div>` : ''}
        ${contactEmail ? `<div>✉️ <a href="mailto:${escapeHtml(contactEmail)}" style="color:var(--primary); font-weight:700;">${escapeHtml(contactEmail)}</a></div>` : ''}
        ${links ? `<div>🔗 <a href="${escapeHtml(links)}" target="_blank" rel="noopener" style="color:var(--primary); font-weight:700;">${escapeHtml(links)}</a></div>` : ''}
      </div>` : ''}
    </div>` : ''}

    <div class="supplier-section">
      <h3>תמונות</h3>
      <div class="gallery-grid">
        ${productImages.map((p) => `
          <figure class="supplier-gallery-item" style="margin:0;">
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

</body>
</html>`;
}

module.exports = { supplierViewPage };
