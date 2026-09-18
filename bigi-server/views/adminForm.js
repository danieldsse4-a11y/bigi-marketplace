const { page, adminTabs, escapeHtml } = require('./layout');
const { CATEGORIES, CITIES } = require('../lib/siteData');
const { MIN_PRODUCT_IMAGES, MAX_PRODUCT_IMAGES } = require('../lib/supplierProfile');

function photoRow(n, removable) {
  return `
    <div class="product-photo-row" data-photo-row>
      <div style="flex:1;">
        <label style="font-size:13px; font-weight:700; color:var(--ink-soft); margin-bottom:6px; display:block;">תמונה ${n}</label>
        <input type="file" name="productImages" accept="image/png,image/jpeg,image/webp" required>
        <input type="text" name="productCaptions" required placeholder="תיאור המוצר בתמונה זו" class="photo-caption-input">
      </div>
      ${removable ? `<button type="button" class="remove-row-btn" title="הסרת תמונה" style="flex-shrink:0; width:30px; height:30px; border-radius:50%; background:var(--accent-soft); color:var(--accent); font-size:14px; align-self:flex-start; margin-top:22px;">✕</button>` : ''}
    </div>`;
}

// When the form comes back with an error, the packages and link buttons the
// admin already typed are put back (they arrive as JSON text).
function listFrom(raw) {
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function createFormPage({ adminEmail, error, values = {} } = {}) {
  const v = (k) => escapeHtml(values[k] || '');
  // editNote:false drops the sentence about the supplier's own edit page: a profile created here has no supplier account.
  const initialExtras = { packages: listFrom(values.packages), socialLinks: listFrom(values.socialLinks), editNote: false };
  const option = (value, label, selected) =>
    `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;

  const body = `
    ${adminTabs('create')}
    <div class="admin-card">
      <div class="admin-card-head">
        <h1 style="margin-bottom:0;">➕ פרופיל ספק חדש</h1>
        <form method="POST" action="/admin-suppliers/logout" style="max-width:100%;"><button type="submit" class="btn btn-ghost btn-sm admin-logout-btn">התנתקות (${escapeHtml(adminEmail)})</button></form>
      </div>
      <p class="lead">הפרופיל נוצר כ<strong>דמו</strong> (לא מופיע באתר) ונשלח קישור פרטי אליו לשני המיילים המורשים בלבד. אפשר לפרסם אותו באתר בכל רגע מתוך "כל הפרופילים".</p>

      ${error ? `<div class="admin-alert error">${escapeHtml(error)}</div>` : ''}

      <form method="POST" action="/admin-suppliers/create" enctype="multipart/form-data" id="supplier-form">
        <div class="form-field">
          <label for="name">שם הספק *</label>
          <input id="name" name="name" type="text" required value="${v('name')}" placeholder="לדוגמה: סטודיו לומן">
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="category">קטגוריה *</label>
            <select id="category" name="category" required>
              ${option('', 'בחרו קטגוריה', !values.category)}
              ${CATEGORIES.map((c) => option(c.id, `${c.icon} ${c.name}`, values.category === c.id)).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="city">עיר</label>
            <select id="city" name="city">
              ${option('', 'בחרו עיר (לא חובה)', !values.city)}
              ${CITIES.map((c) => option(c, c, values.city === c)).join('')}
            </select>
          </div>
        </div>

        <div class="form-field">
          <label for="phone">טלפון</label>
          <input id="phone" name="phone" type="tel" autocomplete="off" value="${v('phone')}" placeholder="050-0000000">
        </div>

        <div class="form-field">
          <label for="description">תיאור כללי</label>
          <textarea id="description" name="description" placeholder="כמה מילים על הספק ועל השירות שהוא מציע...">${v('description')}</textarea>
        </div>

        <div class="form-field">
          <label for="contactEmail">מייל ליצירת קשר</label>
          <input id="contactEmail" name="contactEmail" type="email" value="${v('contactEmail')}" placeholder="contact@business.co.il">
        </div>

        <div class="form-field">
          <label for="ownerEmail">אימייל בעל העסק (לא חובה)</label>
          <input id="ownerEmail" name="ownerEmail" type="email" dir="ltr" autocomplete="off" value="${v('ownerEmail')}" placeholder="owner@business.co.il">
          <div class="field-hint">השאירו ריק לפרופיל דמו. אם בעל העסק כבר רשום באתר, הזינו את האימייל שלו — והוא יוכל לערוך את הפרופיל בעצמו. אפשר גם לשייך אחר כך מתוך "כל הפרופילים".</div>
        </div>

        <div class="form-field" id="extras-editor" data-initial="${escapeHtml(JSON.stringify(initialExtras))}"></div>
        <input type="hidden" name="packages" id="packages-json">
        <input type="hidden" name="socialLinks" id="social-links-json">

        <div class="form-field">
          <label for="logo-input">לוגו העסק (לא חובה)</label>
          <input type="file" id="logo-input" name="logo" accept="image/png,image/jpeg,image/webp">
          <div class="field-hint">JPG / PNG / WebP, עד 2MB. יופיע ליד שם העסק בראש הפרופיל.</div>
        </div>

        <div class="form-field">
          <label>תמונות מוצר * (לפחות ${MIN_PRODUCT_IMAGES})</label>
          <div class="field-hint" style="margin-bottom:12px;">JPG / PNG / WebP, עד 5MB לתמונה. לכל תמונה יש שדה תיאור משלה מיד מתחתיה.</div>
          <div id="product-photo-rows">
            ${Array.from({ length: MIN_PRODUCT_IMAGES }, (_, i) => photoRow(i + 1, false)).join('')}
          </div>
          <button type="button" id="add-photo-row-btn" class="btn btn-secondary btn-sm" style="margin-top:4px;">+ הוספת תמונה נוספת</button>
        </div>

        <div class="form-field">
          <label>סרטון (לא חובה)</label>
          <div class="field-hint" style="margin-bottom:12px;">אפשר להעלות MP4, WebM או MOV עד 45MB, או להדביק קישור מיוטיוב, אינסטגרם, טיקטוק או Vimeo.</div>
          <input type="file" id="video-input" name="video" accept="video/mp4,video/webm,video/quicktime">
          <input id="video-link" name="videoLink" type="url" inputmode="url" value="${v('videoLink')}" placeholder="או הדביקו כאן קישור לסרטון" style="margin-top:10px;">
        </div>

        <div class="form-field">
          <label for="background-image-input">תמונת רקע לפרופיל *</label>
          <input type="file" id="background-image-input" name="backgroundImage" accept="image/png,image/jpeg,image/webp" required>
          <div class="bg-preview-note">
            📐 מידות מומלצות: <strong>1920×1080 פיקסלים</strong> (יחס רוחב-גובה 16:9). התמונה תוצג כרקע לעמוד הפרופיל עם טשטוש קל ושכבת כהות עדינה, כדי שהטקסט מעליה יישאר קריא. לתמונה זו אין צורך בתיאור.
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-block" id="submit-btn">יצירת פרופיל ושליחת קישור</button>
      </form>
    </div>

    <script src="/extras-editor.js"></script>
    <script>
      (function(){
        var MAX_PRODUCT_IMAGES = ${MAX_PRODUCT_IMAGES};
        var rowsContainer = document.getElementById('product-photo-rows');
        var addBtn = document.getElementById('add-photo-row-btn');

        function renumber(){
          var rows = rowsContainer.querySelectorAll('[data-photo-row]');
          rows.forEach(function(row, i){
            row.querySelector('label').textContent = 'תמונה ' + (i + 1);
          });
          addBtn.hidden = rows.length >= MAX_PRODUCT_IMAGES;
        }

        // The browser's own file control is English and left-to-right; the real
        // input stays in the page (still focusable when the form is invalid)
        // but sits transparent on top of a Hebrew label.
        function enhanceFileInput(input, buttonText, emptyText){
          if(!input || input.dataset.enhanced) return;
          input.dataset.enhanced = '1';
          var drop = document.createElement('label');
          drop.className = 'file-drop';
          input.parentNode.insertBefore(drop, input);
          drop.appendChild(input);
          var button = document.createElement('span');
          button.className = 'file-drop-btn';
          button.textContent = buttonText || 'בחרו תמונה';
          var fileName = document.createElement('span');
          fileName.className = 'file-drop-name';
          var empty = emptyText || 'לא נבחרה תמונה';
          fileName.textContent = empty;
          drop.appendChild(button);
          drop.appendChild(fileName);
          input.addEventListener('change', function(){
            var picked = input.files && input.files[0];
            fileName.textContent = picked ? picked.name : empty;
            drop.classList.toggle('has-file', Boolean(picked));
          });
        }
        function enhanceAll(){
          document.querySelectorAll('input[type=file]:not(#video-input):not(#logo-input)').forEach(function(input){ enhanceFileInput(input); });
          enhanceFileInput(document.getElementById('video-input'), 'בחרו סרטון', 'לא נבחר סרטון');
          enhanceFileInput(document.getElementById('logo-input'), 'בחרו לוגו', 'לא נבחר לוגו');
        }
        enhanceAll();

        // Packages and link buttons: rows carry no names, so they are sent as two JSON fields.
        var extrasRoot = document.getElementById('extras-editor');
        var extras = window.mountExtrasEditor(extrasRoot, JSON.parse(extrasRoot.getAttribute('data-initial') || '{}'));

        var videoInput = document.getElementById('video-input');
        var videoLink = document.getElementById('video-link');
        function syncVideoChoice(){
          var hasFile = Boolean(videoInput.files && videoInput.files.length);
          var hasLink = Boolean(videoLink.value.trim());
          videoLink.disabled = hasFile;
          videoInput.disabled = hasLink;
          if(hasFile) videoLink.value = '';
        }
        videoInput.addEventListener('change', syncVideoChoice);
        videoLink.addEventListener('input', syncVideoChoice);
        syncVideoChoice();

        addBtn.addEventListener('click', function(){
          var rows = rowsContainer.querySelectorAll('[data-photo-row]');
          if(rows.length >= MAX_PRODUCT_IMAGES) return;
          var div = document.createElement('div');
          div.className = 'product-photo-row';
          div.setAttribute('data-photo-row', '');
          div.innerHTML =
            '<div style="flex:1;">' +
              '<label style="font-size:13px; font-weight:700; color:var(--ink-soft); margin-bottom:6px; display:block;">תמונה</label>' +
              '<input type="file" name="productImages" accept="image/png,image/jpeg,image/webp" required>' +
              '<input type="text" name="productCaptions" required placeholder="תיאור המוצר בתמונה זו" class="photo-caption-input">' +
            '</div>' +
            '<button type="button" class="remove-row-btn" title="הסרת תמונה" style="flex-shrink:0; width:30px; height:30px; border-radius:50%; background:var(--accent-soft); color:var(--accent); font-size:14px; align-self:flex-start; margin-top:22px;">✕</button>';
          rowsContainer.appendChild(div);
          enhanceFileInput(div.querySelector('input[type=file]'));
          renumber();
        });

        rowsContainer.addEventListener('click', function(e){
          var removeBtn = e.target.closest('.remove-row-btn');
          if(!removeBtn) return;
          removeBtn.closest('[data-photo-row]').remove();
          renumber();
        });

        var form = document.getElementById('supplier-form');
        var btn = document.getElementById('submit-btn');
        form.addEventListener('submit', function(){
          var collected = extras.collect();
          document.getElementById('packages-json').value = JSON.stringify(collected.packages);
          document.getElementById('social-links-json').value = JSON.stringify(collected.socialLinks);
          btn.textContent = 'שולח ומעלה מדיה...';
          btn.style.pointerEvents = 'none';
        });
      })();
    </script>
  `;
  return page({ title: 'יצירת פרופיל ספק — אזור ניהול', body });
}

function successPage({ name, link }) {
  const body = `
    <div class="admin-card" style="text-align:center;">
      <div style="font-size:52px; margin-bottom:12px;">✅</div>
      <h1>הפרופיל של "${escapeHtml(name)}" נוצר בהצלחה</h1>
      <p class="lead">הפרופיל נשמר כ<strong>דמו</strong> ולא מופיע באתר הציבורי. קישור פרטי נשלח למיילים המורשים.</p>
      <div class="link-box">
        <span>🔗</span>
        <a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a>
      </div>
      <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap; margin-top:28px;">
        <a href="/admin-suppliers/profiles" class="btn btn-primary">לכל הפרופילים (פרסום באתר)</a>
        <a href="/admin-suppliers" class="btn btn-secondary">יצירת פרופיל נוסף</a>
      </div>
    </div>
  `;
  return page({ title: 'הפרופיל נוצר — אזור ניהול', body });
}

module.exports = { createFormPage, successPage };
