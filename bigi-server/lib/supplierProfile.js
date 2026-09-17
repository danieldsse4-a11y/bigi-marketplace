// The supplier-profile form, shared by the admin "create profile" page and
// the public supplier sign-up — same fields, same rules, same storage.

const crypto = require('crypto');
const multer = require('multer');
const storage = require('./storage');
const { categoryById, CITIES } = require('./siteData');

const MIN_PRODUCT_IMAGES = 5;
const MAX_PRODUCT_IMAGES = 10;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_PRODUCT_IMAGES + 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error('סוג קובץ לא נתמך — רק JPG, PNG או WebP.'));
    cb(null, true);
  },
}).fields([
  { name: 'productImages', maxCount: MAX_PRODUCT_IMAGES },
  { name: 'backgroundImage', maxCount: 1 },
]);

function uploadErrorMessage(err) {
  if (err.code === 'LIMIT_FILE_SIZE') return 'אחת התמונות גדולה מדי — עד 5MB לתמונה.';
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return `אפשר להעלות עד ${MAX_PRODUCT_IMAGES} תמונות מוצר ותמונת רקע אחת.`;
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
    captions: Array.isArray(captionsRaw) ? captionsRaw : (captionsRaw ? [captionsRaw] : []),
    productFiles: req.files?.productImages || [],
    backgroundFile: req.files?.backgroundImage?.[0],
  };
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
  return null;
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
  return {
    id,
    name: form.name,
    category: form.category,
    city: form.city,
    description: form.description,
    phone: form.phone,
    contactEmail: form.contactEmail,
    links: form.links,
    backgroundImage,
    productImages,
    isPublic: false,
    unlisted: true,
    source,
    ownerUserId,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

module.exports = { MIN_PRODUCT_IMAGES, MAX_PRODUCT_IMAGES, parseForm, readForm, validateForm, buildSupplier };
