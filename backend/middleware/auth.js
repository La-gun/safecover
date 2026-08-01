/**
 * API key authentication — strict/production requires valid keys (see config/safecoverEnv.js).
 *
 * Security hardening (Sprint 1A):
 *  - Removed hardcoded 'demo' literal; demo key only allowed if API_KEY_DEMO is explicitly set
 *    AND we are NOT in strict/production mode.
 *  - API_AUTH_DISABLED is rejected in strict/production mode with a critical log.
 *  - Sandbox flag (req.partnerSandbox) set based on key prefix: sk_test_ = sandbox, sk_live_ = production.
 *  - X-Correlation-Id passthrough: uses incoming header or generates a UUID.
 *  - Exports generateCorrelationId helper.
 *
 * Security hardening (Sprint 1B):
 *  - req.isAdmin is set ONLY when the raw credential constant-time-matches ADMIN_API_KEY.
 *    It is never derived from the client-supplied X-Partner-Id header — that header is
 *    caller-controlled and must not grant privilege. If ADMIN_API_KEY is unset, no request
 *    is ever treated as admin (fail closed).
 */
const crypto = require('crypto');
const safecoverEnv = require('../config/safecoverEnv');
const { validateApiKey } = require('../services/partners');

function generateCorrelationId() {
  return crypto.randomUUID();
}

/**
 * Determine whether a key belongs to the sandbox tier.
 * Keys prefixed with sk_test_ are sandbox; sk_live_ are production.
 * Keys from the legacy API_KEY env var are treated as production unless prefixed.
 */
function isSandboxKey(key) {
  if (!key) return false;
  if (key.startsWith('sk_test_')) return true;
  if (key.startsWith('sk_live_')) return false;
  // Legacy keys with no recognized prefix — treat as production (non-sandbox)
  return false;
}

/**
 * Constant-time check of a raw credential against ADMIN_API_KEY.
 * Never derive admin status from client-supplied headers (e.g. X-Partner-Id) —
 * only from a verified secret the server itself issued.
 */
function isAdminKey(rawKey) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey || !rawKey) return false;
  const a = Buffer.from(String(rawKey));
  const b = Buffer.from(String(adminKey));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Build the set of statically-configured valid keys at startup.
 * The literal string 'demo' is NEVER added — only process.env.API_KEY_DEMO
 * if set AND not in strict mode.
 */
function buildValidKeys() {
  const strict = safecoverEnv.isStrictMode();
  const keys = [];

  if (process.env.API_KEY) {
    keys.push(process.env.API_KEY);
  }

  if (process.env.API_KEY_DEMO && !strict) {
    keys.push(process.env.API_KEY_DEMO);
  } else if (process.env.API_KEY_DEMO && strict) {
    console.warn(
      '[SafeCover auth] API_KEY_DEMO is set but will NOT be accepted in strict/production mode.'
    );
  }

  return new Set(keys.filter(Boolean));
}

const VALID_KEYS = buildValidKeys();
const REQUIRE_AUTH = safecoverEnv.isAuthRequired();

function authMiddleware(req, res, next) {
  const strict = safecoverEnv.isStrictMode();

  // Attach correlation ID early — needed for all responses including 401/403.
  const incoming = req.headers['x-correlation-id'];
  req.correlationId =
    incoming && typeof incoming === 'string' && incoming.length <= 128
      ? incoming.trim()
      : generateCorrelationId();
  res.setHeader('X-Correlation-Id', req.correlationId);

  // API_AUTH_DISABLED is forbidden in strict/production mode.
  if (process.env.API_AUTH_DISABLED === 'true') {
    if (strict) {
      console.error(
        '[SafeCover auth] CRITICAL: API_AUTH_DISABLED=true is set but strict/production mode is active. ' +
          'Auth bypass rejected. Remove API_AUTH_DISABLED from your environment.'
      );
      return res.status(500).json({
        error: 'Server misconfiguration: auth bypass is not permitted in production',
        code: 'SERVER_MISCONFIGURATION',
      });
    }
    // Non-strict (dev/demo) — allow bypass with a warning logged once per process.
    if (!authMiddleware._bypassWarned) {
      console.warn(
        '[SafeCover auth] WARNING: API_AUTH_DISABLED=true — all requests are unauthenticated. ' +
          'This must NEVER be set in production.'
      );
      authMiddleware._bypassWarned = true;
    }
    req.partnerId = req.headers['x-partner-id'] || 'anonymous';
    req.partnerSandbox = true; // Force sandbox in bypass mode
    req.isAdmin = false; // Bypass mode never grants admin — set ADMIN_API_KEY and use a real key for admin actions.
    return next();
  }

  const rawKey =
    req.headers['x-api-key'] ||
    (req.headers['authorization']
      ? req.headers['authorization'].replace(/^Bearer\s+/i, '')
      : undefined);

  const partnerId = req.headers['x-partner-id'] || 'anonymous';

  // If auth is not required (dev mode, no API_KEY set, no strict mode) — allow through.
  if (!REQUIRE_AUTH) {
    req.partnerId = partnerId;
    req.apiKey = rawKey || 'anonymous';
    req.partnerSandbox = rawKey ? isSandboxKey(rawKey) : true;
    req.isAdmin = isAdminKey(rawKey);
    return next();
  }

  // Reject missing key before any lookup.
  if (!rawKey) {
    console.log('[AUTH_FAIL]', req.correlationId || '', 'MISSING_KEY', req.method, req.path, req.headers['x-partner-id'] || 'no-partner');
    return res.status(401).json({ error: 'Missing API key', code: 'UNAUTHORIZED' });
  }

  // Check static key set (env-configured keys).
  if (VALID_KEYS.has(rawKey)) {
    req.partnerId = partnerId;
    req.apiKey = rawKey;
    req.partnerSandbox = isSandboxKey(rawKey);
    // Admin is granted ONLY by matching ADMIN_API_KEY, never by the caller-supplied
    // X-Partner-Id header — a shared API_KEY must not let any holder self-declare 'admin'.
    req.isAdmin = isAdminKey(rawKey);
    return next();
  }

  // Check partner DB / in-memory store (hashed lookup).
  const partner = validateApiKey(rawKey);
  if (partner) {
    req.partnerId = partner.id;
    req.apiKey = rawKey;
    // Partner record from DB/store carries the definitive sandbox flag;
    // fall back to key prefix if not present.
    req.partnerSandbox =
      typeof partner.sandbox === 'boolean' ? partner.sandbox : isSandboxKey(rawKey);
    // Self-service partner keys are never admin, regardless of ADMIN_API_KEY (a distinct secret).
    req.isAdmin = false;
    return next();
  }

  console.log('[AUTH_FAIL]', req.correlationId || '', 'INVALID_KEY', req.method, req.path, req.headers['x-partner-id'] || 'no-partner');
  return res.status(401).json({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
}

authMiddleware._bypassWarned = false;

module.exports = { authMiddleware, generateCorrelationId };
