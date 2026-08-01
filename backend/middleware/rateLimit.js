/**
 * In-memory rate limiter with composite partner+IP keys.
 *
 * Security hardening (Sprint 1A):
 *  - getClientIp() honours X-Forwarded-For (trusted via app.set('trust proxy')).
 *  - Composite key: ${partnerId}:${ip} — limits both dimensions simultaneously.
 *  - Retry-After header on 429 responses.
 *  - Secondary global-endpoint limits to block DoS via many distinct partner keys.
 *  - Cleanup interval every 5 minutes removes expired entries to prevent memory leaks.
 */

const limits = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute

// Per-partner+IP limits (existing behaviour, tightened)
const QUOTE_LIMIT = 100;
const BIND_LIMIT = 50;
const POS_LIMIT = 80;

// Global per-endpoint limits (across ALL partners) — DoS backstop
const GLOBAL_QUOTE_LIMIT = 500;
const GLOBAL_BIND_LIMIT = 200;
const GLOBAL_POS_LIMIT = 300;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the real client IP.
 * Express must have app.set('trust proxy', true/1) configured for
 * req.headers['x-forwarded-for'] to be safe to read.
 */
function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Check and increment a rate-limit bucket.
 * Returns { allowed: boolean, retryAfterSec: number }.
 */
function checkLimit(windowKey, limit) {
  const now = Date.now();
  let window = limits.get(windowKey);

  if (!window || now > window.resetAt) {
    window = { count: 0, resetAt: now + WINDOW_MS };
  }

  window.count += 1;
  limits.set(windowKey, window);

  const allowed = window.count <= limit;
  const retryAfterSec = allowed ? 0 : Math.ceil((window.resetAt - now) / 1000);
  return { allowed, retryAfterSec };
}

/**
 * Apply two rate-limit checks (partner+IP composite, then global endpoint).
 * Returns { allowed: boolean, retryAfterSec: number } — the most-constrained result.
 */
function applyLimits(req, endpoint, partnerLimit, globalLimit) {
  const ip = getClientIp(req);
  const partnerId = req.partnerId || 'anonymous';

  const compositeKey = `${endpoint}:${partnerId}:${ip}`;
  const globalKey = `${endpoint}:__global__`;

  const partnerResult = checkLimit(compositeKey, partnerLimit);
  const globalResult = checkLimit(globalKey, globalLimit);

  // If either limit is breached, report the longer retry wait.
  if (!partnerResult.allowed || !globalResult.allowed) {
    const retryAfterSec = Math.max(
      partnerResult.retryAfterSec,
      globalResult.retryAfterSec
    );
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true, retryAfterSec: 0 };
}

// ─── Middleware ──────────────────────────────────────────────────────────────

function rateLimitQuote(req, res, next) {
  const { allowed, retryAfterSec } = applyLimits(req, 'quote', QUOTE_LIMIT, GLOBAL_QUOTE_LIMIT);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    console.log('[RATE_LIMIT]', 'quote', req.partnerId || 'anonymous', getClientIp(req), 'retry_after=' + retryAfterSec);
    return res.status(429).json({
      error: 'Too many quote requests',
      code: 'RATE_LIMIT',
      retryAfterSeconds: retryAfterSec,
    });
  }
  next();
}

function rateLimitBind(req, res, next) {
  const { allowed, retryAfterSec } = applyLimits(req, 'bind', BIND_LIMIT, GLOBAL_BIND_LIMIT);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    console.log('[RATE_LIMIT]', 'bind', req.partnerId || 'anonymous', getClientIp(req), 'retry_after=' + retryAfterSec);
    return res.status(429).json({
      error: 'Too many bind requests',
      code: 'RATE_LIMIT',
      retryAfterSeconds: retryAfterSec,
    });
  }
  next();
}

function rateLimitPos(req, res, next) {
  const { allowed, retryAfterSec } = applyLimits(req, 'pos', POS_LIMIT, GLOBAL_POS_LIMIT);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfterSec));
    console.log('[RATE_LIMIT]', 'pos', req.partnerId || 'anonymous', getClientIp(req), 'retry_after=' + retryAfterSec);
    return res.status(429).json({
      error: 'Too many POS requests',
      code: 'RATE_LIMIT',
      retryAfterSeconds: retryAfterSec,
    });
  }
  next();
}

// ─── Memory leak prevention ──────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, window] of limits.entries()) {
    if (window.resetAt < now) {
      limits.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS);

// Don't hold the event loop open if the server shuts down cleanly.
if (cleanupTimer.unref) cleanupTimer.unref();

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = { rateLimitQuote, rateLimitBind, rateLimitPos, getClientIp };
