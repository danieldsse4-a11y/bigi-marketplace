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

function adminRows(db) {
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
    viewUrl: `/vendor.html?id=${v.id}`,
    emoji: v.emoji,
    grad: v.grad,
  }));

  return { fromSuppliers, created, samples };
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
  const samples = SAMPLE_VENDORS.flatMap((v) => {
    if (isSamplePublished(db, v.id)) return [v];
    return isAdmin ? [{ ...v, hidden: true }] : [];
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
        badge: 'חדש',
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

module.exports = { normalizePhone, adminRows, ownProfile, setPublished, dataJs };
