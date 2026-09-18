// Shared HTML shell for the admin/server-rendered pages. Reuses the existing
// static site's styles.css (served from /assets/styles.css by server.js) so
// everything looks like one product instead of a bolted-on tool.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function adminTabs(active) {
  const tab = (href, key, label) => `<a href="${href}"${active === key ? ' class="active" aria-current="page"' : ''}>${label}</a>`;
  return `<nav class="admin-tabs" aria-label="אזור ניהול">
    ${tab('/admin-suppliers', 'create', '➕ פרופיל חדש')}
    ${tab('/admin-suppliers/profiles', 'profiles', '📋 כל הפרופילים')}
    ${tab('/admin-suppliers/featured', 'featured', '⭐ מומלצים')}
    ${tab('/admin-suppliers/accounts', 'accounts', '👥 חשבונות')}
    ${tab('/admin-suppliers/email', 'email', '✉️ מיילים')}
  </nav>`;
}

function page({ title, body, extraHead = '', wide = false }) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#6C5CE7">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔐</text></svg>">
<style>
  body{ background:var(--bg-soft); }
  /* One width for every admin page: the tab bar and logo must not move when
     you switch tabs. Only the card inside narrows on the form pages. */
  .admin-wrap{ max-width:880px; margin:0 auto; padding:48px 24px 80px; }
  .admin-wrap:not(.wide) .admin-card{ max-width:592px; margin-inline:auto; }
  .admin-card{ background:#fff; border-radius:var(--radius-xl); box-shadow:var(--shadow-lg); padding:40px; }
  .admin-card h1{ font-size:22px; margin-bottom:8px; }
  .admin-card > p.lead{ color:var(--muted); margin-bottom:28px; }
  .admin-alert{ padding:14px 18px; border-radius:var(--radius-md); font-size:14px; margin-bottom:22px; }
  .admin-alert.error{ background:var(--accent-soft); color:#B8323C; }
  .admin-alert.success{ background:#E6F9F5; color:#0C8A6E; }
  .field-hint{ font-size:12px; color:var(--muted); margin-top:6px; }
  .product-photo-row{ display:flex; gap:12px; align-items:flex-start; border:1px solid var(--line); border-radius:var(--radius-md); padding:14px; margin-bottom:12px; }
  .product-photo-row .form-field{ flex:1; margin-bottom:0; }
  .product-photo-row input[type=file]{ width:100%; font-size:13px; }
  /* Hebrew stand-in for the browser's own file button (see enhanceFileInput) */
  .file-drop{
    position:relative; display:flex; align-items:center; gap:10px; min-width:0;
    padding:9px 12px; border:1.5px dashed var(--line); border-radius:var(--radius-md);
    background:var(--bg-soft); cursor:pointer; transition:border-color .25s, background .25s;
  }
  .file-drop:hover{ border-color:var(--primary); }
  .file-drop input[type=file]{ position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
  .file-drop-btn{
    padding:7px 14px; border-radius:var(--radius-pill); background:var(--primary-soft); color:var(--primary);
    font-weight:700; font-size:13px; white-space:nowrap; flex-shrink:0;
  }
  .file-drop-name{ font-size:13px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .file-drop.has-file{ border-style:solid; border-color:var(--primary); background:#fff; }
  .file-drop.has-file .file-drop-name{ color:var(--ink); font-weight:600; }
  .remove-row-btn:hover{ background:var(--accent); color:#fff; }
  .bg-preview-note{ background:var(--primary-soft); color:var(--primary); border-radius:var(--radius-md); padding:10px 14px; font-size:12.5px; margin-top:8px; }
  .link-box{ display:flex; gap:8px; align-items:center; background:var(--bg-soft); border:1px dashed var(--line); border-radius:var(--radius-md); padding:12px 14px; font-size:13px; word-break:break-all; }
  .admin-card-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:8px; }
  /* The only way back to the site from inside the admin area */
  .admin-home{ display:inline-flex; width:max-content; vertical-align:middle; font-size:21px; margin-bottom:16px; margin-inline-end:20px; padding:4px 2px; transition:opacity .2s; }
  .admin-home:hover{ opacity:.72; }
  .admin-home:focus-visible{ outline:3px solid var(--primary-light); outline-offset:4px; border-radius:8px; }
  /* Sized to its own labels, so the bar is identical on every tab */
  .admin-tabs{ display:inline-flex; width:max-content; max-width:100%; vertical-align:middle; gap:6px; background:#fff; border-radius:var(--radius-pill); padding:5px; box-shadow:var(--shadow-sm); margin-bottom:18px; }
  .admin-tabs a{ flex:0 0 auto; text-align:center; padding:11px 18px; border-radius:var(--radius-pill); font-weight:700; font-size:14px; color:var(--muted); white-space:nowrap; }
  .admin-tabs a.active{ background:var(--primary-soft); color:var(--primary); }

  .profiles-filters{ display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 18px; }
  .profiles-filters button{ padding:9px 16px; border-radius:var(--radius-pill); border:1.5px solid var(--line); font-weight:700; font-size:13.5px; color:var(--ink-soft); background:#fff; }
  .profiles-filters button.active{ background:var(--primary); border-color:var(--primary); color:#fff; }
  .profiles-group-title{ font-size:15px; margin:26px 0 10px; display:flex; align-items:center; gap:8px; }
  .profiles-group-title small{ color:var(--muted); font-weight:600; font-size:12.5px; }
  .profile-row{ display:flex; align-items:center; gap:14px; padding:12px; border:1px solid var(--line); border-radius:var(--radius-md); margin-bottom:10px; background:#fff; }
  .profile-row[hidden]{ display:none; }
  .profile-thumb{ width:56px; height:56px; border-radius:14px; flex-shrink:0; background-size:cover; background-position:center; display:flex; align-items:center; justify-content:center; font-size:26px; }
  .profile-info{ flex:1; min-width:0; }
  .profile-name{ font-weight:800; font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .profile-meta{ color:var(--muted); font-size:12.5px; margin-top:2px; }
  .profile-links{ display:flex; flex-wrap:wrap; gap:4px 12px; margin-top:6px; font-size:13px; font-weight:700; }
  .profile-links a,.profile-links button{ color:var(--primary); padding:4px 0; font-weight:700; font-size:13px; }
  .profile-links .delete-link{ color:var(--accent); }
  .profile-links .delete-link:hover{ text-decoration:underline; }
  .profile-links .delete-link[disabled]{ color:var(--muted); cursor:default; text-decoration:none; }
  /* The chips explain why a delete button is disabled, so the name wraps
     instead of cutting them off on a narrow screen. */
  .account-row .profile-info{ min-width:0; }
  .account-row .profile-name{ white-space:normal; overflow:visible; text-overflow:clip; }
  .account-chip{ display:inline-block; margin-inline-start:6px; padding:2px 8px; border-radius:var(--radius-pill); font-size:11.5px; font-weight:800; vertical-align:middle; }
  .account-chip.admin{ background:var(--primary-soft); color:var(--primary); }
  .account-chip.pending{ background:#FFF4DB; color:#9A6700; }
  .account-chip.profile{ background:var(--bg-soft); color:var(--ink-soft); }
  .delete-btn{
    flex-shrink:0; padding:9px 16px; border-radius:var(--radius-pill); font-weight:700; font-size:13px;
    background:var(--accent-soft); color:#B8323C; transition:background .2s, color .2s;
  }
  .delete-btn:hover:not([disabled]){ background:var(--accent); color:#fff; }
  .delete-btn[disabled]{ background:var(--bg-soft); color:var(--muted); cursor:default; }
  .email-verdict{ padding:16px 18px; border-radius:var(--radius-md); margin:18px 0; font-size:14px; line-height:1.6; }
  .email-verdict strong{ display:block; margin-bottom:4px; font-size:15px; }
  .email-verdict.ok{ background:#E6F9F5; color:#0C6E58; }
  .email-verdict.warn{ background:#FFF4DB; color:#8A5A00; }
  .email-verdict.error{ background:var(--accent-soft); color:#B8323C; }
  .email-facts{ display:grid; gap:10px; }
  .email-facts dt{ font-size:12.5px; color:var(--muted); }
  .email-facts dd{ font-size:14px; font-weight:700; word-break:break-all; }
  /* Addresses and domains are Latin text inside an RTL page */
  .ltr-value{ display:inline-block; direction:ltr; text-align:start; unicode-bidi:isolate; }
  .email-domains{ display:grid; gap:8px; font-size:14px; }
  .email-domains li{ padding:10px 14px; border:1px solid var(--line); border-radius:var(--radius-md); }
  .email-none{ color:var(--muted); font-size:14px; }
  .email-result{ margin-top:14px; padding:12px 16px; border-radius:var(--radius-md); font-size:14px; background:var(--bg-soft); word-break:break-word; }
  .email-result.ok{ background:#E6F9F5; color:#0C6E58; }
  .email-result.error{ background:var(--accent-soft); color:#B8323C; }
  .empty-profiles{ text-align:center; padding:26px 12px; color:var(--muted); border:1px dashed var(--line); border-radius:var(--radius-md); }
  .empty-profiles .btn{ margin-top:14px; }

  .visibility-switch{ display:flex; flex-direction:column; align-items:center; gap:5px; flex-shrink:0; min-width:74px; background:none; padding:4px; }
  .switch-track{ width:52px; height:30px; border-radius:var(--radius-pill); background:#D8D5E6; position:relative; transition:background .25s; }
  .switch-knob{ position:absolute; top:3px; right:3px; width:24px; height:24px; border-radius:50%; background:#fff; box-shadow:0 2px 6px rgba(26,23,48,0.25); transition:transform .3s var(--ease-spring); }
  .visibility-switch[aria-checked="true"] .switch-track{ background:var(--success); }
  .visibility-switch[aria-checked="true"] .switch-knob{ transform:translateX(-22px); }
  .switch-label{ font-size:12px; font-weight:800; color:var(--muted); white-space:nowrap; }
  .visibility-switch[aria-checked="true"] .switch-label{ color:var(--success); }
  .visibility-switch[aria-busy="true"]{ opacity:.6; pointer-events:none; }
  .visibility-switch:focus-visible{ outline:3px solid var(--primary-light); outline-offset:2px; border-radius:12px; }

  .review-stars-admin{ color:#F5A623; letter-spacing:1px; margin-inline-end:6px; }
  .review-admin-text{ margin:8px 0 0; font-size:14px; line-height:1.6; color:var(--ink-soft); white-space:pre-wrap; overflow-wrap:anywhere; }
  .badge-pick{ display:flex; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap; }
  .badge-pick-label{ font-size:12px; font-weight:800; color:var(--muted); }
  .badge-select{
    padding:7px 10px; border-radius:var(--radius-md); border:1.5px solid var(--line);
    background:#fff; font-size:13px; font-weight:600; color:var(--ink); max-width:100%;
  }
  .badge-select:focus{ border-color:var(--primary); outline:none; box-shadow:0 0 0 3px var(--primary-soft); }
  .badge-select:disabled{ opacity:.55; }
  .badge-pick-locked{ margin-top:8px; font-size:12px; font-weight:700; color:var(--muted); }
  .featured-chip{ display:inline-block; margin-inline-start:6px; padding:2px 8px; border-radius:var(--radius-pill); background:#FFF4DB; color:#9A6700; font-size:11.5px; font-weight:800; vertical-align:middle; }
  .demo-note{ color:#9A6700; font-weight:700; }

  .featured-list{ list-style:none; margin:0; padding:0; counter-reset:rank; }
  .featured-row{ display:flex; align-items:center; gap:12px; padding:10px 12px; border:1px solid var(--line); border-radius:var(--radius-md); margin-bottom:8px; background:#fff; }
  .featured-row.is-featured{ border-color:#F5D67A; background:#FFFCF2; }
  .featured-rank{ width:28px; height:28px; flex-shrink:0; border-radius:50%; background:var(--grad-main); color:#fff; font-weight:800; font-size:13px; display:flex; align-items:center; justify-content:center; }
  .featured-actions{ display:flex; gap:6px; flex-shrink:0; }
  .icon-btn{ width:40px; height:40px; border-radius:12px; background:var(--bg-soft); border:1px solid var(--line); color:var(--ink-soft); font-size:16px; font-weight:800; display:flex; align-items:center; justify-content:center; }
  .icon-btn:hover:not(:disabled){ background:var(--primary-soft); color:var(--primary); border-color:var(--primary-light); }
  .icon-btn:disabled{ opacity:.35; cursor:default; }
  .icon-btn.danger:hover{ background:var(--accent-soft); color:var(--accent); border-color:var(--accent-light); }
  .add-btn{ padding:9px 14px; border-radius:var(--radius-pill); background:var(--primary-soft); color:var(--primary); font-weight:800; font-size:13.5px; flex-shrink:0; min-height:40px; }
  .add-btn:hover:not(:disabled){ background:var(--primary); color:#fff; }
  .add-btn:disabled{ opacity:.45; cursor:default; }
  .featured-search{ width:100%; padding:12px 16px; border-radius:var(--radius-pill); border:1.5px solid var(--line); font-size:15px; outline:none; margin-bottom:12px; }
  .featured-search:focus{ border-color:var(--primary); box-shadow:0 0 0 3px var(--primary-soft); }

  .admin-toast{ position:fixed; bottom:24px; left:50%; transform:translate(-50%, 30px); opacity:0; background:var(--ink); color:#fff; padding:12px 20px; border-radius:var(--radius-pill); font-weight:700; font-size:14px; transition:all .3s var(--ease-out); z-index:50; max-width:calc(100% - 32px); text-align:center; }
  .admin-toast.show{ opacity:1; transform:translate(-50%, 0); }
  .admin-toast.error{ background:#B8323C; }
  .photo-caption-input{ margin-top:8px; width:100%; padding:11px 14px; border-radius:var(--radius-md); border:1.5px solid var(--line); font-size:13.5px; }
  @media (max-width:760px){
    .admin-wrap{ padding:20px 16px 60px; }
    .admin-home{ font-size:19px; margin-bottom:12px; }
    .admin-card{ padding:24px 18px; border-radius:var(--radius-lg); }
    .admin-logout-btn{ white-space:normal; text-align:center; max-width:100%; }
    .photo-caption-input{ font-size:16px; }
    .product-photo-row{ padding:12px; }
    .remove-row-btn{ width:36px !important; height:36px !important; }
    .profile-row{ gap:10px; padding:10px; }
    .profile-thumb{ width:48px; height:48px; font-size:22px; }
    .profile-meta{ font-size:12px; }
    .profiles-filters button{ padding:10px 14px; }
    /* Too narrow to hug the labels — share the width out instead */
    .admin-tabs{ display:flex; width:auto; gap:2px; padding:4px; }
    .admin-tabs a{ flex:1; padding:10px 6px; font-size:13px; white-space:normal; }
    .featured-row{ gap:8px 10px; padding:10px; flex-wrap:wrap; }
    .featured-row .profile-info{ flex:1 1 150px; }
    .featured-row .profile-name{ white-space:normal; }
    .featured-actions{ flex-basis:100%; justify-content:flex-end; }
    .featured-search{ font-size:16px; }
  }
</style>
${extraHead}
</head>
<body>
<div class="admin-wrap${wide ? ' wide' : ''}">
<a href="/" class="logo admin-home" aria-label="חזרה לאתר הראשי">ביגי ספקים<span class="dot">.</span></a>
${body}
</div>
</body>
</html>`;
}

// A simple centered message (errors, confirmations) in the admin look.
function messagePage({ title, heading, text, linkHref, linkLabel, isError = false }) {
  const body = `
    <div class="admin-card" style="text-align:center;">
      <div style="font-size:48px; margin-bottom:10px;">${isError ? '⚠️' : '✅'}</div>
      <h1>${escapeHtml(heading)}</h1>
      <p class="lead">${escapeHtml(text)}</p>
      ${linkHref ? `<a href="${escapeHtml(linkHref)}" class="btn btn-primary">${escapeHtml(linkLabel)}</a>` : ''}
    </div>`;
  return page({ title, body });
}

module.exports = { page, adminTabs, messagePage, escapeHtml };
