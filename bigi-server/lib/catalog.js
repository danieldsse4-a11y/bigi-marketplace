// Which supplier profiles are live on the public site ("פעיל") and which are
// demos only admins can see ("דמו") — for both admin-created profiles and the
// sample suppliers that ship in bigi/data.js.

const { CONST_NAMES, SITE_DATA, SAMPLE_VENDORS, categoryById } = require('./siteData');
const { socialLinksOf } = require('./supplierProfile');
const reviews = require('./reviews');

const SAMPLE_KEY_PREFIX = 'sample-';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('972') ? digits : '972' + digits.replace(/^0/, '');
}

// Sample suppliers are live unless an admin switched them to demo.
function isSamplePublished(db, sampleId) {
  return db.sampleVisibility[sampleId]?.published !== false;
}

/* ---------- "מומלצים": an ordered list of profile keys chosen by admins.
   Until an admin saves the list, it's the samples that shipped with the
   "מומלץ" badge, so the site looks the same as before. ---------- */
const MAX_FEATURED = 30;

function featuredKeys(db) {
  if (Array.isArray(db.featured)) return db.featured;
  return SAMPLE_VENDORS.filter((v) => v.badge === 'מומלץ').map((v) => SAMPLE_KEY_PREFIX + v.id);
}

function profileExists(db, key) {
  if (key.startsWith(SAMPLE_KEY_PREFIX)) {
    return SAMPLE_VENDORS.some((v) => SAMPLE_KEY_PREFIX + v.id === key);
  }
  return Boolean(db.suppliers[key]);
}

/* ---------- Badges an admin can set per profile. "מומלץ" is not one of them:
   it belongs to the מומלצים list above and always wins. An empty string means
   the admin chose no badge at all; no entry means "leave it to the default". */
const BADGE_CHOICES = ['', 'חדש', 'זמין השבוע'];

function badgeOverride(db, key) {
  const map = db.badges;
  return map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
}

// Returns an error message, or null after saving.
function setBadge(db, key, badge, adminEmail) {
  if (typeof key !== 'string' || !profileExists(db, key)) return 'הפרופיל לא נמצא';
  if (badge !== null && !BADGE_CHOICES.includes(badge)) return 'תג לא תקין';
  if (!db.badges || typeof db.badges !== 'object') db.badges = {};
  // null clears the override and goes back to the default badge.
  if (badge === null) delete db.badges[key];
  else db.badges[key] = badge;
  db.badgesUpdated = { at: new Date().toISOString(), by: adminEmail };
  return null;
}

// Returns an error message, or null after saving the new order.
function setFeatured(db, keys, adminEmail) {
  if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string')) return 'רשימה לא תקינה';
  const unique = [...new Set(keys)];
  if (unique.length > MAX_FEATURED) return `אפשר לסמן עד ${MAX_FEATURED} ספקים מומלצים`;
  if (unique.some((k) => !profileExists(db, k))) return 'אחד הפרופילים לא נמצא';
  db.featured = unique;
  db.featuredUpdated = { at: new Date().toISOString(), by: adminEmail };
  return null;
}

function adminRows(db) {
  const featuredRank = new Map(featuredKeys(db).map((k, i) => [k, i]));
  const rows = Object.values(db.suppliers)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((s) => {
      const owner = (s.ownerUserId && db.users[s.ownerUserId]) || null;
      return {
        key: s.id,
        kind: 'created',
        fromSupplier: s.source === 'supplier',
        // The account that can edit this profile — none, for one an admin
        // created and never attached to anybody.
        ownerEmail: owner ? owner.email : '',
        ownerName: owner ? owner.name : '',
        name: s.name,
        categoryLabel: categoryById(s.category)?.name || s.category || '',
        city: s.city || '',
        createdAt: s.createdAt,
        createdBy: s.source === 'supplier' && owner ? `${owner.name} (${owner.email})` : s.createdBy,
        published: Boolean(s.isPublic),
        featured: featuredRank.has(s.id),
        badge: badgeOverride(db, s.id),
        defaultBadge: 'חדש',
        viewUrl: `/supplier/view/${s.id}`,
        image: s.backgroundImage,
      };
    });
  const fromSuppliers = rows.filter((r) => r.fromSupplier);
  const created = rows.filter((r) => !r.fromSupplier);

  const samples = SAMPLE_VENDORS.map((v) => ({
    key: SAMPLE_KEY_PREFIX + v.id,
    kind: 'sample',
    name: v.name,
    categoryLabel: categoryById(v.cat)?.name || '',
    city: v.city,
    published: isSamplePublished(db, v.id),
    featured: featuredRank.has(SAMPLE_KEY_PREFIX + v.id),
    badge: badgeOverride(db, SAMPLE_KEY_PREFIX + v.id),
    defaultBadge: v.badge === 'מומלץ' ? '' : (v.badge || ''),
    viewUrl: `/vendor.html?id=${v.id}`,
    emoji: v.emoji,
    grad: v.grad,
  }));

  return { fromSuppliers, created, samples };
}

// For the admin "מומלצים" page: the chosen profiles in order, then the rest.
function featuredRows(db) {
  const { fromSuppliers, created, samples } = adminRows(db);
  const byKey = new Map([...fromSuppliers, ...created, ...samples].map((r) => [r.key, r]));
  const keys = featuredKeys(db).filter((k) => byKey.has(k));
  const chosen = new Set(keys);
  return {
    featured: keys.map((k) => byKey.get(k)),
    others: [...byKey.values()].filter((r) => !chosen.has(r.key)),
  };
}

// A supplier's own profile, as shown in their dashboard.
function ownProfile(db, userId) {
  const s = Object.values(db.suppliers).find((x) => x.ownerUserId === userId);
  if (!s) return null;
  return {
    id: s.id,
    name: s.name,
    categoryLabel: categoryById(s.category)?.name || s.category || '',
    city: s.city || '',
    description: s.description || '',
    phone: s.phone || '',
    contactEmail: s.contactEmail || '',
    socialLinks: socialLinksOf(s),
    packages: s.packages || [],
    logo: s.logo || null,
    backgroundImage: s.backgroundImage,
    productImages: s.productImages,
    video: s.video || null,
    published: Boolean(s.isPublic),
    createdAt: s.createdAt,
    viewUrl: `/supplier/view/${s.id}`,
  };
}

/* ---------- Who owns a profile.
   A profile submitted through "הצטרפות כספק" belongs to the account that sent
   it. One created in the admin area belongs to nobody, so no account can edit
   it — attaching an account here is what gives that account the edit button,
   the dashboard card and /edit-profile.html.

   Attaching changes nothing else about the profile: a published profile stays
   published, and nothing needs re-approving. ---------- */

// Finds the account by address the way sign-in does, so case and spaces don't
// matter. An empty address means "no owner". Returns { error }, or
// { ownerUserId, owner } where both are null for an empty address.
// `exceptProfileId` is the profile being assigned, so re-saving the same owner
// on the same profile isn't mistaken for a second profile.
function lookupOwner(db, rawEmail, exceptProfileId) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return { ownerUserId: null, owner: null };

  const user = Object.values(db.users).find((u) => u.email === email);
  if (!user) {
    return { error: `אין חשבון עם הכתובת ${email}. בעל העסק צריך להירשם לאתר, ואז אפשר לשייך אליו את הפרופיל.` };
  }

  // The same rule as sign-up: one account, one profile.
  const taken = Object.values(db.suppliers).find((s) => s.ownerUserId === user.id && s.id !== exceptProfileId);
  if (taken) {
    return { error: `לחשבון הזה כבר יש פרופיל ("${taken.name}"). לכל חשבון יכול להיות פרופיל אחד בלבד.` };
  }

  return { ownerUserId: user.id, owner: { name: user.name, email: user.email } };
}

// Returns { error }, { owner } or { detached: true }.
function setOwner(db, key, rawEmail, adminEmail) {
  const supplier = db.suppliers[key];
  if (!supplier) return { error: 'הפרופיל לא נמצא. אפשר לשייך בעלים רק לפרופיל אמיתי, לא לספק לדוגמה.' };

  const found = lookupOwner(db, rawEmail, supplier.id);
  if (found.error) return { error: found.error };
  if (!found.ownerUserId && !supplier.ownerUserId) return { error: 'לפרופיל הזה אין בעלים, אז אין מה לנתק.' };

  supplier.ownerUserId = found.ownerUserId;
  supplier.ownerSetBy = { at: new Date().toISOString(), by: adminEmail || '' };
  return found.owner ? { owner: found.owner } : { detached: true };
}

// Removes a profile an admin (or a supplier) created, and takes it out of the
// "מומלצים" list. Returns the deleted profile so its photos can be cleaned up,
// or null when the key doesn't match one. Sample suppliers live in the site's
// own data file and can only be switched to demo, never deleted.
function deleteProfile(db, key) {
  const supplier = db.suppliers[key];
  if (!supplier) return null;
  delete db.suppliers[key];
  if (Array.isArray(db.featured)) db.featured = db.featured.filter((k) => k !== key);
  reviews.removeForSupplier(db, key);
  return supplier;
}

// Returns false when the key doesn't match any profile.
function setPublished(db, key, published, adminEmail) {
  const stamp = { at: new Date().toISOString(), by: adminEmail };

  if (key.startsWith(SAMPLE_KEY_PREFIX)) {
    const sampleId = Number(key.slice(SAMPLE_KEY_PREFIX.length));
    if (!SAMPLE_VENDORS.some((v) => v.id === sampleId)) return false;
    db.sampleVisibility[sampleId] = { published, ...stamp };
    return true;
  }

  const supplier = db.suppliers[key];
  if (!supplier) return false;
  supplier.isPublic = published;
  supplier.unlisted = !published;
  if (published) {
    supplier.publishedAt = stamp.at;
    supplier.publishedBy = stamp.by;
  } else {
    supplier.unpublishedAt = stamp.at;
    supplier.unpublishedBy = stamp.by;
  }
  return true;
}

// The supplier list visitors get. Admins also get demo samples (flagged
// `hidden`) so sample profile pages still open for them; public lists skip those.
function publicVendors(db, { isAdmin }) {
  const rank = new Map(featuredKeys(db).map((k, i) => [k, i]));
  // Only admin-picked suppliers carry the "מומלץ" badge. Below that an admin's
  // own choice wins, and only then the badge the profile would get by default.
  const featuredFields = (key, otherBadge) => {
    if (rank.has(key)) return { badge: 'מומלץ', featuredRank: rank.get(key) };
    const chosen = badgeOverride(db, key);
    const badge = chosen === undefined ? otherBadge : chosen;
    return { badge: badge && badge !== 'מומלץ' ? badge : null, featuredRank: null };
  };

  const samples = SAMPLE_VENDORS.flatMap((v) => {
    const vendor = { ...v, ...featuredFields(SAMPLE_KEY_PREFIX + v.id, v.badge) };
    if (isSamplePublished(db, v.id)) return [vendor];
    return isAdmin ? [{ ...vendor, hidden: true }] : [];
  });

  const live = Object.values(db.suppliers)
    .filter((s) => s.isPublic)
    .sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)))
    .map((s) => {
      const cat = categoryById(s.category);
      return {
        id: s.id,
        name: s.name,
        cat: cat ? cat.id : null,
        city: s.city || '',
        rating: null,
        reviews: 0,
        priceFrom: null,
        ...featuredFields(s.id, 'חדש'),
        tag: cat ? cat.name : (s.category || ''),
        grad: cat ? cat.grad : 'g1',
        emoji: cat ? cat.icon : '⭐',
        phone: normalizePhone(s.phone),
        image: s.backgroundImage,
        url: `/supplier/view/${s.id}`,
      };
    });

  return [...samples, ...live];
}

function dataJs(db, { isAdmin }) {
  const values = { ...SITE_DATA, VENDORS: publicVendors(db, { isAdmin }) };
  return CONST_NAMES.map((name) => `const ${name} = ${JSON.stringify(values[name])};`).join('\n') + '\n';
}

module.exports = { normalizePhone, adminRows, featuredRows, setFeatured, setBadge, BADGE_CHOICES, ownProfile, lookupOwner, setOwner, setPublished, deleteProfile, dataJs };
