// The supplier-profile form, shared by the admin "create profile" page and
// the public supplier sign-up — same fields, same rules, same storage.

const crypto = require('crypto');
const multer = require('multer');
const storage = require('./storage');
const { categoryById, CITIES } = require('./siteData');

const MIN_PRODUCT_IMAGES = 5;
const MAX_PRODUCT_IMAGES = 10;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 45 * 1024 * 1024;
const MAX_PACKAGES = 6;
const MAX_PACKAGE_ITEMS = 12;
const MAX_PRICE = 1000000;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: MAX_PRODUCT_IMAGES + 2 },
  fileFilter(req, file, cb) {
    const allowed = file.fieldname === 'video' ? VIDEO_MIME : IMAGE_MIME;
    if (!allowed.has(file.mimetype)) {
      return cb(new Error(file.fieldname === 'video'
        ? 'סוג הסרטון לא נתמך — רק MP4, WebM או MOV.'
        : 'סוג קובץ לא נתמך — רק JPG, PNG או WebP.'));
    }
    cb(null, true);
  },
}).fields([
  { name: 'productImages', maxCount: MAX_PRODUCT_IMAGES },
  { name: 'backgroundImage', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

function uploadErrorMessage(err) {
  if (err.code === 'LIMIT_FILE_SIZE') return 'הקובץ גדול מדי — סרטון עד 45MB ותמונה עד 5MB.';
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return `אפשר להעלות עד ${MAX_PRODUCT_IMAGES} תמונות מוצר, תמונת רקע וסרטון אחד.`;
  return err.message;
}

// Express middleware: parses the multipart form; on failure calls onError(req, res, message).
function parseForm(onError) {
  return (req, res, next) => upload(req, res, (err) => (err ? onError(req, res, uploadErrorMessage(err)) : next()));
}

function readForm(req) {
  const text = (key) => String(req.body?.[key] || '').trim();
  const captionsRaw = req.body?.productCaptions;
  return {
    name: text('name'),
    category: text('category'),
    city: text('city'),
    description: text('description'),
    phone: text('phone'),
    contactEmail: text('contactEmail'),
    links: text('links'),
    packages: text('packages'),
    videoLink: text('videoLink'),
    captions: Array.isArray(captionsRaw) ? captionsRaw : (captionsRaw ? [captionsRaw] : []),
    productFiles: req.files?.productImages || [],
    backgroundFile: req.files?.backgroundImage?.[0],
    videoFile: req.files?.video?.[0],
  };
}

function normalizeVideoLink(raw) {
  if (!raw) return null;
  if (raw.length > 500) return { error: 'הקישור לסרטון ארוך מדי.' };
  let url;
  try { url = new URL(raw); } catch { return { error: 'הקישור לסרטון אינו תקין.' }; }
  if (!['http:', 'https:'].includes(url.protocol)) return { error: 'הקישור לסרטון חייב להתחיל ב־http או https.' };

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let youtubeId = null;
  if (host === 'youtu.be') youtubeId = url.pathname.split('/').filter(Boolean)[0];
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') youtubeId = url.searchParams.get('v');
    else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) youtubeId = url.pathname.split('/')[2];
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) {
    return { kind: 'embed', url: url.href, embed: `https://www.youtube-nocookie.com/embed/${youtubeId}` };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const vimeoId = url.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
    if (vimeoId) return { kind: 'embed', url: url.href, embed: `https://player.vimeo.com/video/${vimeoId}` };
  }

  return { kind: 'link', url: url.href };
}

/* The packages arrive as a JSON string in one form field — the rows are
   dynamic and every one carries several fields, so this keeps them together
   instead of relying on the position of many parallel fields.
   Returns { value } or { error }. The price is optional: null means "no price". */
function parseJsonArray(raw, what) {
  if (!raw) return { value: [] };
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { error: `${what} לא תקינות.` }; }
  if (!Array.isArray(parsed)) return { error: `${what} לא תקינות.` };
  return { value: parsed };
}

function normalizePackages(raw) {
  const list = parseJsonArray(raw, 'החבילות');
  if (list.error) return list;
  if (list.value.length > MAX_PACKAGES) return { error: `אפשר להוסיף עד ${MAX_PACKAGES} חבילות.` };

  const value = [];
  for (const [i, entry] of list.value.entries()) {
    const label = `חבילה ${i + 1}`;
    if (!entry || typeof entry !== 'object') return { error: `${label}: הנתונים לא תקינים.` };

    const name = String(entry.name ?? '').trim();
    if (!name) return { error: `${label}: יש להזין שם לחבילה.` };
    if (name.length > 60) return { error: `${label}: השם ארוך מדי (עד 60 תווים).` };

    let price = null;
    if (entry.price !== null && entry.price !== undefined && String(entry.price).trim() !== '') {
      price = Number(entry.price);
      if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE) {
        return { error: `${label}: המחיר חייב להיות מספר שלם חיובי, או להישאר ריק.` };
      }
    }

    const rawItems = Array.isArray(entry.items) ? entry.items : [];
    const items = rawItems.map((item) => String(item ?? '').trim()).filter(Boolean);
    if (items.length > MAX_PACKAGE_ITEMS) return { error: `${label}: אפשר לפרט עד ${MAX_PACKAGE_ITEMS} דברים בחבילה.` };
    if (items.some((item) => item.length > 100)) return { error: `${label}: אחד הפריטים ארוך מדי (עד 100 תווים).` };

    value.push({ name, price, items });
  }
  return { value };
}

// Everything the form sends as structured data, checked in one place.
function parseExtras(form) {
  const packages = normalizePackages(form.packages);
  if (packages.error) return { error: packages.error };
  return { packages: packages.value };
}

// Returns an error message for the form, or null when it's valid.
function validateForm(form) {
  if (!form.name) return 'שם העסק הוא שדה חובה.';
  if (form.name.length > 80) return 'שם העסק ארוך מדי.';
  if (!categoryById(form.category)) return 'נא לבחור קטגוריה מהרשימה.';
  if (form.city && !CITIES.includes(form.city)) return 'נא לבחור עיר מהרשימה.';
  if (form.description.length > 2000) return 'התיאור ארוך מדי (עד 2000 תווים).';
  if (form.productFiles.length < MIN_PRODUCT_IMAGES) {
    return `יש להעלות לפחות ${MIN_PRODUCT_IMAGES} תמונות מוצר (הועלו ${form.productFiles.length}).`;
  }
  if (!form.backgroundFile) return 'יש להעלות תמונת רקע לפרופיל.';
  const oversizedImage = [...form.productFiles, form.backgroundFile].find((file) => file && file.size > MAX_IMAGE_BYTES);
  if (oversizedImage) return 'אחת התמונות גדולה מדי — עד 5MB לתמונה.';
  if (form.videoFile && form.videoLink) return 'יש לבחור סרטון להעלאה או להדביק קישור — לא את שניהם.';
  const normalizedLink = normalizeVideoLink(form.videoLink);
  if (normalizedLink?.error) return normalizedLink.error;
  return parseExtras(form).error || null;
}

// Uploads the photos and returns the new (demo) supplier record.
async function buildSupplier(form, { createdBy, source, ownerUserId = null }) {
  const id = crypto.randomUUID();
  const backgroundImage = await storage.saveImage(id, form.backgroundFile);
  const productImages = [];
  for (const [i, file] of form.productFiles.entries()) {
    productImages.push({
      file: await storage.saveImage(id, file),
      caption: String(form.captions[i] || '').trim().slice(0, 200) || 'ללא תיאור',
    });
  }
  const video = form.videoFile
    ? { kind: 'video', url: await storage.saveVideo(id, form.videoFile) }
    : normalizeVideoLink(form.videoLink);
  return {
    id,
    name: form.name,
    category: form.category,
    city: form.city,
    description: form.description,
    phone: form.phone,
    contactEmail: form.contactEmail,
    links: form.links,
    packages: parseExtras(form).packages,
    backgroundImage,
    productImages,
    video,
    isPublic: false,
    unlisted: true,
    source,
    ownerUserId,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

module.exports = {
  MIN_PRODUCT_IMAGES, MAX_PRODUCT_IMAGES, MAX_PACKAGES,
  parseForm, readForm, validateForm, buildSupplier, normalizeVideoLink, normalizePackages,
};
