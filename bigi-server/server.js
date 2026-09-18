const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const db = require('./lib/db');
const storage = require('./lib/storage');
const { sendEmail, emailStatus } = require('./lib/email');
const auth = require('./lib/auth');
const catalog = require('./lib/catalog');
const supplierForm = require('./lib/supplierProfile');
const assistant = require('./lib/assistant');
const { categoryById } = require('./lib/siteData');
const { messagePage, escapeHtml } = require('./views/layout');
const { createFormPage, successPage } = require('./views/adminForm');
const { profilesPage } = require('./views/adminProfiles');
const { accountsPage } = require('./views/adminAccounts');
const { emailPage } = require('./views/adminEmail');
const { featuredPage } = require('./views/adminFeatured');
const { supplierViewPage } = require('./views/supplierView');
const { reviewsPage } = require('./views/adminReviews');
const reviews = require('./lib/reviews');

const PORT = process.env.PORT || 3000;
// RENDER_EXTERNAL_URL is set automatically by Render — this means a fresh
// deploy works with zero manual config; BASE_URL only needs to be set by
// hand for other hosts or to override it.
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE_COOKIES = BASE_URL.startsWith('https');
const ADMIN_EMAILS = auth.getWhitelist();
const BIGI_DIR = path.join(__dirname, '..', 'bigi');

if (ADMIN_EMAILS.length === 0) {
  console.warn('⚠️  ADMIN_EMAILS is empty — nobody can become an admin.');
}
if (!storage.USE_SUPABASE && process.env.RENDER) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_SECRET_KEY are not set — accounts, profiles and photos are stored on Render\'s temporary disk and will be LOST on the next restart.');
}

const app = express();
app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use('/api', express.json({ limit: '10kb' }));

// Minimal, dependency-free security headers.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

const isJsonRequest = (req) => req.path.startsWith('/api/') || req.is('application/json');

// Anything touching accounts or profiles needs the stored data; if storage is
// unreachable, say so instead of acting on an empty database.
async function requireDb(req, res, next) {
  try {
    await db.init();
    next();
  } catch (err) {
    console.error('Storage unavailable:', err.message);
    if (isJsonRequest(req)) return res.status(503).json({ error: 'השירות לא זמין כרגע. נסו שוב בעוד דקה.' });
    res.status(503).send(messagePage({
      title: 'השירות לא זמין', heading: 'השירות לא זמין כרגע', text: 'נסו שוב בעוד דקה.', isError: true,
    }));
  }
}

// Rejects state-changing requests that don't come from this site's own pages.
function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  try {
    if (origin && new URL(origin).host === req.get('host')) return next();
  } catch {}
  res.status(403).json({ error: 'בקשה לא מורשית' });
}

/* ==========================================================================
   Rate limiting
   ========================================================================== */
const limiter = (windowMinutes, limit, message, extra = {}) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: message },
  ...extra,
});

const loginLimiter = limiter(15, 10, 'יותר מדי ניסיונות התחברות. נסו שוב בעוד כמה דקות.', { skipSuccessfulRequests: true });
const signupLimiter = limiter(60, 10, 'יותר מדי הרשמות מהמכשיר הזה. נסו שוב מאוחר יותר.');
const adminVerifyLimiter = limiter(60, 5, 'יותר מדי בקשות לקישור אישור. נסו שוב מאוחר יותר.');
const supplierSubmitLimiter = limiter(60, 10, 'יותר מדי ניסיונות שליחה. נסו שוב מאוחר יותר.');
const supplierEditLimiter = limiter(60, 40, 'יותר מדי שמירות. נסו שוב מאוחר יותר.');
const reviewLimiter = limiter(60, 30, 'יותר מדי ביקורות. נסו שוב מאוחר יותר.');
const createLimiter = limiter(60, 20, 'יותר מדי בקשות ליצירת פרופיל. נסו שוב מאוחר יותר.');
const visibilityLimiter = limiter(15, 150, 'יותר מדי שינויים. נסו שוב בעוד כמה דקות.');
const deleteLimiter = limiter(15, 30, 'יותר מדי מחיקות. נסו שוב בעוד כמה דקות.');
const emailTestLimiter = limiter(15, 10, 'יותר מדי מיילי בדיקה. נסו שוב בעוד כמה דקות.');
const resetRequestLimiter = limiter(60, 5, 'יותר מדי בקשות איפוס. נסו שוב מאוחר יותר.');
const resetConfirmLimiter = limiter(15, 10, 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.');
// Each assistant message costs money, so cap it per visitor.
const assistantLimiter = limiter(60, 40, 'הגעתם למגבלת ההודעות לשעה. נסו שוב מאוחר יותר.');

/* ==========================================================================
   Accounts
   ========================================================================== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function sendAdminConfirmation(user) {
  const token = await auth.createAdminVerifyToken(user.id);
  const link = `${BASE_URL}/admin-verify?token=${token}`;
  // Also written to the server log: until the site's email sending is set up,
  // that's where the owner picks the link up (it only works for this account).
  console.log(`🔐 ADMIN CONFIRMATION LINK for ${user.email} (valid 60 minutes): ${link}`);
  try {
    await sendEmail({
      to: user.email,
      subject: 'אישור הרשאת מנהל — ביגי ספקים',
      html: `<div dir="rtl" style="font-family:sans-serif;">
        <p>שלום ${user.name},</p>
        <p>כדי להפעיל את הרשאות הניהול בחשבון שלכם בביגי ספקים, לחצו על הקישור (בתוקף ל־60 דקות):</p>
        <p><a href="${link}">${link}</a></p>
        <p style="color:#888;font-size:12px;">אם לא נרשמתם לביגי ספקים, אפשר להתעלם מהמייל.</p>
      </div>`,
    });
  } catch (err) {
    console.error('Failed to send admin confirmation email:', err.message);
  }
}

app.post('/api/auth/signup', requireSameOrigin, signupLimiter, requireDb, async (req, res) => {
  const name = String(req.body?.name || '').replace(/[<>]|\p{Cc}/gu, '').trim();
  const email = auth.normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const role = String(req.body?.role || '');

  if (name.length < 2 || name.length > 40) return res.status(400).json({ error: 'נא להזין שם (2–40 תווים).' });
  if (!EMAIL_RE.test(email) || email.length > 120) return res.status(400).json({ error: 'כתובת האימייל לא תקינה.' });
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'הסיסמה צריכה להכיל לפחות 8 תווים.' });
  if (!auth.ROLES.includes(role)) return res.status(400).json({ error: 'נא לבחור סוג חשבון.' });

  const user = await auth.createUser({ name, email, password, role });
  if (!user) return res.status(409).json({ error: 'כבר קיים חשבון עם האימייל הזה. נסו להתחבר.' });

  auth.setSessionCookie(res, await auth.createSession(user.id), SECURE_COOKIES);
  if (auth.isWhitelisted(user.email)) await sendAdminConfirmation(user);
  res.status(201).json({ user: auth.publicUser(user) });
});

app.post('/api/auth/login', requireSameOrigin, loginLimiter, requireDb, async (req, res) => {
  const user = await auth.authenticate(auth.normalizeEmail(req.body?.email), String(req.body?.password || ''));
  if (!user) return res.status(401).json({ error: 'אימייל או סיסמה שגויים.' });
  auth.setSessionCookie(res, await auth.createSession(user.id), SECURE_COOKIES);
  res.json({ user: auth.publicUser(user) });
});

app.post('/api/auth/logout', requireSameOrigin, async (req, res) => {
  const sessionId = req.cookies?.[auth.SESSION_COOKIE];
  if (sessionId) await auth.destroySession(sessionId).catch(() => {});
  res.clearCookie(auth.SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  await db.init().catch(() => {});
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: auth.publicUser(auth.currentUser(req)), assistantEnabled: assistant.ENABLED });
});

/* ==========================================================================
   Event-planning assistant (signed-in visitors only — each message costs money)
   ========================================================================== */
app.post('/api/assistant/message', requireSameOrigin, requireDb, auth.requireUser, assistantLimiter, async (req, res) => {
  if (!assistant.ENABLED) return res.status(503).json({ error: 'העוזר החכם לא זמין כרגע.' });

  const { history, error } = assistant.validateHistory(req.body?.messages);
  if (error) return res.status(400).json({ error });

  try {
    res.json(await assistant.reply(history));
  } catch (err) {
    console.error('Assistant failed:', err.message);
    res.status(502).json({ error: 'העוזר לא זמין כרגע. נסו שוב בעוד רגע.' });
  }
});

app.post('/api/auth/admin-confirmation', requireSameOrigin, requireDb, auth.requireUser, adminVerifyLimiter, async (req, res) => {
  if (!auth.isWhitelisted(req.user.email) || req.user.adminVerifiedAt) {
    return res.status(400).json({ error: 'אין צורך באישור לחשבון הזה.' });
  }
  await sendAdminConfirmation(req.user);
  res.json({ ok: true });
});

/* ---------- Forgot password ---------- */
const RESET_SENT_MESSAGE = 'אם קיים חשבון עם האימייל הזה, שלחנו אליו קישור לבחירת סיסמה חדשה. הקישור בתוקף לשעה.';

app.post('/api/auth/password-reset/request', requireSameOrigin, resetRequestLimiter, requireDb, async (req, res) => {
  const email = auth.normalizeEmail(req.body?.email);
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'כתובת האימייל לא תקינה.' });

  // Same answer, sent before any work is done, whether or not the account
  // exists — so neither the reply nor its timing reveals who is registered.
  res.json({ message: RESET_SENT_MESSAGE });

  const user = auth.findUser(email);
  if (user) sendPasswordReset(user).catch((err) => console.error('Password reset failed:', err.message));
});

async function sendPasswordReset(user) {
  const token = await auth.createPasswordResetToken(user.id);
  const link = `${BASE_URL}/reset-password.html?token=${token}`;
  // Backup until the site's email sending reaches every inbox: the owner can
  // pick the link up from the server log and pass it on.
  console.log(`🔑 PASSWORD RESET LINK for ${user.email} (valid 60 minutes): ${link}`);
  try {
    await sendEmail({
      to: user.email,
      subject: 'איפוס סיסמה — ביגי ספקים',
      html: `<div dir="rtl" style="font-family:sans-serif;">
        <p>שלום ${user.name},</p>
        <p>קיבלנו בקשה לאיפוס הסיסמה של החשבון שלכם בביגי ספקים. לבחירת סיסמה חדשה (הקישור בתוקף לשעה):</p>
        <p><a href="${link}">${link}</a></p>
        <p style="color:#888;font-size:12px;">אם לא ביקשתם איפוס, אפשר להתעלם מהמייל — הסיסמה שלכם לא תשתנה.</p>
      </div>`,
    });
  } catch (err) {
    console.error('Failed to send password reset email:', err.message);
  }
}

app.get('/api/auth/password-reset/check', requireDb, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ valid: auth.isPasswordResetTokenValid(String(req.query.token || '')) });
});

app.post('/api/auth/password-reset/confirm', requireSameOrigin, resetConfirmLimiter, requireDb, async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8 || password.length > 200) return res.status(400).json({ error: 'הסיסמה צריכה להכיל לפחות 8 תווים.' });

  const user = await auth.resetPassword(String(req.body?.token || ''), password);
  if (!user) return res.status(400).json({ error: 'הקישור כבר שומש או שפג תוקפו. בקשו קישור חדש.' });

  auth.setSessionCookie(res, await auth.createSession(user.id), SECURE_COOKIES);
  res.json({ user: auth.publicUser(user) });
});

app.get('/admin-verify', requireDb, async (req, res) => {
  const user = await auth.consumeAdminVerifyToken(String(req.query.token || ''));
  if (!user) {
    return res.status(400).send(messagePage({
      title: 'הקישור לא תקף',
      heading: 'הקישור לא תקף',
      text: 'הקישור כבר שומש או שפג תוקפו. התחברו לאתר ובקשו קישור חדש מתפריט השם שלכם.',
      linkHref: '/login.html', linkLabel: 'להתחברות', isError: true,
    }));
  }
  res.send(messagePage({
    title: 'הרשאות מנהל הופעלו',
    heading: 'הרשאות הניהול הופעלו',
    text: `החשבון ${user.email} הוא עכשיו חשבון מנהל. התחברו מהמכשיר שלכם כדי להיכנס לאזור הניהול.`,
    linkHref: '/admin-suppliers', linkLabel: 'לאזור הניהול',
  }));
});

/* ==========================================================================
   Supplier sign-up: a supplier account submits its own profile (demo until
   an admin switches it live)
   ========================================================================== */
async function notifyAdminsOfNewProfile(supplier, intro) {
  const link = `${BASE_URL}/supplier/view/${supplier.id}`;
  try {
    await sendEmail({
      to: ADMIN_EMAILS,
      subject: `פרופיל ספק חדש: ${supplier.name}`,
      html: `<div dir="rtl" style="font-family:sans-serif;">
        <p>${escapeHtml(intro)}</p>
        <p><strong>${escapeHtml(supplier.name)}</strong> (${escapeHtml(categoryById(supplier.category).name)})</p>
        <p>קישור לצפייה בפרופיל:</p>
        <p><a href="${link}">${link}</a></p>
        <p style="color:#888;font-size:12px;">הפרופיל שמור כדמו. לפרסום באתר: אזור הניהול ← כל הפרופילים.</p>
      </div>`,
    });
  } catch (err) {
    console.error('Failed to send new-profile notification email:', err.message);
  }
}

app.get('/api/supplier/profile', requireDb, auth.requireUser, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ profile: catalog.ownProfile(db.load(), req.user.id) });
});

app.post(
  '/api/supplier/profile',
  requireSameOrigin,
  requireDb,
  auth.requireUser,
  supplierSubmitLimiter,
  (req, res, next) => {
    if (req.user.role !== 'supplier') return res.status(403).json({ error: 'רק חשבון ספק יכול לשלוח פרופיל.' });
    if (catalog.ownProfile(db.load(), req.user.id)) return res.status(409).json({ error: 'כבר שלחתם פרופיל.' });
    next();
  },
  supplierForm.parseForm((req, res, message) => res.status(400).json({ error: message })),
  async (req, res) => {
    const form = supplierForm.readForm(req);
    const error = supplierForm.validateForm(form);
    if (error) return res.status(400).json({ error });

    const supplier = await supplierForm.buildSupplier(form, {
      createdBy: req.user.email,
      source: 'supplier',
      ownerUserId: req.user.id,
    });
    const saved = await db.withDb((data) => {
      if (Object.values(data.suppliers).some((s) => s.ownerUserId === req.user.id)) return false;
      data.suppliers[supplier.id] = supplier;
      return true;
    });
    if (!saved) return res.status(409).json({ error: 'כבר שלחתם פרופיל.' });

    await notifyAdminsOfNewProfile(supplier, `ספק חדש נרשם ושלח פרופיל (${req.user.name}, ${req.user.email}):`);
    res.status(201).json({ profile: catalog.ownProfile(db.load(), req.user.id) });
  }
);

// A supplier edits their own profile only. Edits apply at once and never touch
// whether the profile is live: a published profile stays published.
app.put(
  '/api/supplier/profile',
  requireSameOrigin,
  requireDb,
  auth.requireUser,
  supplierEditLimiter,
  (req, res, next) => {
    if (req.user.role !== 'supplier') return res.status(403).json({ error: 'רק חשבון ספק יכול לערוך פרופיל.' });
    if (!catalog.ownProfile(db.load(), req.user.id)) return res.status(404).json({ error: 'עוד לא שלחתם פרופיל.' });
    next();
  },
  supplierForm.parseEditForm((req, res, message) => res.status(400).json({ error: message })),
  async (req, res) => {
    const form = supplierForm.readEditForm(req);
    const checked = supplierForm.checkEdit(form);
    if (checked.error) return res.status(400).json({ error: checked.error });

    const own = () => Object.values(db.load().suppliers).find((s) => s.ownerUserId === req.user.id);
    const target = own();
    if (!target) return res.status(404).json({ error: 'עוד לא שלחתם פרופיל.' });

    const newLogo = form.logoFile ? await storage.saveImage(target.id, form.logoFile) : null;
    let replacedLogo = null;
    const saved = await db.withDb((data) => {
      const s = data.suppliers[target.id];
      if (!s || s.ownerUserId !== req.user.id) return false;
      if (newLogo || form.removeLogo) { replacedLogo = s.logo || null; s.logo = newLogo || null; }
      s.description = checked.description;
      s.contactEmail = checked.contactEmail;
      s.packages = checked.packages;
      s.socialLinks = checked.socialLinks;
      s.links = '';
      s.updatedAt = new Date().toISOString();
      return true;
    });
    if (!saved) return res.status(404).json({ error: 'הפרופיל לא נמצא.' });

    // Only once the new logo is safely stored does the old file go.
    if (replacedLogo && replacedLogo !== newLogo) await storage.deleteImageByUrl(replacedLogo);
    res.json({ profile: catalog.ownProfile(db.load(), req.user.id) });
  }
);

/* ==========================================================================
   Admin area (admin rights re-checked on every request via requireAdmin)
   ========================================================================== */
app.get('/admin-suppliers/login', (req, res) => {
  res.redirect(`/login.html?next=${encodeURIComponent('/admin-suppliers')}`);
});

app.post('/admin-suppliers/logout', async (req, res) => {
  const sessionId = req.cookies?.[auth.SESSION_COOKIE];
  if (sessionId) await auth.destroySession(sessionId).catch(() => {});
  res.clearCookie(auth.SESSION_COOKIE);
  res.redirect('/');
});

app.get('/admin-suppliers', requireDb, auth.requireAdmin, (req, res) => {
  res.send(createFormPage({ adminEmail: req.adminEmail }));
});

app.get('/admin-suppliers/reviews', requireDb, auth.requireAdmin, (req, res) => {
  res.send(reviewsPage({ adminEmail: req.adminEmail, rows: reviews.adminRows(db.load()) }));
});

// Admins can remove any review; the supplier it is about cannot.
app.post(
  '/admin-suppliers/reviews/:id/delete',
  express.json({ limit: '1kb' }),
  requireSameOrigin,
  requireDb,
  auth.requireAdmin,
  deleteLimiter,
  async (req, res) => {
    const removed = await db.withDb((data) => reviews.deleteReview(data, req.params.id));
    if (!removed) return res.status(404).json({ error: 'הביקורת לא נמצאה' });
    res.json({ id: req.params.id });
  }
);

app.get('/admin-suppliers/profiles', requireDb, auth.requireAdmin, (req, res) => {
  const data = db.load();
  res.send(profilesPage({ adminEmail: req.adminEmail, reviewCount: Object.keys(data.reviews || {}).length, ...catalog.adminRows(data) }));
});

app.get('/admin-suppliers/featured', requireDb, auth.requireAdmin, (req, res) => {
  res.send(featuredPage({ adminEmail: req.adminEmail, ...catalog.featuredRows(db.load()) }));
});

app.get('/admin-suppliers/accounts', requireDb, auth.requireAdmin, (req, res) => {
  res.send(accountsPage({ adminEmail: req.adminEmail, accounts: auth.accountRows(db.load()) }));
});

app.get('/admin-suppliers/email', auth.requireAdmin, async (req, res) => {
  res.send(emailPage({ adminEmail: req.adminEmail, status: await emailStatus() }));
});

// Sends to the signed-in admin's own address only, and hands back whatever
// Resend said — that error message is the whole point of the page.
app.post(
  '/admin-suppliers/email/test',
  express.json({ limit: '1kb' }),
  requireSameOrigin,
  auth.requireAdmin,
  emailTestLimiter,
  async (req, res) => {
    const to = req.user.email;
    try {
      await sendEmail({
        to,
        subject: 'בדיקת שליחה — ביגי ספקים',
        html: `<div dir="rtl" style="font-family:sans-serif;">
          <p>שלום ${escapeHtml(req.user.name)},</p>
          <p>זהו מייל בדיקה שנשלח מאזור הניהול של ביגי ספקים. אם הוא הגיע — שליחת המיילים באתר עובדת.</p>
        </div>`,
      });
      res.json({ ok: true, to });
    } catch (err) {
      console.error('Test email failed:', err.message);
      res.status(502).json({ error: err.message });
    }
  }
);

app.post(
  '/admin-suppliers/accounts/:id/delete',
  express.json({ limit: '1kb' }),
  requireSameOrigin,
  requireDb,
  auth.requireAdmin,
  deleteLimiter,
  async (req, res) => {
    const { error, deleted } = await auth.deleteAccount(req.params.id, { actingUserId: req.user.id });
    if (error) return res.status(error === 'החשבון לא נמצא' ? 404 : 409).json({ error });
    console.log(`Admin ${req.adminEmail} deleted the account ${deleted.email}`);
    res.json({ deleted });
  }
);

app.post(
  '/admin-suppliers/featured',
  express.json({ limit: '10kb' }),
  requireSameOrigin,
  requireDb,
  auth.requireAdmin,
  visibilityLimiter,
  async (req, res) => {
    const error = await db.withDb((data) => catalog.setFeatured(data, req.body?.keys, req.adminEmail));
    if (error) return res.status(400).json({ error });
    res.json({ keys: req.body.keys.filter((k, i, all) => all.indexOf(k) === i) });
  }
);

app.post(
  '/admin-suppliers/profiles/:key/visibility',
  express.json({ limit: '1kb' }),
  requireSameOrigin,
  requireDb,
  auth.requireAdmin,
  visibilityLimiter,
  async (req, res) => {
    const published = req.body?.published;
    if (typeof published !== 'boolean') return res.status(400).json({ error: 'ערך לא תקין' });

    const found = await db.withDb((data) => catalog.setPublished(data, req.params.key, published, req.adminEmail));
    if (!found) return res.status(404).json({ error: 'הפרופיל לא נמצא' });
    res.json({ key: req.params.key, published });
  }
);

// "מומלץ" is not offered here — it comes from the מומלצים list and wins anyway.
// null clears the choice and puts the profile back on its default badge.
app.post(
  '/admin-suppliers/profiles/:key/badge',
  express.json({ limit: '1kb' }),
  requireSameOrigin,
  requireDb,
  auth.requireAdmin,
  visibilityLimiter,
  async (req, res) => {
    const badge = req.body?.badge;
    if (badge !== null && typeof badge !== 'string') return res.status(400).json({ error: 'ערך לא תקין' });

    const error = await db.withDb((data) => catalog.setBadge(data, req.params.key, badge, req.adminEmail));
    if (error) return res.status(400).json({ error });
    res.json({ key: req.params.key, badge });
  }
);

// Deleting is permanent: the profile leaves the database and its uploaded
// uploaded media are removed. Sample suppliers ship with the site, so they can only be
// switched to demo — never deleted.
app.post(
  '/admin-suppliers/profiles/:key/delete',
  express.json({ limit: '1kb' }),
  requireSameOrigin,
  requireDb,
  auth.requireAdmin,
  deleteLimiter,
  async (req, res) => {
    const deleted = await db.withDb((data) => catalog.deleteProfile(data, req.params.key));
    if (!deleted) {
      return res.status(404).json({ error: 'הפרופיל לא נמצא. ספקים לדוגמה אפשר להחזיר לדמו, אבל לא למחוק.' });
    }
    const mediaFiles = await storage.deleteSupplierImages(deleted.id);
    console.log(`Admin ${req.adminEmail} deleted the profile "${deleted.name}" (${deleted.id}) and ${mediaFiles} media file(s)`);
    res.json({ key: req.params.key, name: deleted.name, mediaFiles });
  }
);

app.post(
  '/admin-suppliers/create',
  requireDb,
  auth.requireAdmin,
  createLimiter,
  supplierForm.parseForm((req, res, message) => (
    res.status(400).send(createFormPage({ adminEmail: req.adminEmail, error: message, values: req.body }))
  )),
  async (req, res) => {
    const rerender = (error) => res.status(400).send(createFormPage({ adminEmail: req.adminEmail, error, values: req.body }));
    const form = supplierForm.readForm(req);
    const error = supplierForm.validateForm(form);
    if (error) return rerender(error);

    let supplier;
    try {
      supplier = await supplierForm.buildSupplier(form, { createdBy: req.adminEmail, source: 'admin' });
    } catch (err) {
      console.error('Media upload failed:', err);
      return rerender('העלאת התמונות או הסרטון נכשלה. נסו שוב.');
    }
    await db.withDb((data) => {
      data.suppliers[supplier.id] = supplier;
    });

    await notifyAdminsOfNewProfile(supplier, 'פרופיל ספק חדש נוצר באזור הניהול:');
    res.send(successPage({ name: supplier.name, link: `${BASE_URL}/supplier/view/${supplier.id}` }));
  }
);

/* ==========================================================================
   Supplier profile page — demo profiles are reachable only through their
   unguessable private link; live ones are also listed on the public site.
   ========================================================================== */
app.get('/supplier/view/:uuid', requireDb, (req, res) => {
  const data = db.load();
  const supplier = data.suppliers[req.params.uuid];
  if (!supplier) return res.status(404).send('לא נמצא.');
  if (!supplier.isPublic) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // The reviews tab differs per viewer (write form, login prompt, "your review"),
  // so no shared cache may keep a copy.
  res.setHeader('Cache-Control', 'private, no-store');
  const user = auth.currentUser(req);
  res.send(supplierViewPage(supplier, {
    baseUrl: BASE_URL,
    reviews: reviews.reviewsFor(data, supplier.id),
    viewer: user ? { id: user.id, role: user.role } : null,
  }));
});

// One review per customer per profile: this creates it or updates it.
app.put(
  '/api/suppliers/:id/reviews/mine',
  requireSameOrigin,
  requireDb,
  auth.requireUser,
  reviewLimiter,
  async (req, res) => {
    const result = await db.withDb((data) => reviews.saveReview(data, {
      supplierId: req.params.id, user: data.users[req.user.id], rating: req.body?.rating, text: req.body?.text,
    }));
    if (result.error) {
      const status = result.code === 'forbidden' ? 403 : result.code === 'missing' ? 404 : 400;
      return res.status(status).json({ error: result.error });
    }
    res.json({ created: result.created });
  }
);

app.delete(
  '/api/suppliers/:id/reviews/mine',
  requireSameOrigin,
  requireDb,
  auth.requireUser,
  reviewLimiter,
  async (req, res) => {
    const removed = await db.withDb((data) => reviews.deleteOwn(data, req.params.id, req.user.id));
    if (!removed) return res.status(404).json({ error: 'לא נמצאה ביקורת שלכם.' });
    res.json({ deleted: true });
  }
);

/* ==========================================================================
   The public site's data file — live suppliers only (admins also get demo
   samples, flagged hidden, so those profile pages still open for them).
   ========================================================================== */
app.get('/data.js', async (req, res) => {
  await db.init().catch((err) => console.error('Storage unavailable for data.js:', err.message));
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(catalog.dataJs(db.load(), { isAdmin: auth.isAdminUser(auth.currentUser(req)) }));
});

/* ==========================================================================
   Uploaded images (local development only) + the static marketplace site
   ========================================================================== */
if (!storage.USE_SUPABASE) {
  app.use('/uploads', express.static(storage.LOCAL_UPLOADS_DIR));
}

// Pages that were merged away — keep old links working.
app.get('/customer-login.html', (req, res) => res.redirect(301, '/login.html'));
app.get('/chat.html', (req, res) => res.redirect(301, '/'));

// Public pages contain a {{BASE_URL}} placeholder: link previews need the
// site's absolute address, which depends on where it's deployed.
app.get(/^\/(?:[\w-]+\.html)?$/, async (req, res, next) => {
  const file = path.join(BIGI_DIR, req.path === '/' ? 'index.html' : req.path.slice(1));
  try {
    const html = await fs.promises.readFile(file, 'utf8');
    res.type('html').send(html.replaceAll('{{BASE_URL}}', BASE_URL));
  } catch (err) {
    if (err.code === 'ENOENT') return next();
    next(err);
  }
});

app.use(express.static(BIGI_DIR));

app.use((req, res) => res.status(404).send('הדף לא נמצא.'));

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ error: 'בקשה לא תקינה' });
  }
  console.error(err);
  if (isJsonRequest(req)) return res.status(500).json({ error: 'משהו השתבש. נסו שוב.' });
  res.status(500).send('משהו השתבש.');
});

app.listen(PORT, () => {
  console.log(`\n✅ ביגי ספקים רץ על ${BASE_URL}`);
  console.log(`   מיילים של מנהלים:  ${ADMIN_EMAILS.join(', ') || '(ריק!)'}`);
  console.log(`   אחסון:             ${storage.USE_SUPABASE ? 'Supabase' : 'קבצים מקומיים (פיתוח)'}\n`);
  db.init().catch((err) => console.error('⚠️  Could not load stored data yet:', err.message));
});
