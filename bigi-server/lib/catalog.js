// Which supplier profiles are live on the public site ("פעיל") and which are
// demos only admins can see ("דמו") — for both admin-created profiles and the
// sample suppliers that ship in bigi/data.js.

const { CONST_NAMES, SITE_DATA, SAMPLE_VENDORS, categoryById } = require('./siteData');

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
    .map((s) => ({
      key: s.id,
      kind: 'created',
      fromSupplier: s.source === 'supplier',
      name: s.name,
      categoryLabel: categoryById(s.category)?.name || s.category || '',
      city: s.city || '',
      createdAt: s.createdAt,
      createdBy: s.source === 'supplier' && db.users[s.ownerUserId]
        ? `${db.users[s.ownerUserId].name} (${db.users[s.ownerUserId].email})`
        : s.createdBy,
      published: Boolean(s.isPublic),
      featured: featuredRank.has(s.id),
      viewUrl: `/supplier/view/${s.id}`,
      image: s.backgroundImage,
    }));
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
    links: s.links || '',
    backgroundImage: s.backgroundImage,
    productImages: s.productImages,
    published: Boolean(s.isPublic),
    createdAt: s.createdAt,
    viewUrl: `/supplier/view/${s.id}`,
  };
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
  // Only admin-picked suppliers carry the "מומלץ" badge; other badges stay.
  const featuredFields = (key, otherBadge) => (rank.has(key)
    ? { badge: 'מומלץ', featuredRank: rank.get(key) }
    : { badge: otherBadge === 'מומלץ' ? null : otherBadge, featuredRank: null });

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

module.exports = { normalizePhone, adminRows, featuredRows, setFeatured, ownProfile, setPublished, dataJs };
