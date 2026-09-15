// Tiny JSON-file "database". Fine for this admin tool's volume (a handful of
// writes per day) — no real DB server needed. All reads/writes go through
// this module so there's a single place that touches the file.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function empty() {
  return { suppliers: {}, magicTokens: {}, sessions: {} };
}

function load() {
  if (!fs.existsSync(DB_PATH)) return empty();
  try {
    return { ...empty(), ...JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) };
  } catch {
    return empty();
  }
}

function save(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// Serialize writes so two near-simultaneous requests can't clobber each other.
let queue = Promise.resolve();
function withDb(fn) {
  queue = queue.then(async () => {
    const db = load();
    const result = await fn(db);
    save(db);
    return result;
  });
  return queue;
}

module.exports = { load, withDb };
