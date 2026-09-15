const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const crypto = require('crypto');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const { withDb, load } = require('./lib/db');
const { sendEmail } = require('./lib/email');
const auth = require('./lib/auth');
const { loginPage } = require('./views/adminLogin');
const { createFormPage, successPage } = require('./views/adminForm');
const { supplierViewPage } = require('./views/supplierView');

const PORT = process.env.PORT || 3000;
// RENDER_EXTERNAL_URL is set automatically by Render — this means a fresh
// deploy works with zero manual config; BASE_URL only needs to be set by
// hand for other hosts or to override it.
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_EMAILS = auth.getWhitelist();
const BIGI_DIR = path.join(__dirname, '..', 'bigi');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (ADMIN_EMAILS.length === 0) {
  console.warn('⚠️  ADMIN_EMAILS is empty in .env — nobody will be able to log in to /admin-suppliers.');
}

const app = express();
app.disable('x-powered-by');
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Minimal, dependency-free security headers.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

/* ==========================================================================
   Rate limiting
   ========================================================================== */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'יותר מדי ניסיונות התחברות. נסו שוב בעוד כמה דקות.',
});

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'יותר מדי בקשות ליצירת פרופיל. נסו שוב מאוחר יותר.',
});

/* ==========================================================================
   Uploads (multer) — a fresh UUID is assigned per submission BEFORE multer
   runs, so files land straight in their final /uploads/suppliers/<uuid>/ dir.
   ========================================================================== */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = path.join(UPLOADS_DIR, 'suppliers', req.supplierId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '') || '.jpg';
    cb(null, crypto.randomBytes(8).toString('hex') + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 11 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('סוג קובץ לא נתמך — רק JPG, PNG או WebP.'));
    }
    cb(null, true);
  },
});

function assignSupplierId(req, res, next) {
  req.supplierId = crypto.randomUUID();
  next();
}

/* ==========================================================================
   Admin auth routes
   ========================================================================== */
app.get('/admin-suppliers/login', (req, res) => {
  res.send(loginPage());
});

app.post('/admin-suppliers/login', loginLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).send(loginPage({ error: 'נא להזין כתובת מייל.' }));

  // Always show the same "check your email" response whether or not the
  // address is whitelisted, so this endpoint can't be used to probe who's
  // on the list. The email itself is only ever sent to whitelisted addresses.
  if (auth.isWhitelisted(email)) {
    const token = await auth.createMagicToken(email);
    const link = `${BASE_URL}/admin-suppliers/verify?token=${token}`;
    try {
      await sendEmail({
        to: email,
        subject: 'קישור התחברות — אזור ניהול ביגי ספקים',
        html: `<div dir="rtl" style="font-family:sans-serif;">
          <p>קישור חד־פעמי להתחברות לאזור הניהול (בתוקף ל־15 דקות):</p>
          <p><a href="${link}">${link}</a></p>
          <p style="color:#888;font-size:12px;">אם לא ביקשתם קישור זה, אפשר להתעלם מהמייל.</p>
        </div>`,
      });
    } catch (err) {
      console.error('Failed to send magic link email:', err);
    }
  }

  res.send(loginPage({ sentTo: email }));
});

app.get('/admin-suppliers/verify', async (req, res) => {
  const token = String(req.query.token || '');
  const email = token ? await auth.consumeMagicToken(token) : null;

  if (!email || !auth.isWhitelisted(email)) {
    return res.status(401).send(loginPage({ error: 'הקישור אינו תקף או שפג תוקפו. נסו להתחבר שוב.' }));
  }

  const sessionId = await auth.createSession(email);
  res.cookie(auth.SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: BASE_URL.startsWith('https'),
    maxAge: auth.SESSION_TTL_MS,
  });
  res.redirect('/admin-suppliers');
});

app.post('/admin-suppliers/logout', async (req, res) => {
  const sessionId = req.cookies?.[auth.SESSION_COOKIE];
  if (sessionId) await auth.destroySession(sessionId);
  res.clearCookie(auth.SESSION_COOKIE);
  res.redirect('/admin-suppliers/login');
});

// Lets the public homepage quietly ask "is *this* browser currently an
// authenticated admin?" so it can show a shortcut button only to someone who
// has already completed the whitelist + magic-link login — never to a
// random visitor. Same whitelist + session checks as requireAdmin, just
// returns JSON instead of redirecting.
app.get('/admin-suppliers/session-status', (req, res) => {
  const sessionId = req.cookies?.[auth.SESSION_COOKIE];
  const db = load();
  const session = sessionId ? db.sessions[sessionId] : null;
  const isAdmin = !!(session && Date.now() < session.expiresAt && auth.isWhitelisted(session.email));
  res.json({ isAdmin });
});

/* ==========================================================================
   Admin area (whitelist + session re-checked on every request via requireAdmin)
   ========================================================================== */
app.get('/admin-suppliers', auth.requireAdmin, (req, res) => {
  res.send(createFormPage({ adminEmail: req.adminEmail }));
});

app.post(
  '/admin-suppliers/create',
  auth.requireAdmin,
  createLimiter,
  assignSupplierId,
  (req, res, next) => {
    upload.fields([
      { name: 'productImages', maxCount: 10 },
      { name: 'backgroundImage', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return res.status(400).send(createFormPage({ adminEmail: req.adminEmail, error: err.message, values: req.body }));
      next();
    });
  },
  async (req, res) => {
    const name = String(req.body.name || '').trim();
    const category = String(req.body.category || '').trim();
    const description = String(req.body.description || '').trim();
    const phone = String(req.body.phone || '').trim();
    const contactEmail = String(req.body.contactEmail || '').trim();
    const links = String(req.body.links || '').trim();
    const captionsRaw = req.body.productCaptions;
    const captions = Array.isArray(captionsRaw) ? captionsRaw : (captionsRaw ? [captionsRaw] : []);

    const productFiles = req.files?.productImages || [];
    const bgFile = req.files?.backgroundImage?.[0];

    const rerender = (error) => res.status(400).send(createFormPage({ adminEmail: req.adminEmail, error, values: req.body }));

    const MIN_PRODUCT_IMAGES = 5;
    if (!name || !category) return rerender('שם הספק וקטגוריה הם שדות חובה.');
    if (productFiles.length < MIN_PRODUCT_IMAGES) return rerender(`יש להעלות לפחות ${MIN_PRODUCT_IMAGES} תמונות מוצר (הועלו ${productFiles.length}).`);
    if (!bgFile) return rerender('יש להעלות תמונת רקע לפרופיל.');

    const productImages = productFiles.map((f, i) => ({
      file: `/uploads/suppliers/${req.supplierId}/${f.filename}`,
      caption: (captions[i] || '').trim() || 'ללא תיאור',
    }));

    const supplier = {
      id: req.supplierId,
      name,
      category,
      description,
      phone,
      contactEmail,
      links,
      backgroundImage: `/uploads/suppliers/${req.supplierId}/${bgFile.filename}`,
      productImages,
      isPublic: false,
      unlisted: true,
      createdAt: new Date().toISOString(),
      createdBy: req.adminEmail,
    };

    await withDb((db) => {
      db.suppliers[supplier.id] = supplier;
    });

    const link = `${BASE_URL}/supplier/view/${supplier.id}`;
    try {
      await sendEmail({
        to: ADMIN_EMAILS,
        subject: `פרופיל ספק חדש נוצר: ${name}`,
        html: `<div dir="rtl" style="font-family:sans-serif;">
          <p>פרופיל ספק חדש נוצר בביגי ספקים:</p>
          <p><strong>${name}</strong> (${category})</p>
          <p>קישור פרטי לצפייה בפרופיל:</p>
          <p><a href="${link}">${link}</a></p>
          <p style="color:#888;font-size:12px;">הפרופיל אינו מופיע באתר הציבורי — נגיש רק דרך קישור זה.</p>
        </div>`,
      });
    } catch (err) {
      console.error('Failed to send new-supplier notification email:', err);
    }

    res.send(successPage({ name, link }));
  }
);

/* ==========================================================================
   Private supplier profile view — gated purely by an unguessable UUID.
   Never linked from any public page, never listed, never in a sitemap.
   ========================================================================== */
app.get('/supplier/view/:uuid', async (req, res) => {
  const db = load();
  const supplier = db.suppliers[req.params.uuid];
  if (!supplier) return res.status(404).send('לא נמצא.');
  res.send(supplierViewPage(supplier));
});

/* ==========================================================================
   Uploaded images + the existing static marketplace site
   ========================================================================== */
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.static(BIGI_DIR));

app.use((req, res) => res.status(404).send('הדף לא נמצא.'));

// Multer / unexpected errors that slipped past the inline handler above.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('משהו השתבש.');
});

app.listen(PORT, () => {
  console.log(`\n✅ ביגי ספקים (+ אזור ניהול) רץ על ${BASE_URL}`);
  console.log(`   אתר ציבורי:        ${BASE_URL}/`);
  console.log(`   כניסת מנהלים:      ${BASE_URL}/admin-suppliers/login`);
  console.log(`   מיילים מורשים:     ${ADMIN_EMAILS.join(', ') || '(ריק!)'}\n`);
});
