const { page, adminTabs, escapeHtml } = require('./layout');

// Safe to drop inside <script>: no "</script>" or HTML comment can break out.
const scriptJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

function featuredPage({ adminEmail, featured, others }) {
  const pick = (r) => ({
    key: r.key,
    name: r.name,
    meta: [r.categoryLabel, r.city].filter(Boolean).join(' · '),
    published: r.published,
    image: r.image || null,
    emoji: r.emoji || '',
    grad: r.grad || 'g1',
    viewUrl: r.viewUrl,
  });
  const data = { featured: featured.map(pick), others: others.map(pick) };

  const body = `
    ${adminTabs('featured')}
    <div class="admin-card">
      <div class="admin-card-head">
        <h1 style="margin-bottom:0;">⭐ ספקים מומלצים</h1>
        <form method="POST" action="/admin-suppliers/logout" style="max-width:100%;"><button type="submit" class="btn btn-ghost btn-sm admin-logout-btn">התנתקות (${escapeHtml(adminEmail)})</button></form>
      </div>
      <p class="lead">הספקים שתבחרו כאן יקבלו תג <strong>"מומלץ"</strong>, יוצגו בקרוסלה בדף הבית ויופיעו ראשונים ב"כל הספקים" — לפי הסדר שתקבעו. ספק במצב דמו יוצג רק אחרי שתפעילו אותו ב"כל הפרופילים".</p>

      <h2 class="profiles-group-title">ברשימת המומלצים <small>(<span id="featured-count">0</span>)</small></h2>
      <ol class="featured-list" id="featured-list"></ol>
      <div class="empty-profiles" id="featured-empty" hidden>הרשימה ריקה — בדף הבית לא יוצגו ספקים מומלצים. הוסיפו ספקים מהרשימה למטה.</div>

      <h2 class="profiles-group-title">הוספת ספקים לרשימה</h2>
      <input type="search" class="featured-search" id="featured-search" placeholder="חיפוש לפי שם, קטגוריה או עיר…" aria-label="חיפוש ספק">
      <ul class="featured-list" id="others-list"></ul>
      <div class="empty-profiles" id="others-empty" hidden>לא נמצאו ספקים.</div>
    </div>

    <div class="admin-toast" id="admin-toast" role="status" aria-live="polite"></div>

    <script>
      (function(){
        var data = ${scriptJson(data)};
        var saved = data.featured.map(function(r){ return r.key; });
        var order = saved.slice();
        var rows = {};
        data.featured.concat(data.others).forEach(function(r){ rows[r.key] = r; });
        var MAX = 30;

        var toast = document.getElementById('admin-toast');
        var toastTimer;
        function showToast(text, isError){
          toast.textContent = text;
          toast.classList.toggle('error', !!isError);
          toast.classList.add('show');
          clearTimeout(toastTimer);
          toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 2400);
        }

        function el(tag, className, text){
          var node = document.createElement(tag);
          if (className) node.className = className;
          if (text != null) node.textContent = text;
          return node;
        }

        function button(className, label, ariaLabel, onClick, disabled){
          var b = el('button', className, label);
          b.type = 'button';
          b.setAttribute('aria-label', ariaLabel);
          b.disabled = !!disabled;
          b.addEventListener('click', onClick);
          return b;
        }

        function rowNode(r, isFeatured, index){
          var li = el('li', 'featured-row' + (isFeatured ? ' is-featured' : ''));
          if (isFeatured) li.appendChild(el('span', 'featured-rank', String(index + 1)));

          var thumb = el('div', 'profile-thumb');
          if (r.image) thumb.style.backgroundImage = 'url("' + encodeURI(r.image) + '")';
          else { thumb.style.background = 'var(--' + r.grad + ')'; thumb.textContent = r.emoji; }
          li.appendChild(thumb);

          var info = el('div', 'profile-info');
          var name = el('div', 'profile-name');
          var link = el('a', null, r.name);
          link.href = r.viewUrl; link.target = '_blank'; link.rel = 'noopener';
          name.appendChild(link);
          info.appendChild(name);
          info.appendChild(el('div', 'profile-meta', r.meta));
          if (!r.published) info.appendChild(el('div', 'profile-meta demo-note', 'במצב דמו — לא יוצג באתר עד שיופעל'));
          li.appendChild(info);

          var actions = el('div', 'featured-actions');
          if (isFeatured) {
            actions.appendChild(button('icon-btn', '↑', 'להעלות את ' + r.name, function(){ move(index, -1); }, index === 0));
            actions.appendChild(button('icon-btn', '↓', 'להוריד את ' + r.name, function(){ move(index, 1); }, index === order.length - 1));
            actions.appendChild(button('icon-btn danger', '✕', 'להסיר את ' + r.name + ' מהמומלצים', function(){ remove(r.key); }));
          } else {
            actions.appendChild(button('add-btn', '+ הוספה', 'להוסיף את ' + r.name + ' למומלצים', function(){ add(r.key); }, order.length >= MAX));
          }
          li.appendChild(actions);
          return li;
        }

        var search = document.getElementById('featured-search');
        function render(){
          var list = document.getElementById('featured-list');
          list.replaceChildren.apply(list, order.map(function(k, i){ return rowNode(rows[k], true, i); }));
          document.getElementById('featured-count').textContent = order.length;
          document.getElementById('featured-empty').hidden = order.length > 0;

          var q = search.value.trim().toLowerCase();
          var others = Object.keys(rows)
            .filter(function(k){ return order.indexOf(k) === -1; })
            .map(function(k){ return rows[k]; })
            .filter(function(r){ return !q || (r.name + ' ' + r.meta).toLowerCase().indexOf(q) !== -1; })
            .sort(function(a, b){ return (b.published - a.published); });
          var otherList = document.getElementById('others-list');
          otherList.replaceChildren.apply(otherList, others.map(function(r){ return rowNode(r, false, -1); }));
          document.getElementById('others-empty').hidden = others.length > 0;
        }
        search.addEventListener('input', render);

        var saving = Promise.resolve();
        function save(message){
          var snapshot = order.slice();
          saving = saving.then(function(){
            return fetch('/admin-suppliers/featured', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keys: snapshot })
            }).then(function(r){
              if (r.status === 401) { location.href = '/login.html?next=' + encodeURIComponent('/admin-suppliers/featured'); throw new Error('auth'); }
              return r.json().then(function(body){ if (!r.ok) throw new Error(body.error || 'save failed'); return body; });
            }).then(function(body){
              saved = body.keys;
              showToast(message);
            }).catch(function(err){
              if (err.message === 'auth') return;
              order = saved.slice();
              render();
              showToast('השינוי לא נשמר — ' + err.message, true);
            });
          });
        }

        function move(index, delta){
          var target = index + delta;
          if (target < 0 || target >= order.length) return;
          var key = order.splice(index, 1)[0];
          order.splice(target, 0, key);
          render();
          save('הסדר נשמר');
        }
        function remove(key){
          order = order.filter(function(k){ return k !== key; });
          render();
          save('הוסר מהמומלצים');
        }
        function add(key){
          if (order.length >= MAX) return;
          order.push(key);
          render();
          save('נוסף למומלצים ✓');
        }

        render();
      })();
    </script>
  `;
  return page({ title: 'ספקים מומלצים — אזור ניהול', body, wide: true });
}

module.exports = { featuredPage };
