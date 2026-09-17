// Whitelist + magic-link + session handling for the hidden admin area.
//
// Security model:
//  - Only the emails in ADMIN_EMAILS may ever get a session.
//  - The whitelist is re-checked on EVERY request via requireAdmin, not just
//    at login — so removing an email from .env immediately revokes access
//    for anyone still holding an old session cookie.
//  - Sessions and one-time magic-link tokens are stored server-side (in the
//    JSON db), not just trusted from a signed cookie — the cookie only ever
//    carries an opaque random id.

const crypto = require('crypto');
const { load, withDb } = require('./db');

const SESSION_COOKIE = 'bigi_admin_session';
const MAGIC_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getWhitelist() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isWhitelisted(email) {
  if (!email) return false;
  return getWhitelist().includes(String(email).trim().toLowerCase());
}

async function createMagicToken(email) {
  const token = crypto.randomBytes(32).toString('hex');
  await withDb((db) => {
    db.magicTokens[token] = {
      email: email.trim().toLowerCase(),
      expiresAt: Date.now() + MAGIC_TOKEN_TTL_MS,
      used: false,
    };
  });
  return token;
}

// Returns the email on success, or null if the token is missing/expired/used.
async function consumeMagicToken(token) {
  return withDb((db) => {
    const entry = db.magicTokens[token];
    if (!entry) return null;
    if (entry.used || Date.now() > entry.expiresAt) return null;
    entry.used = true;
    return entry.email;
  });
}

async function createSession(email) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  await withDb((db) => {
    db.sessions[sessionId] = {
      email: email.trim().toLowerCase(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
  });
  return sessionId;
}

async function destroySession(sessionId) {
  await withDb((db) => {
    delete db.sessions[sessionId];
  });
}

// The admin email behind this request's session cookie, or null. Checks the
// session is live AND the email is still whitelisted right now.
function adminEmailFor(req) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const session = sessionId ? load().sessions[sessionId] : null;
  if (!session || Date.now() > session.expiresAt || !isWhitelisted(session.email)) return null;
  return session.email;
}

// Middleware: attaches req.adminEmail for a valid admin; anything else is
// sent to the login page (or gets a 401 for JSON requests), no exceptions.
function requireAdmin(req, res, next) {
  const email = adminEmailFor(req);
  if (!email) {
    res.clearCookie(SESSION_COOKIE);
    if (req.is('application/json') || !req.accepts('html')) return res.status(401).json({ error: 'לא מורשה' });
    return res.redirect('/admin-suppliers/login');
  }
  req.adminEmail = email;
  next();
}

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  getWhitelist,
  isWhitelisted,
  createMagicToken,
  consumeMagicToken,
  createSession,
  destroySession,
  adminEmailFor,
  requireAdmin,
};
