const { page, escapeHtml } = require('./layout');

function loginPage({ error, sentTo } = {}) {
  const body = `
    <div class="admin-card">
      <h1>🔐 אזור ניהול ספקים</h1>
      <p class="lead">כניסה מוגבלת למייל מורשה בלבד. נשלח אליכם קישור חד־פעמי להתחברות.</p>

      ${error ? `<div class="admin-alert error">${escapeHtml(error)}</div>` : ''}
      ${sentTo ? `<div class="admin-alert success">קישור התחברות נשלח אל ${escapeHtml(sentTo)}. בדקו את תיבת המייל (ותיקיית ספאם) — הקישור בתוקף ל־15 דקות.</div>` : ''}

      <form method="POST" action="/admin-suppliers/login">
        <div class="form-field">
          <label for="email">כתובת מייל</label>
          <input id="email" name="email" type="email" required autofocus autocomplete="off" placeholder="you@example.com">
        </div>
        <button type="submit" class="btn btn-primary btn-block">שליחת קישור התחברות</button>
      </form>
    </div>
  `;
  return page({ title: 'כניסת מנהלים — ביגי ספקים', body });
}

module.exports = { loginPage };
