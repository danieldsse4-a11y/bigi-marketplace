const { page, adminTabs, escapeHtml } = require('./layout');

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric' });

function visibilitySwitch(row) {
  return `<button type="button" class="visibility-switch" role="switch"
      aria-checked="${row.published}" data-key="${escapeHtml(row.key)}"
      aria-label="${escapeHtml(row.name)} — פעיל באתר">
    <span class="switch-track"><span class="switch-knob"></span></span>
    <span class="switch-label">${row.published ? 'פעיל באתר' : 'דמו'}</span>
  </button>`;
}

function createdRow(row) {
  const meta = [row.categoryLabel, row.city, row.createdAt && `נוצר ${dateFmt.format(new Date(row.createdAt))}`]
    .filter(Boolean).map(escapeHtml).join(' · ');
  const thumbStyle = row.image ? `background-image:url('${escapeHtml(row.image)}')` : 'background:var(--g1)';
  return `
    <div class="profile-row" data-state="${row.published ? 'live' : 'demo'}">
      <div class="profile-thumb" style="${thumbStyle}"></div>
      <div class="profile-info">
        <div class="profile-name">${escapeHtml(row.name)}${row.featured ? '<span class="featured-chip">⭐ מומלץ</span>' : ''}</div>
        <div class="profile-meta">${meta}</div>
        ${row.createdBy ? `<div class="profile-meta">${row.fromSupplier ? 'נשלח על ידי הספק' : 'נוצר על ידי'} ${escapeHtml(row.createdBy)}</div>` : ''}
        <div class="profile-links">
          <a href="${escapeHtml(row.viewUrl)}" target="_blank" rel="noopener">צפייה ↗</a>
          <button type="button" data-copy="${escapeHtml(row.viewUrl)}">העתקת קישור</button>
        </div>
      </div>
      ${visibilitySwitch(row)}
    </div>`;
}

function sampleRow(row) {
  const meta = [row.categoryLabel, row.city].filter(Boolean).map(escapeHtml).join(' · ');
  return `
    <div class="profile-row" data-state="${row.published ? 'live' : 'demo'}">
      <div class="profile-thumb" style="background:var(--${escapeHtml(row.grad || 'g1')})">${escapeHtml(row.emoji || '')}</div>
      <div class="profile-info">
        <div class="profile-name">${escapeHtml(row.name)}${row.featured ? '<span class="featured-chip">⭐ מומלץ</span>' : ''}</div>
        <div class="profile-meta">${meta}</div>
        <div class="profile-links">
          <a href="${escapeHtml(row.viewUrl)}" target="_blank" rel="noopener">צפייה ↗</a>
        </div>
      </div>
      ${visibilitySwitch(row)}
    </div>`;
}

function profilesPage({ adminEmail, fromSuppliers, created, samples }) {
  const all = [...fromSuppliers, ...created, ...samples];
  const liveCount = all.filter((r) => r.published).length;

  const body = `
    ${adminTabs('profiles')}
    <div class="admin-card">
      <div class="admin-card-head">
        <h1 style="margin-bottom:0;">📋 כל הפרופילים</h1>
        <form method="POST" action="/admin-suppliers/logout" style="max-width:100%;"><button type="submit" class="btn btn-ghost btn-sm admin-logout-btn">התנתקות (${escapeHtml(adminEmail)})</button></form>
      </div>
      <p class="lead">הזיזו את המתג כדי לפרסם פרופיל באתר (<strong>פעיל באתר</strong>) או להחזיר אותו ל<strong>דמו</strong> — פרופיל דמו לא מופיע באתר הציבורי, והקישור הפרטי שלו ממשיך לעבוד.</p>

      <div class="profiles-filters" role="group" aria-label="סינון">
        <button type="button" class="active" data-filter="all">הכל (<span data-count="all">${all.length}</span>)</button>
        <button type="button" data-filter="demo">דמו (<span data-count="demo">${all.length - liveCount}</span>)</button>
        <button type="button" data-filter="live">פעילים באתר (<span data-count="live">${liveCount}</span>)</button>
      </div>

      <h2 class="profiles-group-title">פרופילים שספקים שלחו <small>(${fromSuppliers.length}) — מופיעים באתר רק אחרי שתפעילו אותם</small></h2>
      ${fromSuppliers.length
        ? fromSuppliers.map(createdRow).join('')
        : `<div class="empty-profiles">עדיין אף ספק לא שלח פרופיל דרך "הצטרפות כספק".</div>`}

      <h2 class="profiles-group-title">פרופילים שנוצרו באזור הניהול <small>(${created.length})</small></h2>
      ${created.length
        ? created.map(createdRow).join('')
        : `<div class="empty-profiles">עדיין לא נוצרו פרופילים.<br><a href="/admin-suppliers" class="btn btn-primary btn-sm">יצירת פרופיל ראשון</a></div>`}

      <h2 class="profiles-group-title">ספקים לדוגמה <small>(${samples.length})</small></h2>
      ${samples.map(sampleRow).join('')}
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
          toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 2600);
        }

        var currentFilter = 'all';
        function applyFilter(){
          document.querySelectorAll('.profile-row').forEach(function(row){
            row.hidden = currentFilter !== 'all' && row.dataset.state !== currentFilter;
          });
        }
        function updateCounts(){
          var rows = document.querySelectorAll('.profile-row');
          var live = document.querySelectorAll('.profile-row[data-state="live"]').length;
          document.querySelector('[data-count="all"]').textContent = rows.length;
          document.querySelector('[data-count="live"]').textContent = live;
          document.querySelector('[data-count="demo"]').textContent = rows.length - live;
        }
        document.querySelectorAll('[data-filter]').forEach(function(btn){
          btn.addEventListener('click', function(){
            currentFilter = btn.dataset.filter;
            document.querySelectorAll('[data-filter]').forEach(function(b){ b.classList.toggle('active', b === btn); });
            applyFilter();
          });
        });

        function render(sw, published){
          sw.setAttribute('aria-checked', String(published));
          sw.querySelector('.switch-label').textContent = published ? 'פעיל באתר' : 'דמו';
          sw.closest('.profile-row').dataset.state = published ? 'live' : 'demo';
          updateCounts();
        }

        document.querySelectorAll('.visibility-switch').forEach(function(sw){
          sw.addEventListener('click', function(){
            var next = sw.getAttribute('aria-checked') !== 'true';
            render(sw, next);
            sw.setAttribute('aria-busy', 'true');
            fetch('/admin-suppliers/profiles/' + encodeURIComponent(sw.dataset.key) + '/visibility', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ published: next })
            })
              .then(function(r){
                if (r.status === 401) { location.href = '/admin-suppliers/login'; throw new Error('auth'); }
                if (!r.ok) throw new Error('http ' + r.status);
                return r.json();
              })
              .then(function(data){
                render(sw, data.published);
                showToast(data.published ? 'הפרופיל פורסם באתר ✓' : 'הפרופיל הוחזר לדמו');
                applyFilter();
              })
              .catch(function(err){
                if (err.message === 'auth') return;
                render(sw, !next);
                showToast('השינוי לא נשמר — נסו שוב', true);
              })
              .finally(function(){ sw.removeAttribute('aria-busy'); });
          });
        });

        document.querySelectorAll('[data-copy]').forEach(function(btn){
          btn.addEventListener('click', function(){
            var url = location.origin + btn.dataset.copy;
            var done = function(){ showToast('הקישור הועתק'); };
            if (navigator.clipboard && window.isSecureContext) {
              navigator.clipboard.writeText(url).then(done, function(){ window.prompt('העתיקו את הקישור:', url); });
            } else {
              window.prompt('העתיקו את הקישור:', url);
            }
          });
        });
      })();
    </script>
  `;
  return page({ title: 'כל הפרופילים — אזור ניהול', body, wide: true });
}

module.exports = { profilesPage };
