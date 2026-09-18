/* ==========================================================================
   Packages and link buttons — the optional, repeatable parts of a supplier
   profile. One script shared by the sign-up form, the edit page and the admin
   create form, so all three behave the same. No dependencies.
   ========================================================================== */
(function(){
  'use strict';
  function q(selector, root){ return (root || document).querySelector(selector); }
  function qa(selector, root){ return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  /* The optional, repeatable parts of a profile (packages and, below, the link
     buttons). Shared by the sign-up form, the edit page and the admin form so
     they behave the same. Rows carry no `name`, so nothing is submitted by accident: collect()
     returns plain data and the caller sends it as one JSON field. */
  const MAX_PACKAGES = 6;
  const MAX_SOCIAL_LINKS = 6;

  function mountExtrasEditor(root, initial){
    if(!root) return { collect: () => ({ packages: [], socialLinks: [] }) };
    initial = initial || {};

    root.innerHTML = `
      <div class="extras-block">
        <label class="extras-title">חבילות (לא חובה)</label>
        <div class="field-hint">אפשר להוסיף עד ${MAX_PACKAGES} חבילות. המחיר לא חובה — בלי מחיר יופיע ללקוחות "מחיר בהתאם להצעה"${initial.editNote === false ? '.' : ', ואפשר לעדכן אותו בכל רגע דרך עריכת הפרופיל.'}</div>
        <div class="extras-rows" data-rows="packages"></div>
        <button type="button" class="btn btn-secondary btn-sm" data-add="packages">+ הוספת חבילה</button>
      </div>
      <div class="extras-block">
        <label class="extras-title">קישורים ורשתות חברתיות (לא חובה)</label>
        <div class="field-hint">כל קישור יופיע בפרופיל ככפתור עם השם שתבחרו, למשל "אינסטגרם" או "האתר שלנו". אפשר להוסיף עד ${MAX_SOCIAL_LINKS}.</div>
        <div class="extras-rows" data-rows="links"></div>
        <button type="button" class="btn btn-secondary btn-sm" data-add="links">+ הוספת קישור</button>
      </div>`;

    const pkgRows = q('[data-rows="packages"]', root);
    const pkgAdd = q('[data-add="packages"]', root);
    const linkRows = q('[data-rows="links"]', root);
    const linkAdd = q('[data-add="links"]', root);

    function renumber(){
      qa('.pkg-row', pkgRows).forEach((row, i) => { q('.extras-row-title', row).textContent = `חבילה ${i + 1}`; });
      pkgAdd.hidden = qa('.pkg-row', pkgRows).length >= MAX_PACKAGES;
    }

    function addPackage(pkg){
      pkg = pkg || {};
      const row = document.createElement('div');
      row.className = 'extras-row pkg-row';
      row.innerHTML = `
        <div class="extras-row-head">
          <strong class="extras-row-title"></strong>
          <button type="button" class="extras-remove" aria-label="הסרת החבילה">✕</button>
        </div>
        <input type="text" class="pkg-name" maxlength="60" placeholder="שם החבילה, למשל: חבילת בסיס">
        <input type="number" class="pkg-price" min="1" max="1000000" step="1" inputmode="numeric" placeholder="מחיר ב־₪ (לא חובה)">
        <textarea class="pkg-items" rows="3" placeholder="מה כלול בחבילה? כל שורה היא פריט אחד"></textarea>`;
      q('.pkg-name', row).value = pkg.name || '';
      q('.pkg-price', row).value = pkg.price || '';
      q('.pkg-items', row).value = (pkg.items || []).join('\n');
      pkgRows.appendChild(row);
      renumber();
    }

    pkgAdd.addEventListener('click', () => { if(qa('.pkg-row', pkgRows).length < MAX_PACKAGES) addPackage(); });
    pkgRows.addEventListener('click', (e) => {
      const remove = e.target.closest('.extras-remove');
      if(remove){ remove.closest('.pkg-row').remove(); renumber(); }
    });
    function renumberLinks(){
      qa('.link-row', linkRows).forEach((row, i) => { q('.extras-row-title', row).textContent = `קישור ${i + 1}`; });
      linkAdd.hidden = qa('.link-row', linkRows).length >= MAX_SOCIAL_LINKS;
    }

    function addLink(link){
      link = link || {};
      const row = document.createElement('div');
      row.className = 'extras-row link-row';
      row.innerHTML = `
        <div class="extras-row-head">
          <strong class="extras-row-title"></strong>
          <button type="button" class="extras-remove" aria-label="הסרת הקישור">✕</button>
        </div>
        <input type="text" class="link-label" maxlength="30" placeholder="שם הכפתור, למשל: אינסטגרם">
        <input type="text" class="link-url" maxlength="300" inputmode="url" dir="ltr" placeholder="https://instagram.com/העסק-שלכם">`;
      q('.link-label', row).value = link.label || '';
      q('.link-url', row).value = link.url || '';
      linkRows.appendChild(row);
      renumberLinks();
    }

    linkAdd.addEventListener('click', () => { if(qa('.link-row', linkRows).length < MAX_SOCIAL_LINKS) addLink(); });
    linkRows.addEventListener('click', (e) => {
      const remove = e.target.closest('.extras-remove');
      if(remove){ remove.closest('.link-row').remove(); renumberLinks(); }
    });

    (initial.packages || []).forEach(addPackage);
    (initial.socialLinks || []).forEach(l => addLink({ label: l.label, url: l.url || '' }));
    renumber();
    renumberLinks();

    return {
      collect(){
        const packages = qa('.pkg-row', pkgRows).map(row => ({
          name: q('.pkg-name', row).value.trim(),
          price: q('.pkg-price', row).value.trim(),
          items: q('.pkg-items', row).value.split('\n').map(s => s.trim()).filter(Boolean),
        })).filter(p => p.name || p.price !== '' || p.items.length);
        const socialLinks = qa('.link-row', linkRows).map(row => ({
          label: q('.link-label', row).value.trim(),
          url: q('.link-url', row).value.trim(),
        })).filter(l => l.label || l.url);
        return { packages, socialLinks };
      }
    };
  }

  window.mountExtrasEditor = mountExtrasEditor;
})();
