const { page, adminTabs, escapeHtml } = require('./layout');

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });

const ROLE_LABEL = { customer: 'לקוח', supplier: 'ספק' };

function accountRow(row) {
  const meta = [
    ROLE_LABEL[row.role] || row.role,
    row.createdAt && `נרשם ${dateFmt.format(new Date(row.createdAt))}`,
  ].filter(Boolean).map(escapeHtml).join(' · ');

  const tags = [
    row.isAdmin ? '<span class="account-chip admin">מנהל</span>' : '',
    row.adminPending ? '<span class="account-chip pending">ממתין לאישור מנהל</span>' : '',
    row.profileName
      ? `<span class="account-chip profile">פרופיל: ${escapeHtml(row.profileName)}${row.profilePublished ? ' (פעיל)' : ' (דמו)'}</span>`
      : '',
  ].join('');

  // An account that owns a profile can't be deleted until the profile is gone.
  const blocked = Boolean(row.profileName);
  return `
    <div class="profile-row account-row" data-account="${escapeHtml(row.id)}">
      <div class="profile-info">
        <div class="profile-name">${escapeHtml(row.name)}${tags}</div>
        <div class="profile-meta">${escapeHtml(row.email)}</div>
        <div class="profile-meta">${meta}</div>
      </div>
      <button type="button" class="delete-btn" data-delete-account="${escapeHtml(row.id)}"
        data-name="${escapeHtml(row.name)}" data-email="${escapeHtml(row.email)}"
        ${blocked ? 'disabled title="יש למחוק קודם את הפרופיל של החשבון"' : ''}>מחיקה</button>
    </div>`;
}

function accountsPage({ adminEmail, accounts }) {
  const suppliers = accounts.filter((a) => a.role === 'supplier');
  const customers = accounts.filter((a) => a.role !== 'supplier');

  const body = `
    ${adminTabs('accounts')}
    <div class="admin-card">
      <div class="admin-card-head">
        <h1 style="margin-bottom:0;">👥 חשבונות</h1>
        <form method="POST" action="/admin-suppliers/logout" style="max-width:100%;"><button type="submit" class="btn btn-ghost btn-sm admin-logout-btn">התנתקות (${escapeHtml(adminEmail)})</button></form>
      </div>
      <p class="lead">כל מי שנרשם לאתר. מחיקה מוחקת את החשבון ואת ההתחברויות שלו לצמיתות — <strong>אי אפשר לבטל אותה</strong>. חשבון שיש לו פרופיל ספק יימחק רק אחרי מחיקת הפרופיל ב"כל הפרופילים".</p>

      <h2 class="profiles-group-title">ספקים <small>(${suppliers.length})</small></h2>
      ${suppliers.length ? suppliers.map(accountRow).join('') : '<div class="empty-profiles">אין עדיין חשבונות ספק.</div>'}

      <h2 class="profiles-group-title">לקוחות <small>(${customers.length})</small></h2>
      ${customers.length ? customers.map(accountRow).join('') : '<div class="empty-profiles">אין עדיין חשבונות לקוח.</div>'}
    </div>

    <div class="admin-toast" id="admin-toast" role="status" aria-live="polite"></div>

    <script>
      (function(){
        var toast = document.getElementById('admin-toast');
        var toastTimer;
        function showToast(text, isError){
          toast.textContent = text;
          toast.classList.toggle('error', !!isError);
          toast.classList.add('show');
          clearTimeout(toastTimer);
          toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 3200);
        }

        document.querySelectorAll('[data-delete-account]').forEach(function(btn){
          btn.addEventListener('click', function(){
            var name = btn.dataset.name;
            if (!window.confirm('למחוק את החשבון של ' + name + ' (' + btn.dataset.email + ')?\\n\\nאי אפשר לבטל את הפעולה.')) return;
            btn.disabled = true;
            fetch('/admin-suppliers/accounts/' + encodeURIComponent(btn.dataset.deleteAccount) + '/delete', {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}'
            })
              .then(function(r){
                if (r.status === 401) { location.href = '/admin-suppliers/login'; throw new Error('auth'); }
                return r.json().then(function(data){ return { ok: r.ok, data: data }; });
              })
              .then(function(res){
                if (!res.ok) throw new Error(res.data.error || 'המחיקה נכשלה');
                var row = btn.closest('.account-row');
                row.parentNode.removeChild(row);
                showToast('החשבון של ' + name + ' נמחק');
              })
              .catch(function(err){
                if (err.message === 'auth') return;
                btn.disabled = false;
                showToast(err.message, true);
              });
          });
        });
      })();
    </script>
  `;
  return page({ title: 'חשבונות — אזור ניהול', body, wide: true });
}

module.exports = { accountsPage };
