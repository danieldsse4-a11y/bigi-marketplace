// Tiny JSON "database", kept in memory and persisted through lib/storage.js
// (Supabase Storage in production, a local file in development).
//
// Only one server instance runs, so memory is the source of truth while it's
// up; the stored copy is what survives restarts. If storage can't be reached,
// reads fall back to an empty db and writes are refused — writing an empty db
// over the real one would wipe every profile.

const storage = require('./storage');

function empty() {
  return { suppliers: {}, magicTokens: {}, sessions: {}, sampleVisibility: {} };
}

let cache = empty();
let ready = false;
let loading = null;

async function init() {
  if (ready) return;
  if (!loading) {
    loading = (async () => {
      await storage.ensureBuckets();
      const text = await storage.readDb();
      cache = { ...empty(), ...(text ? JSON.parse(text) : {}) };
      ready = true;
    })().finally(() => { loading = null; });
  }
  return loading;
}

function isReady() {
  return ready;
}

function load() {
  return cache;
}

function pruneExpired(db) {
  const now = Date.now();
  for (const [token, entry] of Object.entries(db.magicTokens)) {
    if (entry.used || entry.expiresAt < now) delete db.magicTokens[token];
  }
  for (const [id, session] of Object.entries(db.sessions)) {
    if (session.expiresAt < now) delete db.sessions[id];
  }
}

// Serialize writes so two near-simultaneous requests can't clobber each other.
let queue = Promise.resolve();
function withDb(fn) {
  const run = queue.then(async () => {
    await init();
    const draft = structuredClone(cache);
    const result = await fn(draft);
    pruneExpired(draft);
    await storage.writeDb(JSON.stringify(draft, null, 2));
    cache = draft;
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

module.exports = { init, isReady, load, withDb };
