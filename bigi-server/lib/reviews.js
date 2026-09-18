// Customer reviews of supplier profiles. Everything here works on the db object
// that db.withDb() hands out, so a change is saved (or not) as one unit.
//
// Rules: any logged-in customer can review a published profile once; they can
// change or delete their own review. Suppliers cannot review. Admins can delete
// any review. Text is stored as typed and escaped where it is shown.

const crypto = require('crypto');

const MAX_TEXT = 1000;

function all(db) {
  if (!db.reviews || typeof db.reviews !== 'object') db.reviews = {};
  return db.reviews;
}

// Newest first. Reads the reviewer's name from the review itself (a snapshot
// taken when they wrote it), never the email.
function reviewsFor(db, supplierId) {
  return Object.values(db.reviews || {})
    .filter((r) => r.supplierId === supplierId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function summarize(list) {
  if (!list.length) return { count: 0, average: null };
  const sum = list.reduce((total, r) => total + r.rating, 0);
  return { count: list.length, average: Math.round((sum / list.length) * 10) / 10 };
}

function findOwn(db, supplierId, userId) {
  return Object.values(db.reviews || {}).find((r) => r.supplierId === supplierId && r.userId === userId) || null;
}

// Creates or updates the customer's one review of this profile.
// Returns { error } or { review, created }.
function saveReview(db, { supplierId, user, rating, text }) {
  if (!user || user.role !== 'customer') return { error: 'רק חשבון לקוח יכול לכתוב ביקורת.', code: 'forbidden' };
  const supplier = db.suppliers[supplierId];
  if (!supplier || !supplier.isPublic) return { error: 'אפשר לכתוב ביקורת רק על פרופיל שפורסם באתר.', code: 'missing' };
  // An admin can own a profile while their account role is still customer.
  if (supplier.ownerUserId && supplier.ownerUserId === user.id) {
    return { error: 'אי אפשר לכתוב ביקורת על הפרופיל שלכם.', code: 'forbidden' };
  }

  const stars = Number(rating);
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { error: 'יש לבחור דירוג בין 1 ל־5 כוכבים.', code: 'invalid' };
  const body = String(text ?? '').trim();
  if (body.length > MAX_TEXT) return { error: `הביקורת ארוכה מדי (עד ${MAX_TEXT} תווים).`, code: 'invalid' };

  const now = new Date().toISOString();
  const existing = findOwn(db, supplierId, user.id);
  if (existing) {
    existing.rating = stars;
    existing.text = body;
    existing.name = user.name;
    existing.updatedAt = now;
    return { review: existing, created: false };
  }
  const review = {
    id: crypto.randomUUID(), supplierId, userId: user.id, name: user.name,
    rating: stars, text: body, createdAt: now, updatedAt: now,
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
    .map((r) => ({
      id: r.id,
      supplierId: r.supplierId,
      supplierName: db.suppliers[r.supplierId]?.name || '(פרופיל שנמחק)',
      reviewerName: r.name,
      reviewerEmail: db.users[r.userId]?.email || '',
      rating: r.rating,
      text: r.text,
      createdAt: r.createdAt,
    }));
}

module.exports = {
  MAX_TEXT, reviewsFor, summarize, findOwn, saveReview, deleteOwn, deleteReview,
  removeForSupplier, removeForUser, adminRows,
};
