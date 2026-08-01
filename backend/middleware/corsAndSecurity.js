/**
 * CORS: ALLOWED_ORIGINS in strict/production; otherwise permissive for local demos.
 * Security headers suitable for API + static frontend.
 *
 * Security hardening (Sprint 1A):
 *  - Content-Security-Policy: strict for /api/ routes; relaxed for HTML demo pages.
 *  - HSTS applied for all HTTPS connections (not only strict mode).
 *  - X-Permitted-Cross-Domain-Policies: none added.
 *  - Cross-Origin-Resource-Policy: same-site on API routes.
 *  - Cross-Origin-Opener-Policy: same-origin on API routes.
 */
const safecoverEnv = require('../config/safecoverEnv');

// Strict CSP for API routes — no inline scripts, no external resources.
const STRICT_CSP =
  "default-src 'none'; " +
  "script-src 'self'; " +
  "connect-src 'self'; " +
  "img-src 'self' data: https://images.unsplash.com; " +
  "style-src 'self' 'unsafe-inline'; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'";

// Relaxed CSP for static HTML demo files — allows inline scripts and broader connectivity
// for the checkout widget demos that embed third-party partner UIs.
const RELAXED_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
  "connect-src 'self' *; " +
  "img-src 'self' data: https: blob:; " +
  "style-src 'self' 'unsafe-inline' https:; " +
  "font-src 'self' https: data:; " +
  "frame-ancestors 'none'; " +
  "base-uri 'self'";

function securityHeaders(req, res, next) {
  const isApiRoute = req.path.startsWith('/api/');
  const isHttps =
    req.secure || req.headers['x-forwarded-proto'] === 'https';

  // Universal headers — applied to all routes.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // HSTS — applied whenever the connection is HTTPS (not just strict mode).
  if (isHttps) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // CSP — strict for API routes; relaxed for static demo HTML.
  res.setHeader('Content-Security-Policy', isApiRoute ? STRICT_CSP : RELAXED_CSP);

  // Additional isolation headers for API routes only.
  if (isApiRoute) {
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }

  next();
}

function corsMiddleware(req, res, next) {
  const allowed = safecoverEnv.getAllowedOrigins();
  const origin = req.get('Origin');
  const strict = safecoverEnv.isStrictMode();

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-API-Key, X-Partner-Id, Authorization, X-Correlation-Id, X-Bind-Idempotency-Key, X-SafeCover-Signature'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (allowed.length > 0) {
    if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else if (!strict && !origin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  } else if (strict) {
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
}

module.exports = { securityHeaders, corsMiddleware };
