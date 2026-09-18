// Where the admin data (db.json) and uploaded supplier photos are kept.
//  - Supabase Storage when SUPABASE_URL + SUPABASE_SECRET_KEY are set (production:
//    survives restarts/redeploys, unlike Render's free-plan disk).
//  - Local disk (data/db.json + uploads/) otherwise, for development.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);

const DATA_BUCKET = 'bigi-data';          // private — sessions and admin data live here
const IMAGES_BUCKET = 'supplier-images';  // public — photos are shown on profile pages
const DB_OBJECT = 'db.json';

const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const LOCAL_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

let supabase = null;
if (USE_SUPABASE) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureBuckets() {
  if (!USE_SUPABASE) return;
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`Supabase listBuckets failed: ${error.message}`);
  const existing = new Set(data.map((b) => b.name));
  const wanted = [
    [DATA_BUCKET, { public: false }],
    [IMAGES_BUCKET, { public: true, fileSizeLimit: '5MB', allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] }],
  ];
  for (const [name, options] of wanted) {
    if (existing.has(name)) continue;
    const { error: createError } = await supabase.storage.createBucket(name, options);
    if (createError) throw new Error(`Supabase createBucket(${name}) failed: ${createError.message}`);
  }
}

// Returns the stored JSON text, or null when nothing has been saved yet.
// Throws when storage can't be reached — callers must not treat that as "empty".
async function readDb() {
  if (!USE_SUPABASE) {
    return fs.existsSync(LOCAL_DB_PATH) ? fs.readFileSync(LOCAL_DB_PATH, 'utf8') : null;
  }
  const { data: files, error: listError } = await supabase.storage.from(DATA_BUCKET).list('', { search: DB_OBJECT });
  if (listError) throw new Error(`Supabase list failed: ${listError.message}`);
  if (!files.some((f) => f.name === DB_OBJECT)) return null;

  const { data, error } = await supabase.storage.from(DATA_BUCKET).download(DB_OBJECT, {}, { cache: 'no-store' });
  if (error) throw new Error(`Supabase download failed: ${error.message}`);
  return data.text();
}

async function writeDb(json) {
  if (!USE_SUPABASE) {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, json);
    return;
  }
  const { error } = await supabase.storage.from(DATA_BUCKET).upload(DB_OBJECT, Buffer.from(json, 'utf8'), {
    contentType: 'application/json',
    upsert: true,
    cacheControl: '0',
  });
  if (error) throw new Error(`Supabase upload of ${DB_OBJECT} failed: ${error.message}`);
}

const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// Saves one uploaded photo and returns the URL to show it with.
async function saveImage(supplierId, file) {
  const name = crypto.randomBytes(8).toString('hex') + (EXT_BY_MIME[file.mimetype] || '.jpg');

  if (!USE_SUPABASE) {
    const dir = path.join(LOCAL_UPLOADS_DIR, 'suppliers', supplierId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), file.buffer);
    return `/uploads/suppliers/${supplierId}/${name}`;
  }

  const objectPath = `suppliers/${supplierId}/${name}`;
  const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(objectPath, file.buffer, {
    contentType: file.mimetype,
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`Supabase image upload failed: ${error.message}`);
  return supabase.storage.from(IMAGES_BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

// Removes every photo belonging to one supplier. Returns how many were
// deleted. Never throws: the profile is already gone from the database by the
// time this runs, and leftover files must not turn that into an error.
async function deleteSupplierImages(supplierId) {
  try {
    if (!USE_SUPABASE) {
      const dir = path.join(LOCAL_UPLOADS_DIR, 'suppliers', supplierId);
      if (!fs.existsSync(dir)) return 0;
      const count = fs.readdirSync(dir).length;
      fs.rmSync(dir, { recursive: true, force: true });
      return count;
    }
    const prefix = `suppliers/${supplierId}`;
    const { data, error } = await supabase.storage.from(IMAGES_BUCKET).list(prefix, { limit: 100 });
    if (error) throw new Error(error.message);
    if (!data.length) return 0;
    const { error: removeError } = await supabase.storage
      .from(IMAGES_BUCKET)
      .remove(data.map((f) => `${prefix}/${f.name}`));
    if (removeError) throw new Error(removeError.message);
    return data.length;
  } catch (err) {
    console.error(`Could not delete photos for supplier ${supplierId}:`, err.message);
    return 0;
  }
}

module.exports = {
  USE_SUPABASE,
  LOCAL_UPLOADS_DIR,
  ensureBuckets,
  readDb,
  writeDb,
  saveImage,
  deleteSupplierImages,
};
