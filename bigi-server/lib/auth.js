// Accounts, sessions and admin rights.
//
// Security model:
//  - Passwords are stored as scrypt hashes, never in plain text.
//  - The session cookie only carries an opaque random id; sessions live
//    server-side in the stored db.
//  - Admin rights = the account's email is in ADMIN_EMAILS *and* the owner of
//    that inbox clicked a one-time confirmation link. Without the link, anyone
//    who signed up first with an admin email would become an admin.
//  - The whitelist is re-checked on every request, so removing an email from
//    ADMIN_EMAILS revokes access immediately.

const crypto = require('crypto');
const { promisify } = require('util');
const { load, withDb } = require('./db');

const scrypt = promisify(crypto.scrypt);

const SESSION_COOKIE = 'bigi_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_VERIFY_TTL_MS = 60 * 60 * 1000;
const ROLES = ['customer', 'supplier'];

function getWhitelist() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isWhitelisted(email) {
  return Boolean(email) && getWhitelist().includes(normalizeEmail(email));
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

const DUMMY_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;

async function passwordMatches(password, stored) {
  const [saltHex, hashHex] = String(stored || DUMMY_HASH).split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return stored ? crypto.timingSafeEqual(expected, actual) : false;
}

function findUserByEmail(db, email) {
  const wanted = normalizeEmail(email);
  return Object.values(db.users).find((u) => u.email === wanted) || null;
}

function isAdminUser(user) {
  return Boolean(user && user.adminVerifiedAt && isWhitelisted(user.email));
}

// What the browser is allowed to know about the signed-in account.
function publicUser(user) {
  if (!user) return null;
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: isAdminUser(user),
    adminPending: isWhitelisted(user.email) && !user.adminVerifiedAt,
  };
}

async function createUser({ name, email, password, role }) {
  const passwordHash = await hashPassword(password);
  return withDb((db) => {
    if (findUserByEmail(db, email)) return null;
    const user = {
      id: crypto.randomUUID(),
      name,
      email: normalizeEmail(email),
      role,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    db.users[user.id] = user;
    return user;
  });
}

// Returns the user for correct credentials, otherwise null (same answer for
// "no such email" and "wrong password").
async function authenticate(email, password) {
  const user = findUserByEmail(load(), email);
  const ok = await passwordMatches(password, user?.passwordHash);
  return ok ? user : null;
}

async function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  await withDb((db) => {
    db.sessions[sessionId] = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
  });
  return sessionId;
}

async function destroySession(sessionId) {
  await withDb((db) => {
    delete db.sessions[sessionId];
  });
}

function setSessionCookie(res, sessionId, secure) {
  res.cookie(SESSION_COOKIE, sessionId, { httpOnly: true, sameSite: 'lax', secure, maxAge: SESSION_TTL_MS });
}

function currentUser(req) {
  const sessionId = req.cookies?.[SESSION_COOKIE];
  const db = load();
  const session = sessionId ? db.sessions[sessionId] : null;
  if (!session || !session.userId || Date.now() > session.expiresAt) return null;
  return db.users[session.userId] || null;
}

function wantsJson(req) {
  return req.path.startsWith('/api/') || req.is('application/json') || !req.accepts('html');
}

function requireUser(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'יש להתחבר קודם' });
  req.user = user;
  next();
}

// Non-admins get the login page (logged out) or a plain "not found" (logged
// in) — the admin area is never advertised to regular accounts.
function requireAdmin(req, res, next) {
  const user = currentUser(req);
  if (isAdminUser(user)) {
    req.user = user;
    req.adminEmail = user.email;
    return next();
  }
  if (wantsJson(req)) return res.status(user ? 403 : 401).json({ error: 'לא מורשה' });
  if (!user) return res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`);
  res.status(404).send('הדף לא נמצא.');
}

async function createAdminVerifyToken(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await withDb((db) => {
    db.magicTokens[token] = { userId, purpose: 'admin-verify', expiresAt: Date.now() + ADMIN_VERIFY_TTL_MS, used: false };
  });
  return token;
}

// Marks the account as a confirmed admin. Returns the user, or null if the
// token is missing, used, expired, or the email is no longer whitelisted.
async function consumeAdminVerifyToken(token) {
  return withDb((db) => {
    const entry = db.magicTokens[token];
    if (!entry || entry.purpose !== 'admin-verify') return null;
    const user = db.users[entry.userId];
    if (!user || !isWhitelisted(user.email)) return null;
    // Email scanners sometimes open links before the person does; a second
    // click on an already-used link should still say "done".
    if (entry.used) return user.adminVerifiedAt ? user : null;
    if (Date.now() > entry.expiresAt) return null;
    entry.used = true;
    user.adminVerifiedAt = user.adminVerifiedAt || new Date().toISOString();
    return user;
  });
}

module.exports = {
  ROLES,
  SESSION_COOKIE,
  getWhitelist,
  isWhitelisted,
  normalizeEmail,
  publicUser,
  createUser,
  authenticate,
  createSession,
  destroySession,
  setSessionCookie,
  currentUser,
  isAdminUser,
  requireUser,
  requireAdmin,
  createAdminVerifyToken,
  consumeAdminVerifyToken,
};
