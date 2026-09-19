const { escapeHtml } = require('./layout');
const { categoryById, CITIES } = require('../lib/siteData');
const { normalizePhone } = require('../lib/catalog');
const { socialLinksOf, equipmentOf, servicesOf } = require('../lib/supplierProfile');
const { summarize, SCORES, MAX_SERVICE } = require('../lib/reviews');

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

// One wording for every WhatsApp button on the page. It names the site so the
// supplier knows where the enquiry came from, and nothing else.
const enquiryText = (name) => `שלום ${name}, מצאתי אתכם ב${SITE_NAME} ורציתי לשאול לגבי זמינות ומחיר.`;

const whatsappIcon = '<svg viewBox="0 0 32 32" fill="currentColor" width="17" height="17" aria-hidden="true"><path d="M16.03 3C9.13 3 3.53 8.6 3.53 15.5c0 2.36.65 4.56 1.78 6.45L3 29l7.24-2.26a12.4 12.4 0 0 0 5.79 1.44h.01c6.9 0 12.5-5.6 12.5-12.5S22.93 3 16.03 3zm0 22.6h-.01a10.4 10.4 0 0 1-5.3-1.45l-.38-.22-4.3 1.34 1.37-4.2-.25-.4a10.32 10.32 0 0 1-1.6-5.57c0-5.75 4.68-10.43 10.44-10.43 2.79 0 5.4 1.09 7.38 3.06a10.35 10.35 0 0 1 3.05 7.38c0 5.75-4.68 10.43-10.4 10.43zm5.72-7.82c-.31-.16-1.86-.92-2.15-1.02-.29-.1-.5-.16-.71.16-.21.31-.82 1.02-1 1.23-.19.21-.37.23-.68.08-.31-.16-1.32-.49-2.51-1.56-.93-.83-1.56-1.85-1.74-2.16-.18-.31-.02-.48.14-.63.14-.14.31-.37.47-.55.16-.19.21-.31.31-.52.1-.21.05-.39-.02-.55-.08-.16-.71-1.72-.98-2.36-.26-.62-.52-.54-.71-.55h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.08-1.1 2.62 0 1.54 1.13 3.03 1.29 3.24.16.21 2.22 3.39 5.38 4.75.75.33 1.34.52 1.8.66.76.24 1.44.21 1.99.13.61-.09 1.86-.76 2.12-1.5.26-.73.26-1.36.18-1.5-.08-.13-.29-.21-.6-.37z"/></svg>';

/* ---------- Gallery layout: every row is full, whatever the number of photos.
   On a computer the grid has 12 columns, and a row holds 4, 3 or 2 tiles
   (each 3, 4 or 6 columns wide). Rows of 4 are the default; when the count
   doesn't divide by 4, the leftover becomes rows of 3 (bigger photos) placed
   at the top, where the biggest photos look best. Only 1 and 5 need other
   shapes: one wide photo, and a row of 2 above a row of 3. */
function galleryRows(n) {
  if (n <= 4) return n ? [n] : [];
  const fours = Math.floor(n / 4);
  const fill = (count) => Array(count).fill(4);
  switch (n % 4) {
    case 0: return fill(fours);
    case 3: return [3, ...fill(fours)];
    case 2: return [3, 3, ...fill(fours - 1)];
    default: return n === 5 ? [2, 3] : [3, 3, 3, ...fill(fours - 2)];
  }
}

// With more photos than this (plus one), the page shows only this many.
const GALLERY_PREVIEW = 7;

// One class list per tile. On a phone the grid has 2 columns, so with an odd
// count the first tile goes full width instead of leaving a hole at the end.
function galleryLayout(n) {
  const spans = galleryRows(n).flatMap((size) => Array(size).fill(12 / size));
  return spans.map((span, i) => [`span-${span}`, n % 2 === 1 && i === 0 ? 'm-wide' : ''].filter(Boolean).join(' '));
}

// The class list and "+N" badge of every tile in a gallery of `count` tiles.
// A long gallery shows a preview of GALLERY_PREVIEW tiles; the last one says
// "+N" and opens the full-screen viewer, which still has every tile. The
// tiles past the preview get a layout of their own, so even with scripts off
// (when they are not hidden) every row is still full.
function galleryPlan(count) {
  const collapsed = count > GALLERY_PREVIEW + 1;
  const shown = collapsed ? GALLERY_PREVIEW : count;
  const hiddenCount = count - shown;
  const layout = [...galleryLayout(shown), ...galleryLayout(hiddenCount)];
  return {
    collapsed, hiddenCount,
    classes: (t) => `${layout[t]}${t >= shown ? ' gallery-extra' : collapsed && t === shown - 1 ? ' gallery-last' : ''}`,
    isLast: (t) => collapsed && t === shown - 1,
    badge: (t) => (collapsed && t === shown - 1
      ? `<span class="gallery-more" aria-hidden="true"><bdi dir="ltr">+${hiddenCount}</bdi></span>` : ''),
  };
}

// A tile for an uploaded video, an embedded one, or a plain link to one. The
// profile's background photo stands in for a poster.
function videoTile(item, { classes, poster, caption, badge = '' }) {
  const bg = `background-image:url('${escapeHtml(poster)}'); background-size:cover; background-position:center;`;
  if (item.kind === 'link') {
    return `
          <a class="supplier-gallery-item media-tile ${classes}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" style="${bg}">
            <span class="media-tile-label">סרטון</span>${badge}
          </a>`;
  }
  return `
          <figure class="supplier-gallery-item media-tile ${classes}" style="margin:0; ${bg}"
             data-lb-type="${item.embed ? 'embed' : 'video'}" data-lb-src="${escapeHtml(item.embed || item.url)}"
             data-lb-poster="${escapeHtml(poster)}" data-lb-caption="${escapeHtml(caption)}">
            <span class="media-tile-label">סרטון</span>${badge}
          </figure>`;
}

// One named group of the ציוד section: its photos and videos in full rows.
function equipmentGroup(group, poster) {
  const items = group.items.filter((it) => it && it.url);
  if (!items.length) return '';
  const plan = galleryPlan(items.length);
  const photos = items.filter((it) => it.kind === 'image').length;
  const videos = items.length - photos;
  const tiles = items.map((it, t) => {
    if (it.kind !== 'image') return videoTile(it, { classes: plan.classes(t), poster, caption: group.name, badge: plan.badge(t) });
    return `
          <figure class="supplier-gallery-item ${plan.classes(t)}" style="margin:0;" data-lb-type="image" data-lb-src="${escapeHtml(it.url)}" data-lb-caption="${escapeHtml(group.name)}"${plan.isLast(t) ? ` aria-label="${escapeHtml(`${group.name} — ועוד ${plan.hiddenCount} פריטים`)}"` : ''}>
            <img src="${escapeHtml(it.url)}" alt="${escapeHtml(group.name)}" loading="lazy">
            ${plan.badge(t)}
          </figure>`;
  }).join('');
  const what = [photos ? `${photos} התמונות` : '', videos ? `${videos} הסרטונים` : ''].filter(Boolean).join(' ו');
  return `
      <div class="gallery-block equipment-group">
        <h4>${escapeHtml(group.name)} <span class="equipment-count">${items.length}</span></h4>
        <div class="gallery-grid gallery-mosaic">${tiles}
        </div>
        ${plan.collapsed ? `<button type="button" class="btn btn-secondary btn-sm gallery-all">📷 הצגת כל ${what}</button>` : ''}
      </div>`;
}

// 26/04/2026, as on the review card, in Israel time: the server itself runs on UTC.
const reviewDateParts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric' });
function reviewDate(iso) {
  const part = Object.fromEntries(reviewDateParts.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${part.day}/${part.month}/${part.year}`;
}

// One review: the overall score in a circle, then who, when, what service,
// their opinion, and the four scores.
function reviewItem(r, mine) {
  const who = `${r.name}${r.city ? `, ${r.city}` : ''}.`;
  return `
        <li class="review-item${mine ? ' is-mine' : ''}">
          <div class="review-overall" aria-label="ציון כללי ${r.overall} מתוך 10">
            <span class="review-overall-num"><bdi dir="ltr">${r.overall}</bdi></span>
            <span class="review-overall-label">כללי</span>
          </div>
          <div class="review-main">
            <div class="review-who">${escapeHtml(who)}${mine ? ' <span class="review-mine-tag">הביקורת שלכם</span>' : ''}</div>
            <div class="review-date">משוב: <time datetime="${escapeHtml(r.createdAt)}"><bdi dir="ltr">${reviewDate(r.createdAt)}</bdi></time></div>
            ${r.service ? `
            <div class="review-block">
              <div class="review-label">תיאור השירות:</div>
              <p>${escapeHtml(r.service)}</p>
            </div>` : ''}
            ${r.text ? `
            <div class="review-block">
              <div class="review-label">חוות דעת:</div>
              <p>${escapeHtml(r.text)}</p>
            </div>` : ''}
            <div class="review-block review-scores">
              ${SCORES.map(({ key, label }) => `<span class="review-score">${label} <span class="review-score-num" aria-label="${r.scores[key]} מתוך 10"><bdi dir="ltr">${r.scores[key]}</bdi></span></span>`).join('')}
            </div>
          </div>
        </li>`;
}

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
        <p class="review-form-hint">תנו ציון מ־1 עד 10 לכל אחד מהתחומים. הציון הכללי הוא הממוצע שלהם.</p>
        <div class="score-pickers">
          ${SCORES.map(({ key, label }) => {
            const current = own ? own.scores[key] : 0;
            return `
          <div class="score-picker" data-key="${key}">
            <div class="score-picker-label" id="score-${key}">${label}</div>
            <div class="score-row" role="radiogroup" aria-labelledby="score-${key}">
              ${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button type="button" class="score-btn${current === n ? ' on' : ''}" role="radio" data-v="${n}" aria-checked="${current === n ? 'true' : 'false'}" aria-label="${label}: ${n}">${n}</button>`).join('')}
            </div>
          </div>`;
          }).join('')}
        </div>
        <div class="review-overall-preview" aria-live="polite">ציון כללי: <strong data-overall>${own ? own.overall : '—'}</strong></div>
        <label class="review-field">
          <span>תיאור השירות *</span>
          <input type="text" name="service" maxlength="${MAX_SERVICE}" placeholder="איזה שירות קיבלתם? למשל: הובלה, DJ לחתונה" value="${own ? escapeHtml(own.service) : ''}">
        </label>
        <label class="review-field">
          <span>עיר (לא חובה)</span>
          <select name="city">
            <option value="">בחרו עיר</option>
            ${CITIES.map((c) => `<option value="${escapeHtml(c)}"${own && own.city === c ? ' selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          </select>
        </label>
        <label class="review-field">
          <span>חוות דעת *</span>
          <textarea name="text" maxlength="1000" rows="3" placeholder="ספרו על החוויה שלכם">${own ? escapeHtml(own.text) : ''}</textarea>
        </label>
        <div class="review-form-error" role="alert" hidden></div>
        <div class="review-form-actions">
          <button type="submit" class="btn btn-primary btn-sm">${own ? 'עדכון הביקורת' : 'פרסום הביקורת'}</button>
          ${own ? '<button type="button" class="btn btn-ghost btn-sm" data-delete-review>מחיקת הביקורת שלי</button>' : ''}
        </div>
      </form>`;
  }

  return `
      <h3>ביקורות${summary.count ? ` <span class="review-avg"><bdi dir="ltr">${summary.average}</bdi> · ${summary.count} ${summary.count === 1 ? 'ביקורת' : 'ביקורות'}</span>` : ''}</h3>
      ${list.length ? `<ul class="review-list">${list.map((r) => reviewItem(r, own && r.id === own.id)).join('')}</ul>` : '<p class="tab-empty">עדיין אין ביקורות.</p>'}
      ${write}`;
}

function supplierViewPage(supplier, { baseUrl, reviews = [], viewer = null, isOwner = false, isAdmin = false }) {
  // An admin who owns this profile already has their own edit button.
  const adminEdit = isAdmin && !isOwner;
  const {
    name, category, city, description, phone, contactEmail,
    backgroundImage, productImages, video,
  } = supplier;
  const packages = supplier.packages || [];
  // Like חבילות: a supplier with no services gets no tab.
  const services = servicesOf(supplier).filter((svc) => svc.photos.length);
  const logo = supplier.logo || null;
  // A supplier with no packages gets no חבילות tab at all, rather than a tab
  // that only ever says there is nothing here.
  const tabs = [
    { id: 'about', label: 'אודות' },
    ...(packages.length ? [{ id: 'packages', label: 'חבילות' }] : []),
    ...(services.length ? [{ id: 'services', label: 'מגוון השירותים שלנו' }] : []),
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
  const whatsapp = waLink(phone, enquiryText(name));
  const socialLinks = socialLinksOf(supplier);
  // The video tile, when there is one, comes first and counts as a tile.
  const gallery = galleryPlan(productImages.length + (video ? 1 : 0));
  const equipment = equipmentOf(supplier).filter((g) => g.items.some((it) => it && it.url));

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

  /* See galleryLayout(): rows of 4, 3 or 2 tiles on 12 columns, always full. */
  .gallery-mosaic{ grid-template-columns:repeat(12, minmax(0, 1fr)); }
  .gallery-mosaic > .span-3{ grid-column:span 3; }
  .gallery-mosaic > .span-4{ grid-column:span 4; }
  .gallery-mosaic > .span-6{ grid-column:span 6; aspect-ratio:4/3; }
  .gallery-mosaic > .span-12{ grid-column:span 12; aspect-ratio:16/9; }
  /* A big tile only needs a gentle lift, not the small tiles' zoom */
  .gallery-mosaic > .span-6:hover, .gallery-mosaic > .span-12:hover{ transform:scale(1.02); }
  /* A long gallery: only the preview shows; the viewer still has every photo.
     Without scripts nothing is hidden, since the viewer wouldn't open. */
  .js .gallery-mosaic > .gallery-extra{ display:none; }
  .gallery-more{
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
    background:rgba(20,16,40,0.58); color:#fff; font-size:34px; font-weight:800; letter-spacing:.5px;
    transition:background .25s var(--ease-out);
  }
  .gallery-last:hover .gallery-more{ background:rgba(20,16,40,0.45); }
  .gallery-last figcaption{ display:none; }
  .gallery-all{ display:none; margin-top:16px; }
  .js .gallery-all{ display:inline-flex; }
  /* ציוד: one titled gallery per group the supplier named */
  .equipment-group{ margin-top:22px; }
  .equipment-group:first-of-type{ margin-top:0; }
  .equipment-group h4{
    display:flex; align-items:center; gap:8px; font-size:15px; margin-bottom:12px; color:var(--ink);
    overflow-wrap:anywhere;
  }
  .equipment-count{
    display:inline-flex; align-items:center; justify-content:center; min-width:24px; height:24px; padding:0 8px;
    border-radius:var(--radius-pill); background:var(--primary-soft); color:var(--primary); font-size:12.5px; font-weight:800;
  }

  /* Small pills in the card's top-left corner, styled like the header's nav buttons.
     Without JS every panel simply stays visible and the pills stay hidden. */
  .profile-tabs{ display:none; }
  .js .profile-tabs{ display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; padding:16px 20px 0; }
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
  /* Only the owner sees these, over the dark hero photo */
  .owner-edit-btn{ background:rgba(255,255,255,0.94); color:var(--primary); }
  .owner-edit-btn:hover{ background:#fff; transform:translateY(-3px); box-shadow:0 12px 26px rgba(10,8,24,0.35); }
  .owner-note{ margin-top:10px; font-size:12.5px; color:rgba(255,255,255,0.85); }
  .review-avg{ font-size:13.5px; font-weight:700; color:var(--ink-soft); margin-inline-start:8px; }
  /* The reviews come first; writing one comes after them */
  .review-note{ background:var(--bg-soft); border-radius:var(--radius-md); padding:14px 16px; font-size:14px; color:var(--ink-soft); margin-top:18px; }
  .review-form{ background:var(--bg-soft); border-radius:var(--radius-md); padding:16px; margin-top:20px; display:grid; gap:14px; }
  .review-form-title{ font-weight:800; font-size:14.5px; }
  .review-form-hint{ font-size:13px; color:var(--muted); margin:-8px 0 0; }
  .score-pickers{ display:grid; gap:12px; }
  .score-picker-label{ font-weight:700; font-size:14px; margin-bottom:6px; }
  .score-row{ display:grid; grid-template-columns:repeat(10, minmax(0, 1fr)); gap:6px; }
  .score-btn{
    height:40px; border-radius:10px; background:#fff; border:1.5px solid var(--line); color:var(--ink-soft);
    font-weight:800; font-size:14.5px; transition:background .15s, border-color .15s, color .15s;
  }
  .score-btn:hover{ border-color:var(--success); color:var(--success); }
  .score-btn.on{ background:var(--success); border-color:var(--success); color:#fff; }
  .score-btn:focus-visible{ outline:3px solid var(--primary-light); outline-offset:1px; }
  .review-overall-preview{ font-size:14px; color:var(--ink-soft); }
  .review-overall-preview strong{ font-size:16px; color:var(--ink); }
  .review-field{ display:grid; gap:6px; font-size:14px; font-weight:700; }
  .review-form textarea, .review-form input[type=text], .review-form select{
    width:100%; font:inherit; font-size:15px; font-weight:400; color:var(--ink);
    padding:11px 14px; background:#fff; border:1.5px solid var(--line); border-radius:var(--radius-md); outline:none;
    transition:border-color .2s, box-shadow .2s;
  }
  .review-form textarea{ resize:vertical; min-height:84px; }
  .review-form textarea:focus, .review-form input[type=text]:focus, .review-form select:focus{ border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-soft); }
  .review-form-error{ background:var(--accent-soft); color:#B8323C; border-radius:var(--radius-md); padding:10px 14px; font-size:13.5px; font-weight:600; }
  .review-form-actions{ display:flex; gap:10px; flex-wrap:wrap; }

  /* One review, laid out like the design: the overall score on the right, the text beside it */
  .review-list{ list-style:none; margin:0; padding:0; display:grid; }
  .review-item{ display:flex; gap:18px; padding:18px 0; border-top:1px solid var(--line); }
  .review-item:first-child{ border-top:none; padding-top:6px; }
  .review-item.is-mine{ background:var(--primary-soft); border-radius:var(--radius-md); padding-inline:14px; border-top-color:transparent; }
  .review-overall{ flex:0 0 auto; display:flex; flex-direction:column; align-items:center; gap:6px; width:64px; }
  .review-overall-num{
    width:56px; height:56px; border-radius:50%; background:#fff; box-shadow:0 2px 10px rgba(26,23,48,0.14);
    display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:500; color:var(--ink);
  }
  .review-overall-label{ font-size:15px; color:var(--ink-soft); }
  .review-main{ flex:1; min-width:0; }
  .review-who{ font-weight:800; font-size:16px; color:var(--primary-dark); overflow-wrap:anywhere; }
  .review-mine-tag{ font-size:12px; font-weight:700; color:var(--primary); background:#fff; border-radius:var(--radius-pill); padding:2px 8px; margin-inline-start:6px; }
  .review-date{ font-size:13.5px; color:var(--muted); margin-top:2px; }
  .review-block{ padding:10px 0; border-top:1px solid var(--line); }
  .review-block:first-of-type{ border-top:none; }
  .review-date + .review-block{ border-top:none; padding-top:12px; }
  .review-label{ font-size:14px; color:var(--primary-dark); margin-bottom:2px; }
  .review-block p{ margin:0; font-size:15px; line-height:1.6; color:var(--ink); white-space:pre-wrap; overflow-wrap:anywhere; }
  .review-scores{ display:flex; flex-wrap:wrap; gap:6px 16px; padding-bottom:0; }
  .review-score{ display:inline-flex; align-items:center; gap:6px; font-size:15px; color:var(--ink); }
  .review-score-num{
    width:26px; height:26px; border-radius:50%; background:var(--success); color:#fff;
    display:inline-flex; align-items:center; justify-content:center; font-size:12px; font-weight:800;
  }
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
  /* מגוון השירותים שלנו: a card per service — one big photo, up to two small ones beside it */
  .service-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:18px; }
  .service-card{
    display:flex; flex-direction:column; border:1.5px solid var(--line); border-radius:var(--radius-lg); overflow:hidden; background:#fff;
    transition:border-color .25s var(--ease-out), transform .25s var(--ease-out), box-shadow .25s var(--ease-out);
  }
  .service-card:hover{ border-color:var(--primary-light); transform:translateY(-3px); box-shadow:var(--shadow-md); }
  /* Fixed 4:3 frame; minmax(0, …) keeps a photo from stretching its row */
  .service-photos{
    display:grid; gap:3px; aspect-ratio:4/3; min-height:0; background:var(--bg-soft);
    grid-template-columns:minmax(0, 1fr); grid-template-rows:minmax(0, 1fr);
  }
  .service-photos.count-2{ grid-template-columns:minmax(0, 2fr) minmax(0, 1fr); }
  .service-photos.count-3{ grid-template-columns:minmax(0, 2fr) minmax(0, 1fr); grid-template-rows:repeat(2, minmax(0, 1fr)); }
  .service-photos.count-3 .service-photo:first-child{ grid-row:span 2; }
  .service-photo{ position:relative; overflow:hidden; min-height:0; cursor:zoom-in; }
  .service-photo img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; transition:transform .4s var(--ease-out); }
  .service-photo:hover img{ transform:scale(1.05); }
  .service-photo:focus-visible{ outline:3px solid var(--primary-light); outline-offset:-3px; }
  .service-body{ padding:16px 18px 18px; }
  .service-body h4{ font-size:16.5px; margin-bottom:6px; overflow-wrap:anywhere; }
  .service-body p{ margin:0; font-size:14px; line-height:1.65; color:var(--ink-soft); white-space:pre-line; overflow-wrap:anywhere; }
  /* Pushed to the bottom so every button in the row lines up */
  .package-cta{ margin-top:auto; justify-content:center; font-size:14.5px; padding:13px 18px; }
  @media (max-width:760px){
    /* Two rows of five, so every score is an easy tap */
    .score-row{ grid-template-columns:repeat(5, minmax(0, 1fr)); }
    .score-btn{ height:44px; }
    .review-item{ gap:12px; }
    .review-overall{ width:52px; }
    .review-overall-num{ width:48px; height:48px; font-size:19px; }
    .profile-hero-brand{ gap:12px; }
    .profile-logo{ width:56px; height:56px; border-radius:14px; padding:5px; }
    .js .profile-tabs{ padding:12px 14px 0; gap:6px; }
    .profile-tab{ padding:8px 12px; font-size:13.5px; }
    .supplier-section{ padding:20px 18px; }
    .supplier-glass-card{ margin-top:-48px; }
    .supplier-gallery-item figcaption{ font-size:12.5px; }
    .supplier-contact a{ padding:8px 0; word-break:break-all; }
    /* Two columns on a phone; with an odd count the first tile is full width */
    .gallery-mosaic{ grid-template-columns:repeat(2, minmax(0, 1fr)); }
    .gallery-mosaic > .supplier-gallery-item{ grid-column:auto; aspect-ratio:1; }
    .gallery-mosaic > .supplier-gallery-item.m-wide{ grid-column:span 2; aspect-ratio:16/10; }
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
      ${(whatsapp || isOwner || adminEdit) ? `
      <div class="profile-hero-actions">
        ${whatsapp ? `<a href="${whatsapp}" target="_blank" rel="noopener" class="btn whatsapp-cta">צרו קשר בוואטסאפ</a>` : ''}
        ${isOwner ? '<a href="/edit-profile.html" class="btn owner-edit-btn">✏️ עריכת הפרופיל שלי</a>' : ''}
        ${adminEdit ? `<a href="/edit-profile.html?id=${encodeURIComponent(supplier.id)}" class="btn owner-edit-btn">✏️ עריכה (מנהל)</a>` : ''}
      </div>
      ${isOwner ? '<p class="owner-note">הכפתור הזה מופיע רק לכם, לא ללקוחות.</p>' : ''}
      ${adminEdit ? '<p class="owner-note">הכפתור הזה מופיע רק למנהלים, לא ללקוחות.</p>' : ''}` : ''}
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
        // Deliberately the same general enquiry as the header button: the
        // message does not name the package or its price.
        const enquiry = waLink(phone, enquiryText(name));
        return `
        <article class="package-card">
          <h4>${escapeHtml(p.name)}</h4>
          <div class="package-price${p.price ? '' : ' is-quote'}">${escapeHtml(priceText(p.price))}</div>
          ${p.items && p.items.length ? `<ul>${p.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}
          ${enquiry ? `<a class="btn whatsapp-cta btn-block package-cta" href="${enquiry}" target="_blank" rel="noopener">${whatsappIcon} צרו קשר בוואטסאפ</a>` : ''}
        </article>`;
      }).join('')}</div>
    </div>`}

    ${!services.length ? '' : `
    <div class="supplier-section tab-panel" id="panel-services" role="tabpanel" aria-labelledby="tab-services">
      <h3>מגוון השירותים שלנו</h3>
      <div class="service-grid">${services.map((svc) => `
        <article class="service-card">
          <div class="service-photos count-${svc.photos.length}">
            ${svc.photos.map((p, i) => `
            <figure class="service-photo" style="margin:0;" data-lb-type="image" data-lb-src="${escapeHtml(p.url)}" data-lb-caption="${escapeHtml(svc.name)}">
              <img src="${escapeHtml(p.url)}" alt="${escapeHtml(i === 0 ? svc.name : `${svc.name} — תמונה ${i + 1}`)}" loading="lazy">
            </figure>`).join('')}
          </div>
          <div class="service-body">
            <h4>${escapeHtml(svc.name)}</h4>
            ${svc.description ? `<p>${escapeHtml(svc.description)}</p>` : ''}
          </div>
        </article>`).join('')}
      </div>
    </div>`}

    <div class="supplier-section tab-panel" id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews">
      ${reviewsPanel(supplier, reviews, viewer)}
    </div>

    <div class="supplier-section">
      <h3>${video ? 'תמונות וסרטון' : 'תמונות'}</h3>
      <div class="gallery-block">
      <div class="gallery-grid gallery-mosaic">
        ${!video ? '' : videoTile(video, { classes: gallery.classes(0), poster: backgroundImage, caption: name })}
        ${productImages.map((p, i) => {
          const t = i + (video ? 1 : 0);
          return `
          <figure class="supplier-gallery-item ${gallery.classes(t)}" style="margin:0;" data-lb-type="image" data-lb-src="${escapeHtml(p.file)}" data-lb-caption="${escapeHtml(p.caption)}"${gallery.isLast(t) ? ` aria-label="${escapeHtml(`${p.caption} — ועוד ${gallery.hiddenCount} תמונות`)}"` : ''}>
            <img src="${escapeHtml(p.file)}" alt="${escapeHtml(p.caption)}" loading="lazy">
            <figcaption>${escapeHtml(p.caption)}</figcaption>
            ${gallery.badge(t)}
          </figure>`;
        }).join('')}
      </div>
      ${gallery.collapsed ? `<button type="button" class="btn btn-secondary btn-sm gallery-all">📷 הצגת כל ${productImages.length} התמונות${video ? ' והסרטון' : ''}</button>` : ''}
      </div>
    </div>

    ${!equipment.length ? '' : `
    <div class="supplier-section supplier-equipment" id="equipment">
      <h3>ציוד</h3>
      ${equipment.map((g) => equipmentGroup(g, backgroundImage)).join('')}
    </div>`}

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
<script>
(function(){
  if(!window.Lightbox) return;
  // Each gallery (the photos, and every equipment group) is its own viewer.
  // "Show all" opens it at the first tile; it has every photo.
  Array.prototype.forEach.call(document.querySelectorAll('.gallery-block'), function(block){
    var grid = block.querySelector('.gallery-grid');
    window.Lightbox.attach(grid);
    var all = block.querySelector('.gallery-all');
    var first = grid.querySelector('[data-lb-src]');
    if(all && first) all.addEventListener('click', function(){ first.click(); });
  });
  // Each service opens its own photos.
  Array.prototype.forEach.call(document.querySelectorAll('.service-photos'), function(el){ window.Lightbox.attach(el); });
})();
</script>
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
  var errorBox = form.querySelector('.review-form-error');
  var textarea = form.querySelector('textarea');
  var serviceInput = form.querySelector('input[name=service]');
  var citySelect = form.querySelector('select[name=city]');
  var overallEl = form.querySelector('[data-overall]');
  var pickers = Array.prototype.slice.call(form.querySelectorAll('.score-picker'));
  var scores = {};
  pickers.forEach(function(p){
    var on = p.querySelector('.score-btn.on');
    scores[p.getAttribute('data-key')] = on ? Number(on.getAttribute('data-v')) : 0;
  });

  function paint(p){
    var value = scores[p.getAttribute('data-key')];
    p.querySelectorAll('.score-btn').forEach(function(b){
      var on = Number(b.getAttribute('data-v')) === value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    var all = pickers.map(function(x){ return scores[x.getAttribute('data-key')]; });
    overallEl.textContent = all.every(Boolean)
      ? String(Math.round(all.reduce(function(a, b){ return a + b; }, 0) / all.length * 10) / 10)
      : '—';
  }
  pickers.forEach(function(p){
    var buttons = Array.prototype.slice.call(p.querySelectorAll('.score-btn'));
    buttons.forEach(function(b, i){
      b.addEventListener('click', function(){ scores[p.getAttribute('data-key')] = Number(b.getAttribute('data-v')); paint(p); });
      // Right-to-left: the left arrow goes up a point, the right one down.
      b.addEventListener('keydown', function(e){
        var to = e.key === 'ArrowLeft' ? i + 1 : e.key === 'ArrowRight' ? i - 1 : null;
        if(to === null || to < 0 || to >= buttons.length) return;
        e.preventDefault();
        buttons[to].focus();
        buttons[to].click();
      });
    });
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
    var missing = pickers.filter(function(p){ return !scores[p.getAttribute('data-key')]; })[0];
    if(missing){ fail('יש לתת ציון ל' + missing.querySelector('.score-picker-label').textContent + '.'); return; }
    if(!serviceInput.value.trim()){ fail('יש לכתוב איזה שירות קיבלתם.'); serviceInput.focus(); return; }
    if(!textarea.value.trim()){ fail('יש לכתוב חוות דעת.'); textarea.focus(); return; }
    var button = form.querySelector('button[type=submit]');
    button.disabled = true;
    request('PUT', { scores: scores, service: serviceInput.value, city: citySelect.value, text: textarea.value })
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

module.exports = { supplierViewPage, galleryLayout };
