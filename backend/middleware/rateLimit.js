/**
 * Simple in-memory rate limiter
 */
const limits = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const QUOTE_LIMIT = 100;
const BIND_LIMIT = 50;

function getKey(req) {
  return req.partnerId || req.ip || req.headers['x-forwarded-for'] || 'default';
}

function checkLimit(key, windowKey, limit) {
  const now = Date.now();
  const window = limits.get(windowKey) || { count: 0, resetAt: now + WINDOW_MS };
  if (now > window.resetAt) {
    window.count = 0;
    window.resetAt = now + WINDOW_MS;
  }
  window.count++;
  limits.set(windowKey, window);
  return window.count <= limit;
}

function rateLimitQuote(req, res, next) {
  const key = getKey(req);
  if (!checkLimit(key, `quote:${key}`, QUOTE_LIMIT)) {
    return res.status(429).json({ error: 'Too many quote requests', code: 'RATE_LIMIT' });
  }
  next();
}

function rateLimitBind(req, res, next) {
  const key = getKey(req);
  if (!checkLimit(key, `bind:${key}`, BIND_LIMIT)) {
    return res.status(429).json({ error: 'Too many bind requests', code: 'RATE_LIMIT' });
  }
  next();
}

module.exports = { rateLimitQuote, rateLimitBind };
