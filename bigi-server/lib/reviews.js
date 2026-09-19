// Customer reviews of supplier profiles. Everything here works on the db object
// that db.withDb() hands out, so a change is saved (or not) as one unit.
//
// Rules: any logged-in customer can review a published profile once; they can
// change or delete their own review. Suppliers cannot review. Admins can delete
// any review. Text is stored as typed and escaped where it is shown.

const crypto = require('crypto');
const { CITIES } = require('./siteData');

const MAX_TEXT = 1000;
const MAX_SERVICE = 80;
// The four things a customer scores, each 1–10. The overall score is their average.
const SCORES = [
  { key: 'quality', label: 'איכות' },
  { key: 'price', label: 'מחיר' },
  { key: 'timing', label: 'זמנים' },
  { key: 'attitude', label: 'יחס' },
];
const oneDecimal = (n) => Math.round(n * 10) / 10;

// A review as it is shown. A review written before the four scores existed
// has one 1–5 star rating: it shows as rating × 2 for every score. The
// stored data is never rewritten.
function view(r) {
  const scores = r.scores && typeof r.scores === 'object'
    ? Object.fromEntries(SCORES.map(({ key }) => [key, Number(r.scores[key]) || 0]))
    : Object.fromEntries(SCORES.map(({ key }) => [key, (Number(r.rating) || 0) * 2]));
  const overall = oneDecimal(SCORES.reduce((sum, { key }) => sum + scores[key], 0) / SCORES.length);
  return { ...r, scores, overall, service: r.service || '', city: r.city || '', text: r.text || '' };
}

function all(db) {
  if (!db.reviews || typeof db.reviews !== 'object') db.reviews = {};
  return db.reviews;
}

// Newest first. Reads the reviewer's name from the review itself (a snapshot
// taken when they wrote it), never the email.
function reviewsFor(db, supplierId) {
  return Object.values(db.reviews || {})
    .filter((r) => r.supplierId === supplierId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(view);
}

// The average overall score out of 10, one decimal.
function summarize(list) {
  if (!list.length) return { count: 0, average: null };
  const sum = list.reduce((total, r) => total + view(r).overall, 0);
  return { count: list.length, average: oneDecimal(sum / list.length) };
}

function findOwn(db, supplierId, userId) {
  return Object.values(db.reviews || {}).find((r) => r.supplierId === supplierId && r.userId === userId) || null;
}

// Creates or updates the customer's one review of this profile.
// Returns { error } or { review, created }.
function saveReview(db, { supplierId, user, scores, service, city, text }) {
  if (!user || user.role !== 'customer') return { error: 'רק חשבון לקוח יכול לכתוב ביקורת.', code: 'forbidden' };
  const supplier = db.suppliers[supplierId];
  if (!supplier || !supplier.isPublic) return { error: 'אפשר לכתוב ביקורת רק על פרופיל שפורסם באתר.', code: 'missing' };
  // An admin can own a profile while their account role is still customer.
  if (supplier.ownerUserId && supplier.ownerUserId === user.id) {
    return { error: 'אי אפשר לכתוב ביקורת על הפרופיל שלכם.', code: 'forbidden' };
  }

  const given = scores && typeof scores === 'object' ? scores : {};
  const clean = {};
  for (const { key, label } of SCORES) {
    const n = Number(given[key]);
    if (!Number.isInteger(n) || n < 1 || n > 10) return { error: `יש לתת ציון בין 1 ל־10 ל${label}.`, code: 'invalid' };
    clean[key] = n;
  }
  const serviceText = String(service ?? '').trim();
  if (!serviceText) return { error: 'יש לכתוב איזה שירות קיבלתם.', code: 'invalid' };
  if (serviceText.length > MAX_SERVICE) return { error: `תיאור השירות ארוך מדי (עד ${MAX_SERVICE} תווים).`, code: 'invalid' };
  const cityText = String(city ?? '').trim();
  if (cityText && !CITIES.includes(cityText)) return { error: 'נא לבחור עיר מהרשימה.', code: 'invalid' };
  const body = String(text ?? '').trim();
  if (!body) return { error: 'יש לכתוב חוות דעת.', code: 'invalid' };
  if (body.length > MAX_TEXT) return { error: `חוות הדעת ארוכה מדי (עד ${MAX_TEXT} תווים).`, code: 'invalid' };

  const now = new Date().toISOString();
  const existing = findOwn(db, supplierId, user.id);
  if (existing) {
    // An older review becomes a scored one once its author saves it again.
    delete existing.rating;
    Object.assign(existing, { scores: clean, service: serviceText, city: cityText, text: body, name: user.name, updatedAt: now });
    return { review: existing, created: false };
  }
  const review = {
    id: crypto.randomUUID(), supplierId, userId: user.id, name: user.name,
    scores: clean, service: serviceText, city: cityText, text: body, createdAt: now, updatedAt: now,
  };
  all(db)[review.id] = review;
  return { review, created: true };
}

function deleteOwn(db, supplierId, userId) {
  const review = findOwn(db, supplierId, userId);
  if (!review) return false;
  delete db.reviews[review.id];
  return true;
}

// Admin moderation. Returns the removed review, or null.
function deleteReview(db, reviewId) {
  const review = db.reviews && db.reviews[reviewId];
  if (!review) return null;
  delete db.reviews[reviewId];
  return review;
}

// Called when a profile or an account is deleted, so no review outlives them.
function removeForSupplier(db, supplierId) {
  let removed = 0;
  for (const [id, r] of Object.entries(db.reviews || {})) {
    if (r.supplierId === supplierId) { delete db.reviews[id]; removed++; }
  }
  return removed;
}

function removeForUser(db, userId) {
  let removed = 0;
  for (const [id, r] of Object.entries(db.reviews || {})) {
    if (r.userId === userId) { delete db.reviews[id]; removed++; }
  }
  return removed;
}

// For the admin page: every review with the profile it belongs to and the
// reviewer's email (admins only), newest first.
function adminRows(db) {
  return Object.values(db.reviews || {})
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map(view)
    .map((r) => ({
      id: r.id,
      supplierId: r.supplierId,
      supplierName: db.suppliers[r.supplierId]?.name || '(פרופיל שנמחק)',
      reviewerName: r.name,
      reviewerEmail: db.users[r.userId]?.email || '',
      scores: r.scores,
      overall: r.overall,
      service: r.service,
      city: r.city,
      text: r.text,
      createdAt: r.createdAt,
    }));
}

module.exports = {
  MAX_TEXT, MAX_SERVICE, SCORES, view, reviewsFor, summarize, findOwn, saveReview, deleteOwn, deleteReview,
  removeForSupplier, removeForUser, adminRows,
};
