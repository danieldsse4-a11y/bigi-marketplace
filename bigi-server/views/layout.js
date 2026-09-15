// Shared HTML shell for the admin/server-rendered pages. Reuses the existing
// static site's styles.css (served from /assets/styles.css by server.js) so
// everything looks like one product instead of a bolted-on tool.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function page({ title, body, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700;800&family=Heebo:wght@400;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔐</text></svg>">
<style>
  body{ background:var(--bg-soft); }
  .admin-wrap{ max-width:640px; margin:0 auto; padding:48px 24px 80px; }
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
  .remove-row-btn:hover{ background:var(--accent); color:#fff; }
  .bg-preview-note{ background:var(--primary-soft); color:var(--primary); border-radius:var(--radius-md); padding:10px 14px; font-size:12.5px; margin-top:8px; }
  .link-box{ display:flex; gap:8px; align-items:center; background:var(--bg-soft); border:1px dashed var(--line); border-radius:var(--radius-md); padding:12px 14px; font-size:13px; word-break:break-all; }
</style>
${extraHead}
</head>
<body>
<div class="admin-wrap">
${body}
</div>
</body>
</html>`;
}

module.exports = { page, escapeHtml };
