const { page, adminTabs, escapeHtml } = require('./layout');

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

function row(r) {
  return `
    <div class="profile-row review-row" data-review="${escapeHtml(r.id)}">
      <div class="profile-info">
        <div class="profile-name" style="white-space:normal;">
          <span class="review-stars-admin" aria-label="${r.rating} מתוך 5">${stars(r.rating)}</span>
          ${escapeHtml(r.supplierName)}
        </div>
        <div class="profile-meta">
          ${escapeHtml(r.reviewerName)}${r.reviewerEmail ? ` · <span class="ltr-value">${escapeHtml(r.reviewerEmail)}</span>` : ''}
          · ${dateFmt.format(new Date(r.createdAt))}
        </div>
        ${r.text ? `<p class="review-admin-text">${escapeHtml(r.text)}</p>` : '<div class="profile-meta">ללא טקסט</div>'}
        <div class="profile-links">
          <a href="/supplier/view/${escapeHtml(r.supplierId)}#reviews" target="_blank" rel="noopener">צפייה בפרופיל ↗</a>
        </div>
      </div>
      <button type="button" class="delete-btn" data-delete-review="${escapeHtml(r.id)}">מחיקה</button>
    </div>`;
}

function reviewsPage({ adminEmail, rows }) {
  const body = `
    ${adminTabs('reviews')}
    <div class="admin-card">
      <div class="admin-card-head">
        <h1 style="margin-bottom:0;">💬 ביקורות</h1>
        <form method="POST" action="/admin-suppliers/logout" style="max-width:100%;"><button type="submit" class="btn btn-ghost btn-sm admin-logout-btn">התנתקות (${escapeHtml(adminEmail)})</button></form>
      </div>
      <p class="lead">כל לקוח מחובר יכול לכתוב ביקורת על פרופיל שפורסם. כאן אפשר להסיר ביקורת לא הולמת — המחיקה מיידית ואי אפשר לבטל אותה. <a href="/admin-suppliers/profiles" style="color:var(--primary); font-weight:700;">← כל הפרופילים</a></p>

      <div id="review-list">
        ${rows.length ? rows.map(row).join('') : '<div class="empty-profiles">עדיין אין ביקורות.</div>'}
      </div>
    </div>
    <div class="admin-toast" id="admin-toast" role="status" aria-live="polite"></div>
    <script>
      (function(){
        var toast = document.getElementById('admin-toast');
        function showToast(text, isError){
          toast.textContent = text;
          toast.classList.toggle('error', Boolean(isError));
          toast.classList.add('show');
          setTimeout(function(){ toast.classList.remove('show'); }, 2600);
        }
        document.querySelectorAll('[data-delete-review]').forEach(function(btn){
          btn.addEventListener('click', function(){
            if (!window.confirm('למחוק את הביקורת הזו?\\n\\nהמחיקה מיידית ואי אפשר לבטל אותה.')) return;
            btn.disabled = true;
            fetch('/admin-suppliers/reviews/' + encodeURIComponent(btn.dataset.deleteReview) + '/delete', {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}'
            })
              .then(function(r){
                if (r.status === 401) { location.href = '/admin-suppliers/login'; throw new Error('auth'); }
                if (!r.ok) throw new Error('http ' + r.status);
                btn.closest('.review-row').remove();
                if (!document.querySelector('.review-row')) {
                  document.getElementById('review-list').innerHTML = '<div class="empty-profiles">עדיין אין ביקורות.</div>';
                }
                showToast('הביקורת נמחקה');
              })
              .catch(function(err){
                if (err.message === 'auth') return;
                btn.disabled = false;
                showToast('המחיקה נכשלה — נסו שוב', true);
              });
          });
        });
      })();
    </script>`;
  return page({ title: 'ביקורות — אזור ניהול', body, wide: true });
}

module.exports = { reviewsPage };
