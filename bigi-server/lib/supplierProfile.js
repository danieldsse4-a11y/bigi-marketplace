// The supplier-profile form, shared by the admin "create profile" page and
// the public supplier sign-up — same fields, same rules, same storage.

const crypto = require('crypto');
const multer = require('multer');
const storage = require('./storage');
const { categoryById, CITIES } = require('./siteData');

const MIN_PRODUCT_IMAGES = 5;
const MAX_PRODUCT_IMAGES = 30;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 45 * 1024 * 1024;
const MAX_PACKAGES = 6;
const MAX_PACKAGE_ITEMS = 12;
const MAX_PRICE = 1000000;
const MAX_SOCIAL_LINKS = 6;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
// The ציוד section: groups the supplier names, each holding photos and videos.
const MAX_EQUIPMENT_GROUPS = 10;
const MAX_EQUIPMENT_NAME = 40;
const MAX_EQUIPMENT_PER_GROUP = 20;
const MAX_EQUIPMENT_ITEMS = 60;
// Every file is held in memory until it reaches storage, so 30 photos plus a
// video could use more RAM than the whole instance has. The size of the
// submission is checked from its header, before a single byte is read.
const MAX_UPLOAD_BYTES = 120 * 1024 * 1024;
const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

function fileFilter(req, file, cb) {
  const isImage = IMAGE_MIME.has(file.mimetype);
  const isVideo = VIDEO_MIME.has(file.mimetype);
  if (file.fieldname === 'video' && !isVideo) return cb(new Error('סוג הסרטון לא נתמך — רק MP4, WebM או MOV.'));
  if (file.fieldname === 'equipmentFiles' && !isImage && !isVideo) return cb(new Error('סוג קובץ לא נתמך בציוד — רק JPG, PNG, WebP, MP4, WebM או MOV.'));
  if (file.fieldname !== 'video' && file.fieldname !== 'equipmentFiles' && !isImage) return cb(new Error('סוג קובץ לא נתמך — רק JPG, PNG או WebP.'));
  cb(null, true);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: MAX_PRODUCT_IMAGES + 3 },
  fileFilter,
}).fields([
  { name: 'productImages', maxCount: MAX_PRODUCT_IMAGES },
  { name: 'backgroundImage', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

function uploadErrorMessage(err) {
  if (err.code === 'LIMIT_FILE_SIZE') return 'הקובץ גדול מדי — סרטון עד 45MB ותמונה עד 5MB.';
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return `אפשר להעלות עד ${MAX_PRODUCT_IMAGES} תמונות מוצר, תמונת רקע, לוגו, סרטון אחד ועד ${MAX_EQUIPMENT_ITEMS} פריטי ציוד.`;
  return err.message;
}

// Express middleware: parses the multipart form; on failure calls onError(req, res, message).
function parseForm(onError) {
  const tooBig = `סך כל הקבצים בשליחה אחת גדול מדי (עד ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB). העלו פחות תמונות, או תמונות קטנות יותר.`;
  return (req, res, next) => {
    if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD_BYTES) return onError(req, res, tooBig);
    upload(req, res, (err) => (err ? onError(req, res, uploadErrorMessage(err)) : next()));
  };
}

// Editing takes the same files as sign-up: photos, a background, a logo and a
// video — plus the equipment photos and videos. The per-kind size limits are
// checked in checkEdit.
const editUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: MAX_PRODUCT_IMAGES + 3 + MAX_EQUIPMENT_ITEMS },
  fileFilter,
}).fields([
  { name: 'productImages', maxCount: MAX_PRODUCT_IMAGES },
  { name: 'backgroundImage', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'equipmentFiles', maxCount: MAX_EQUIPMENT_ITEMS },
]);

function parseEditForm(onError) {
  const tooBig = `סך כל הקבצים בשליחה אחת גדול מדי (עד ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB). העלו פחות תמונות בכל פעם.`;
  return (req, res, next) => {
    if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD_BYTES) return onError(req, res, tooBig);
    editUpload(req, res, (err) => (err ? onError(req, res, uploadErrorMessage(err)) : next()));
  };
}

// A phone number for WhatsApp: digits with the usual separators, 9–13 digits
// (050-1234567, +972 50 123 4567). Returns an error message or null.
function phoneError(phone, { required }) {
  if (!phone) return required ? 'מספר טלפון לוואטסאפ הוא שדה חובה.' : null;
  const digits = phone.replace(/\D/g, '');
  if (phone.length > 25 || !/^[\d\s()+-]+$/.test(phone) || digits.length < 9 || digits.length > 13) {
    return 'מספר הטלפון אינו תקין — לדוגמה 050-1234567.';
  }
  return null;
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
    socialLinks: text('socialLinks'),
    videoLink: text('videoLink'),
    captions: Array.isArray(captionsRaw) ? captionsRaw : (captionsRaw ? [captionsRaw] : []),
    productFiles: req.files?.productImages || [],
    backgroundFile: req.files?.backgroundImage?.[0],
    logoFile: req.files?.logo?.[0],
    videoFile: req.files?.video?.[0],
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The parts of a profile a supplier can change after it exists.
function readEditForm(req) {
  const text = (key) => String(req.body?.[key] || '').trim();
  // null when the field wasn't sent at all (an older copy of the page): that
  // value is then left as it is.
  const sent = (key) => (req.body?.[key] === undefined ? null : text(key));
  const captionsRaw = req.body?.productCaptions;
  return {
    name: sent('name'),
    category: sent('category'),
    city: sent('city'),
    description: text('description'),
    contactEmail: text('contactEmail'),
    phone: sent('phone'),
    packages: text('packages'),
    socialLinks: text('socialLinks'),
    removeLogo: text('removeLogo') === '1',
    logoFile: req.files?.logo?.[0],
    backgroundFile: req.files?.backgroundImage?.[0],
    videoFile: req.files?.video?.[0],
    videoLink: text('videoLink'),
    removeVideo: text('removeVideo') === '1',
    // New photos, each with its caption, and the addresses of photos to remove.
    productFiles: req.files?.productImages || [],
    captions: Array.isArray(captionsRaw) ? captionsRaw : (captionsRaw ? [captionsRaw] : []),
    removePhotos: text('removePhotos'),
    // Photos the profile already has, reused in the main gallery: [{ url, caption }].
    pickedPhotos: text('pickedPhotos'),
    // The whole ציוד section as the page wants it to be, plus its new files.
    equipment: sent('equipment'),
    equipmentFiles: req.files?.equipmentFiles || [],
  };
}

/* The equipment section arrives as one JSON list of groups:
     [{ id: "existing id" | null, name: "רמקולים", items: [
         { id: "existing item id" },      kept as it is
         { file: 0 },                     equipmentFiles[0], a new photo or video
         { link: "https://youtu.be/…" }   a new pasted video link
     ] }]
   Anything of the profile's equipment not named here is removed.
   Returns { groups } or { error }; null when the field was not sent. */
function parseEquipment(raw, files) {
  if (raw === null) return null;
  const list = parseJsonArray(raw, 'קטגוריות הציוד');
  if (list.error) return { error: list.error };
  if (list.value.length > MAX_EQUIPMENT_GROUPS) return { error: `אפשר עד ${MAX_EQUIPMENT_GROUPS} קטגוריות ציוד.` };

  const groups = [];
  const names = new Set();
  const usedFiles = new Set();
  let total = 0;
  for (const [i, entry] of list.value.entries()) {
    const label = `קטגוריית ציוד ${i + 1}`;
    if (!entry || typeof entry !== 'object') return { error: `${label}: הנתונים לא תקינים.` };
    const name = String(entry.name ?? '').trim().replace(/\s+/g, ' ');
    if (!name) return { error: `${label}: יש לתת שם לקטגוריה.` };
    if (name.length > MAX_EQUIPMENT_NAME) return { error: `${label}: השם ארוך מדי (עד ${MAX_EQUIPMENT_NAME} תווים).` };
    if (names.has(name)) return { error: `השם "${name}" מופיע פעמיים — לכל קטגוריית ציוד צריך שם משלה.` };
    names.add(name);
    const id = entry.id == null ? null : String(entry.id);
    if (id !== null && !/^[\w-]{1,40}$/.test(id)) return { error: `${label}: הנתונים לא תקינים.` };

    const rawItems = Array.isArray(entry.items) ? entry.items : [];
    if (rawItems.length > MAX_EQUIPMENT_PER_GROUP) return { error: `"${name}": אפשר עד ${MAX_EQUIPMENT_PER_GROUP} פריטים בקטגוריה.` };
    const items = [];
    for (const item of rawItems) {
      if (!item || typeof item !== 'object') return { error: `"${name}": אחד הפריטים לא תקין.` };
      if (item.id != null) {
        if (!/^[\w-]{1,40}$/.test(String(item.id))) return { error: `"${name}": אחד הפריטים לא תקין.` };
        items.push({ id: String(item.id) });
      } else if (item.file != null) {
        const index = Number(item.file);
        if (!Number.isInteger(index) || index < 0 || index >= files.length || usedFiles.has(index)) {
          return { error: `"${name}": אחד הקבצים חסר. נסו לבחור אותו שוב.` };
        }
        usedFiles.add(index);
        items.push({ file: index });
      } else if (item.url != null) {
        // A photo this profile already has, reused here. Checked against the
        // profile's own images when the save is applied.
        const url = String(item.url);
        if (!url || url.length > 1000) return { error: `"${name}": אחת התמונות שנבחרו לא תקינה.` };
        items.push({ url });
      } else if (item.link != null) {
        const link = normalizeVideoLink(String(item.link).trim());
        if (!link) return { error: `"${name}": אחד הקישורים ריק.` };
        if (link.error) return { error: `"${name}": ${link.error}` };
        items.push({ link });
      } else {
        return { error: `"${name}": אחד הפריטים לא תקין.` };
      }
    }
    total += items.length;
    groups.push({ id, name, items });
  }
  if (total > MAX_EQUIPMENT_ITEMS) return { error: `אפשר עד ${MAX_EQUIPMENT_ITEMS} פריטי ציוד בסך הכול (אחרי השינוי יהיו ${total}).` };
  for (const [i, file] of files.entries()) {
    if (!usedFiles.has(i)) continue;
    const isVideo = VIDEO_MIME.has(file.mimetype);
    if (!isVideo && file.size > MAX_IMAGE_BYTES) return { error: 'אחת מתמונות הציוד גדולה מדי — עד 5MB לתמונה.' };
    if (isVideo && file.size > MAX_VIDEO_BYTES) return { error: 'אחד מסרטוני הציוד גדול מדי — עד 45MB לסרטון.' };
  }
  return { groups };
}

// The stored equipment of a profile, always a clean list.
function equipmentOf(supplier) {
  if (!Array.isArray(supplier.equipment)) return [];
  return supplier.equipment
    .filter((g) => g && typeof g === 'object')
    .map((g) => ({ id: String(g.id), name: String(g.name || ''), items: Array.isArray(g.items) ? g.items : [] }));
}

// Every stored file address in the equipment section (links are only text).
function equipmentFiles(supplier) {
  return equipmentOf(supplier).flatMap((g) => g.items.filter((it) => it.kind === 'image' || it.kind === 'video').map((it) => it.url));
}

// Every photo the profile has anywhere — the ones a supplier may reuse
// elsewhere on the same profile without uploading them again.
function profileImages(supplier) {
  const urls = [
    ...(supplier.productImages || []).map((p) => p.file),
    supplier.backgroundImage,
    supplier.logo,
    ...equipmentOf(supplier).flatMap((g) => g.items.filter((it) => it.kind === 'image').map((it) => it.url)),
  ];
  return new Set(urls.filter(Boolean));
}

// Main-gallery photos picked from the profile's own images: each one must be
// the profile's, and not already among the photos that stay.
// Returns { added } or { error }.
function pickedPhotoPlan(supplier, picked, keep) {
  const own = profileImages(supplier);
  const inGallery = new Set(keep.map((p) => p.file));
  const added = [];
  for (const p of picked) {
    if (!own.has(p.url)) return { error: 'אחת התמונות שנבחרו לא שייכת לפרופיל הזה.' };
    if (inGallery.has(p.url)) return { error: 'אחת התמונות שנבחרו כבר נמצאת בתמונות שלכם.' };
    inGallery.add(p.url);
    added.push({ file: p.url, caption: p.caption });
  }
  return { added };
}

// Returns { error } or the cleaned values ready to store. The photo count is
// checked where the profile's current photos are known (see photoPlan).
function checkEdit(form, { requirePhone = false } = {}) {
  if (form.name !== null && !form.name) return { error: 'שם העסק הוא שדה חובה.' };
  if (form.name !== null && form.name.length > 80) return { error: 'שם העסק ארוך מדי.' };
  if (form.category !== null && !categoryById(form.category)) return { error: 'נא לבחור קטגוריה מהרשימה.' };
  if (form.city && !CITIES.includes(form.city)) return { error: 'נא לבחור עיר מהרשימה.' };
  if (form.description.length > 2000) return { error: 'התיאור ארוך מדי (עד 2000 תווים).' };
  if (form.contactEmail && (form.contactEmail.length > 120 || !EMAIL_RE.test(form.contactEmail))) {
    return { error: 'כתובת המייל אינה תקינה.' };
  }
  const phoneProblem = form.phone === null ? null : phoneError(form.phone, { required: requirePhone });
  if (phoneProblem) return { error: phoneProblem };
  if (form.logoFile && form.logoFile.size > MAX_LOGO_BYTES) return { error: 'הלוגו גדול מדי — עד 2MB.' };
  if (form.backgroundFile && form.backgroundFile.size > MAX_IMAGE_BYTES) return { error: 'תמונת הרקע גדולה מדי — עד 5MB.' };
  if (form.productFiles.some((file) => file.size > MAX_IMAGE_BYTES)) return { error: 'אחת התמונות גדולה מדי — עד 5MB לתמונה.' };
  if (form.videoFile && form.videoLink) return { error: 'יש לבחור סרטון להעלאה או להדביק קישור — לא את שניהם.' };
  const video = normalizeVideoLink(form.videoLink);
  if (video?.error) return { error: video.error };

  const captions = form.captions.map((c) => String(c ?? '').trim());
  if (captions.length !== form.productFiles.length) return { error: 'לכל תמונה חדשה צריך תיאור.' };
  if (captions.some((c) => !c)) return { error: 'לכל תמונה חדשה צריך תיאור.' };
  if (captions.some((c) => c.length > 200)) return { error: 'אחד מתיאורי התמונות ארוך מדי (עד 200 תווים).' };

  const removals = parseJsonArray(form.removePhotos, 'התמונות להסרה');
  if (removals.error) return { error: removals.error };
  if (removals.value.some((u) => typeof u !== 'string')) return { error: 'התמונות להסרה לא תקינות.' };

  const picks = parseJsonArray(form.pickedPhotos, 'התמונות שנבחרו');
  if (picks.error) return { error: picks.error };
  const pickedPhotos = [];
  for (const p of picks.value) {
    if (!p || typeof p !== 'object' || typeof p.url !== 'string' || !p.url || p.url.length > 1000) return { error: 'התמונות שנבחרו לא תקינות.' };
    const caption = String(p.caption ?? '').trim();
    if (!caption) return { error: 'לכל תמונה חדשה צריך תיאור.' };
    if (caption.length > 200) return { error: 'אחד מתיאורי התמונות ארוך מדי (עד 200 תווים).' };
    pickedPhotos.push({ url: p.url, caption });
  }

  const extras = parseExtras(form);
  if (extras.error) return { error: extras.error };
  const equipment = parseEquipment(form.equipment, form.equipmentFiles);
  if (equipment?.error) return { error: equipment.error };
  return {
    name: form.name, category: form.category, city: form.city,
    description: form.description, contactEmail: form.contactEmail, phone: form.phone,
    packages: extras.packages, socialLinks: extras.socialLinks,
    captions, removePhotos: new Set(removals.value), pickedPhotos,
    // A pasted link, already in the shape the profile stores; null when none.
    video, removeVideo: form.removeVideo,
    // null when the page did not send the section: it is then left as it is.
    equipment: equipment ? equipment.groups : null,
  };
}

// Which of the profile's photos stay, given the ones asked to be removed.
// Only the profile's own photos can be removed; anything else in the list is
// ignored. Returns { keep, removed, error } — error when the result would
// have too few or too many photos.
function photoPlan(current, removePhotos, addedCount) {
  const list = Array.isArray(current) ? current : [];
  const keep = list.filter((p) => !removePhotos.has(p.file));
  const removed = list.filter((p) => removePhotos.has(p.file));
  const total = keep.length + addedCount;
  if (total < MIN_PRODUCT_IMAGES) return { error: `צריך להשאיר לפחות ${MIN_PRODUCT_IMAGES} תמונות (אחרי השינוי יהיו ${total}).` };
  if (total > MAX_PRODUCT_IMAGES) return { error: `אפשר עד ${MAX_PRODUCT_IMAGES} תמונות (אחרי השינוי יהיו ${total}).` };
  return { keep, removed };
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

// Only http(s) addresses are ever kept, so a link can never run script.
// A bare "instagram.com/x" gets https:// added. Returns the address, or null.
function normalizeUrl(raw) {
  const value = String(raw ?? '').trim();
  if (!value || value.length > 300) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url;
  try { url = new URL(withScheme); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (!url.hostname.includes('.')) return null;
  return url.href;
}

function normalizeSocialLinks(raw) {
  const list = parseJsonArray(raw, 'הקישורים');
  if (list.error) return list;
  if (list.value.length > MAX_SOCIAL_LINKS) return { error: `אפשר להוסיף עד ${MAX_SOCIAL_LINKS} קישורים.` };

  const value = [];
  for (const [i, entry] of list.value.entries()) {
    const label = `קישור ${i + 1}`;
    if (!entry || typeof entry !== 'object') return { error: `${label}: הנתונים לא תקינים.` };

    const name = String(entry.label ?? '').trim();
    if (!name) return { error: `${label}: יש לתת שם לכפתור.` };
    if (name.length > 30) return { error: `${label}: השם ארוך מדי (עד 30 תווים).` };

    const url = normalizeUrl(entry.url);
    if (!url) return { error: `${label}: הכתובת אינה תקינה — היא צריכה להתחיל ב־http או https.` };

    value.push({ label: name, url });
  }
  return { value };
}

// A profile saved before link buttons existed has one free-text `links`
// string. It shows up as a button (or plain text when it is not an address),
// so nothing an existing supplier entered is lost.
function socialLinksOf(supplier) {
  if (Array.isArray(supplier.socialLinks)) return supplier.socialLinks;
  const legacy = String(supplier.links || '').trim();
  if (!legacy) return [];
  const url = normalizeUrl(legacy);
  return [url ? { label: 'קישור', url } : { label: legacy, url: null }];
}

// Everything the form sends as structured data, checked in one place.
function parseExtras(form) {
  const packages = normalizePackages(form.packages);
  if (packages.error) return { error: packages.error };
  const socialLinks = normalizeSocialLinks(form.socialLinks);
  if (socialLinks.error) return { error: socialLinks.error };
  return { packages: packages.value, socialLinks: socialLinks.value };
}

// Returns an error message for the form, or null when it's valid. The phone
// is required from suppliers signing up; an admin's demo profile may skip it.
function validateForm(form, { requirePhone = false } = {}) {
  if (!form.name) return 'שם העסק הוא שדה חובה.';
  if (form.name.length > 80) return 'שם העסק ארוך מדי.';
  if (!categoryById(form.category)) return 'נא לבחור קטגוריה מהרשימה.';
  if (form.city && !CITIES.includes(form.city)) return 'נא לבחור עיר מהרשימה.';
  const phoneProblem = phoneError(form.phone, { required: requirePhone });
  if (phoneProblem) return phoneProblem;
  if (form.description.length > 2000) return 'התיאור ארוך מדי (עד 2000 תווים).';
  if (form.productFiles.length < MIN_PRODUCT_IMAGES) {
    return `יש להעלות לפחות ${MIN_PRODUCT_IMAGES} תמונות מוצר (הועלו ${form.productFiles.length}).`;
  }
  if (!form.backgroundFile) return 'יש להעלות תמונת רקע לפרופיל.';
  const oversizedImage = [...form.productFiles, form.backgroundFile].find((file) => file && file.size > MAX_IMAGE_BYTES);
  if (oversizedImage) return 'אחת התמונות גדולה מדי — עד 5MB לתמונה.';
  if (form.logoFile && form.logoFile.size > MAX_LOGO_BYTES) return 'הלוגו גדול מדי — עד 2MB.';
  if (form.videoFile && form.videoLink) return 'יש לבחור סרטון להעלאה או להדביק קישור — לא את שניהם.';
  const normalizedLink = normalizeVideoLink(form.videoLink);
  if (normalizedLink?.error) return normalizedLink.error;
  return parseExtras(form).error || null;
}

// The admin "create profile" page still has the old single links box, so a
// value there becomes one button (or stays plain text when it is not an address).
function linkFields(form) {
  const socialLinks = parseExtras(form).socialLinks;
  if (socialLinks.length || !form.links) return { socialLinks, links: '' };
  const url = normalizeUrl(form.links);
  if (url) return { socialLinks: [{ label: 'קישור', url }], links: '' };
  // Not an address: keep the text where socialLinksOf will find it. An explicit
  // empty socialLinks list here would hide it.
  return { links: form.links };
}

// Uploads the photos and returns the new (demo) supplier record.
async function buildSupplier(form, { createdBy, source, ownerUserId = null }) {
  const id = crypto.randomUUID();
  const backgroundImage = await storage.saveImage(id, form.backgroundFile);
  const logo = form.logoFile ? await storage.saveImage(id, form.logoFile) : null;
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
    ...linkFields(form),
    packages: parseExtras(form).packages,
    logo,
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
  MIN_PRODUCT_IMAGES, MAX_PRODUCT_IMAGES, MAX_PACKAGES, MAX_SOCIAL_LINKS, MAX_LOGO_BYTES,
  MAX_EQUIPMENT_GROUPS, MAX_EQUIPMENT_NAME, MAX_EQUIPMENT_PER_GROUP, MAX_EQUIPMENT_ITEMS, VIDEO_MIME,
  parseForm, readForm, validateForm, buildSupplier, normalizeVideoLink,
  parseEditForm, readEditForm, checkEdit, photoPlan, phoneError, parseEquipment, equipmentOf, equipmentFiles,
  profileImages, pickedPhotoPlan,
  normalizePackages, normalizeSocialLinks, normalizeUrl, socialLinksOf,
};
