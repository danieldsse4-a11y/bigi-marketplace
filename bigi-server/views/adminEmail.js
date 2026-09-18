const { page, adminTabs, escapeHtml } = require('./layout');

// Explains, in plain Hebrew, whether the site can actually send email — the
// usual cause of "the site says it sent a link but nothing arrived".
function verdict(status) {
  if (!status.keySet) {
    return {
      level: 'error',
      title: 'לא מוגדר מפתח לשליחת מיילים',
      text: 'המשתנה RESEND_API_KEY לא קיים בהגדרות השרת, ולכן שום מייל לא נשלח. הוסיפו אותו ב-Render (Environment) ואז Deploy.',
    };
  }
  if (status.error) {
    return {
      level: 'error',
      title: 'Resend מחזיר שגיאה',
      text: `${status.error} — בדרך כלל זה מפתח לא תקין או שפג תוקפו.`,
    };
  }
  if (status.isTestSender) {
    return {
      level: 'warn',
      title: 'כתובת השולח היא כתובת הבדיקה של Resend',
      text: 'עם onboarding@resend.dev, Resend שולח מיילים אך ורק לכתובת שאיתה נפתח חשבון Resend. לכל כתובת אחרת הוא פשוט דוחה את השליחה — ולכן "לא מגיע מייל". כדי לשלוח לכל אחד צריך לאמת דומיין ב-Resend ואז להגדיר את EMAIL_FROM לכתובת בדומיין הזה.',
    };
  }
  // gmail/outlook and friends can never be verified — nobody owns them.
  const FREE_MAIL = ['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'walla.com', 'walla.co.il'];
  if (FREE_MAIL.includes(status.fromDomain)) {
    return {
      level: 'error',
      title: `אי אפשר לשלוח מכתובת ${status.fromDomain}`,
      text: `Resend מאשר שליחה רק מדומיין שאתם הבעלים שלו ואימתתם בחשבון, ו-${status.fromDomain} לא יכול להיות מאומת. כל המיילים מהאתר נדחים כרגע. שנו את EMAIL_FROM ב-Render ל: ביגי ספקים <onboarding@resend.dev> — שם השולח נשאר שלכם. לשליחה לכל לקוח צריך דומיין משלכם, מאומת ב-Resend.`,
    };
  }
  const domain = (status.domains || []).find((d) => d.name.toLowerCase() === status.fromDomain);
  if (!domain) {
    return {
      level: 'error',
      title: `הדומיין ${status.fromDomain} לא קיים בחשבון Resend`,
      text: 'Resend מאשר שליחה רק מדומיין שאומת בחשבון. כל עוד EMAIL_FROM מצביע על דומיין אחר — כל המיילים נדחים. אמתו את הדומיין ב-Resend, או החזירו את EMAIL_FROM ל-onboarding@resend.dev.',
    };
  }
  if (domain.status !== 'verified') {
    return {
      level: 'error',
      title: `הדומיין ${domain.name} עדיין לא מאומת (${domain.status})`,
      text: 'השלימו את רשומות ה-DNS ב-Resend עד שהסטטוס יהיה verified.',
    };
  }
  return {
    level: 'ok',
    title: 'הכל מוגדר כמו שצריך',
    text: `המיילים נשלחים מהכתובת ${status.fromAddress}, והדומיין שלה מאומת ב-Resend.`,
  };
}

function emailPage({ adminEmail, status }) {
  const v = verdict(status);
  const domainsList = status.domains && status.domains.length
    ? `<ul class="email-domains">${status.domains.map((d) => `<li><strong dir="ltr" class="ltr-value">${escapeHtml(d.name)}</strong> — ${escapeHtml(d.status)}</li>`).join('')}</ul>`
    : '<p class="email-none">אין דומיינים מאומתים בחשבון Resend.</p>';

  const body = `
    ${adminTabs('email')}
    <div class="admin-card">
      <div class="admin-card-head">
        <h1 style="margin-bottom:0;">✉️ שליחת מיילים</h1>
        <form method="POST" action="/admin-suppliers/logout" style="max-width:100%;"><button type="submit" class="btn btn-ghost btn-sm admin-logout-btn">התנתקות (${escapeHtml(adminEmail)})</button></form>
      </div>
      <p class="lead">כאן רואים למה מייל לא הגיע — איפוס סיסמה, אישור הרשאות מנהל או הודעה על ספק חדש.</p>

      <div class="email-verdict ${v.level}">
        <strong>${escapeHtml(v.title)}</strong>
        <p>${escapeHtml(v.text)}</p>
      </div>

      <h2 class="profiles-group-title">ההגדרות הנוכחיות</h2>
      <dl class="email-facts">
        <div><dt>מפתח Resend</dt><dd>${status.keySet ? 'מוגדר' : 'חסר'}</dd></div>
        <div><dt>נשלח מהכתובת</dt><dd dir="ltr" class="ltr-value">${escapeHtml(status.from)}</dd></div>
      </dl>

      <h2 class="profiles-group-title">דומיינים בחשבון Resend</h2>
      ${status.error ? `<p class="email-none">${escapeHtml(status.error)}</p>` : domainsList}

      <h2 class="profiles-group-title">בדיקה</h2>
      <p class="lead">שליחת מייל בדיקה לכתובת שלכם (${escapeHtml(adminEmail)}). אם משהו לא תקין, השגיאה המדויקת של Resend תופיע כאן.</p>
      <button type="button" class="btn btn-primary btn-sm" id="send-test">שליחת מייל בדיקה אליי</button>
      <div class="email-result" id="email-result" hidden></div>
    </div>

    <script>
      (function(){
        var btn = document.getElementById('send-test');
        var out = document.getElementById('email-result');
        btn.addEventListener('click', function(){
          btn.disabled = true;
          out.hidden = false;
          out.className = 'email-result';
          out.textContent = 'שולח…';
          fetch('/admin-suppliers/email/test', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}'
          })
            .then(function(r){ return r.json().then(function(d){ return { ok: r.ok, data: d }; }); })
            .then(function(res){
              out.className = 'email-result ' + (res.ok ? 'ok' : 'error');
              out.textContent = res.ok
                ? 'נשלח. בדקו את תיבת הדואר של ' + res.data.to + ' (גם בספאם).'
                : 'Resend סירב: ' + (res.data.error || 'שגיאה לא ידועה');
            })
            .catch(function(){
              out.className = 'email-result error';
              out.textContent = 'הבקשה נכשלה. נסו שוב.';
            })
            .finally(function(){ btn.disabled = false; });
        });
      })();
    </script>
  `;
  return page({ title: 'שליחת מיילים — אזור ניהול', body, wide: true });
}

module.exports = { emailPage };
