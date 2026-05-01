/**
 * CORS: ALLOWED_ORIGINS in strict/production; otherwise permissive for local demos.
 * Security headers suitable for API + static frontend.
 */
const safecoverEnv = require('../config/safecoverEnv');

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (safecoverEnv.isStrictMode()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
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
