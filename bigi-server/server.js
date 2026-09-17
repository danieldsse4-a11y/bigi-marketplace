const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const db = require('./lib/db');
const storage = require('./lib/storage');
const { sendEmail } = require('./lib/email');
const auth = require('./lib/auth');
const catalog = require('./lib/catalog');
const { categoryById, CITIES } = require('./lib/siteData');
const { loginPage } = require('./views/adminLogin');
const { createFormPage, successPage } = require('./views/adminForm');
const { profilesPage } = require('./views/adminProfiles');
const { supplierViewPage } = require('./views/supplierView');

const PORT = process.env.PORT || 3000;
// RENDER_EXTERNAL_URL is set automatically by Render — this means a fresh
// deploy works with zero manual config; BASE_URL only needs to be set by
// hand for other hosts or to override it.
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const ADMIN_EMAILS = auth.getWhitelist();
const BIGI_DIR = path.join(__dirname, '..', 'bigi');

if (ADMIN_EMAILS.length === 0) {
  console.warn('⚠️  ADMIN_EMAILS is empty in .env — nobody will be able to log in to /admin-suppliers.');
}
if (!storage.USE_SUPABASE && process.env.RENDER) {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_SECRET_KEY are not set — profiles, photos and admin logins are stored on Render\'s temporary disk and will be LOST on the next restart.');
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

// Admin pages need the stored data; if storage is unreachable, say so instead
// of showing an empty admin area.
async function requireDb(req, res, next) {
  try {
    await db.init();
    next();
  } catch (err) {
    console.error('Storage unavailable:', err.message);
    if (req.is('application/json')) return res.status(503).json({ error: 'האחסון לא זמין כרגע' });
    if (req.path.startsWith('/admin-suppliers')) {
      return res.status(503).send(loginPage({ error: 'האחסון לא זמין כרגע. נסו שוב בעוד דקה.' }));
    }
    res.status(503).send('השירות לא זמין כרגע. נסו שוב בעוד דקה.');
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

const visibilityLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'יותר מדי שינויים. נסו שוב בעוד כמה דקות.' },
});

/* ==========================================================================
   Uploads — kept in memory, validated, then saved via lib/storage.js
   ========================================================================== */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIN_PRODUCT_IMAGES = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 11 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('סוג קובץ לא נתמך — רק JPG, PNG או WebP.'));
    }
    cb(null, true);
  },
});

/* ==========================================================================
   Admin auth routes
   ========================================================================== */
app.get('/admin-suppliers/login', (req, res) => {
  res.send(loginPage());
});

app.post('/admin-suppliers/login', loginLimiter, requireDb, async (req, res) => {
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

app.get('/admin-suppliers/verify', requireDb, async (req, res) => {
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
  if (sessionId) await auth.destroySession(sessionId).catch(() => {});
  res.clearCookie(auth.SESSION_COOKIE);
  res.redirect('/admin-suppliers/login');
});

// Lets the public homepage quietly ask "is *this* browser currently an
// authenticated admin?" so it can show a shortcut button only to someone who
// has already completed the whitelist + magic-link login — never to a
// random visitor.
app.get('/admin-suppliers/session-status', async (req, res) => {
  await db.init().catch(() => {});
  res.json({ isAdmin: Boolean(auth.adminEmailFor(req)) });
});

/* ==========================================================================
   Admin area (whitelist + session re-checked on every request via requireAdmin)
   ========================================================================== */
app.get('/admin-suppliers', requireDb, auth.requireAdmin, (req, res) => {
  res.send(createFormPage({ adminEmail: req.adminEmail }));
});

app.get('/admin-suppliers/profiles', requireDb, auth.requireAdmin, (req, res) => {
  const { created, samples } = catalog.adminRows(db.load());
  res.send(profilesPage({ adminEmail: req.adminEmail, created, samples }));
});

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

app.post(
  '/admin-suppliers/create',
  requireDb,
  auth.requireAdmin,
  createLimiter,
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
    const city = String(req.body.city || '').trim();
    const description = String(req.body.description || '').trim();
    const phone = String(req.body.phone || '').trim();
    const contactEmail = String(req.body.contactEmail || '').trim();
    const links = String(req.body.links || '').trim();
    const captionsRaw = req.body.productCaptions;
    const captions = Array.isArray(captionsRaw) ? captionsRaw : (captionsRaw ? [captionsRaw] : []);

    const productFiles = req.files?.productImages || [];
    const bgFile = req.files?.backgroundImage?.[0];

    const rerender = (error) => res.status(400).send(createFormPage({ adminEmail: req.adminEmail, error, values: req.body }));

    if (!name) return rerender('שם הספק הוא שדה חובה.');
    if (!categoryById(category)) return rerender('נא לבחור קטגוריה מהרשימה.');
    if (city && !CITIES.includes(city)) return rerender('נא לבחור עיר מהרשימה.');
    if (productFiles.length < MIN_PRODUCT_IMAGES) return rerender(`יש להעלות לפחות ${MIN_PRODUCT_IMAGES} תמונות מוצר (הועלו ${productFiles.length}).`);
    if (!bgFile) return rerender('יש להעלות תמונת רקע לפרופיל.');

    const id = crypto.randomUUID();
    let backgroundImage;
    let productImages;
    try {
      backgroundImage = await storage.saveImage(id, bgFile);
      productImages = [];
      for (const [i, file] of productFiles.entries()) {
        productImages.push({
          file: await storage.saveImage(id, file),
          caption: (captions[i] || '').trim() || 'ללא תיאור',
        });
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      return rerender('העלאת התמונות נכשלה. נסו שוב.');
    }

    const supplier = {
      id,
      name,
      category,
      city,
      description,
      phone,
      contactEmail,
      links,
      backgroundImage,
      productImages,
      isPublic: false,
      unlisted: true,
      createdAt: new Date().toISOString(),
      createdBy: req.adminEmail,
    };

    await db.withDb((data) => {
      data.suppliers[supplier.id] = supplier;
    });

    const link = `${BASE_URL}/supplier/view/${supplier.id}`;
    const categoryName = categoryById(category).name;
    try {
      await sendEmail({
        to: ADMIN_EMAILS,
        subject: `פרופיל ספק חדש נוצר: ${name}`,
        html: `<div dir="rtl" style="font-family:sans-serif;">
          <p>פרופיל ספק חדש נוצר בביגי ספקים (כדמו — לא מופיע באתר):</p>
          <p><strong>${name}</strong> (${categoryName})</p>
          <p>קישור פרטי לצפייה בפרופיל:</p>
          <p><a href="${link}">${link}</a></p>
          <p style="color:#888;font-size:12px;">לפרסום באתר: אזור הניהול ← כל הפרופילים.</p>
        </div>`,
      });
    } catch (err) {
      console.error('Failed to send new-supplier notification email:', err);
    }

    res.send(successPage({ name, link }));
  }
);

/* ==========================================================================
   Supplier profile page — demo profiles are reachable only through their
   unguessable private link; live ones are also listed on the public site.
   ========================================================================== */
app.get('/supplier/view/:uuid', requireDb, (req, res) => {
  const supplier = db.load().suppliers[req.params.uuid];
  if (!supplier) return res.status(404).send('לא נמצא.');
  if (!supplier.isPublic) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.send(supplierViewPage(supplier));
});

/* ==========================================================================
   The public site's data file — live suppliers only (admins also get demo
   samples, flagged hidden, so those profile pages still open for them).
   ========================================================================== */
app.get('/data.js', async (req, res) => {
  await db.init().catch((err) => console.error('Storage unavailable for data.js:', err.message));
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-store');
  res.send(catalog.dataJs(db.load(), { isAdmin: Boolean(auth.adminEmailFor(req)) }));
});

/* ==========================================================================
   Uploaded images (local development only) + the static marketplace site
   ========================================================================== */
if (!storage.USE_SUPABASE) {
  app.use('/uploads', express.static(storage.LOCAL_UPLOADS_DIR));
}
app.use(express.static(BIGI_DIR));

app.use((req, res) => res.status(404).send('הדף לא נמצא.'));

app.use((err, req, res, next) => {
  console.error(err);
  if (req.is('application/json')) return res.status(500).json({ error: 'משהו השתבש' });
  res.status(500).send('משהו השתבש.');
});

app.listen(PORT, () => {
  console.log(`\n✅ ביגי ספקים (+ אזור ניהול) רץ על ${BASE_URL}`);
  console.log(`   אתר ציבורי:        ${BASE_URL}/`);
  console.log(`   כניסת מנהלים:      ${BASE_URL}/admin-suppliers/login`);
  console.log(`   מיילים מורשים:     ${ADMIN_EMAILS.join(', ') || '(ריק!)'}`);
  console.log(`   אחסון:             ${storage.USE_SUPABASE ? 'Supabase' : 'קבצים מקומיים (פיתוח)'}\n`);
  db.init().catch((err) => console.error('⚠️  Could not load stored data yet:', err.message));
});
