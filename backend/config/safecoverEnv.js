/**
 * Central production / strict-mode flags and validated config.
 * Strict mode aligns with NODE_ENV=production unless SAFECOVER_STRICT overrides.
 */

function envBool(name, defaultVal = false) {
  const v = process.env[name];
  if (v == null || v === '') return defaultVal;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function isStrictMode() {
  if (envBool('SAFECOVER_STRICT', false)) return true;
  if (String(process.env.SAFECOVER_STRICT || '').toLowerCase() === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

/** Require API key validation (no anonymous demo traffic). */
function isAuthRequired() {
  if (envBool('API_AUTH_DISABLED', false)) return false;
  if (envBool('SAFECOVER_INSECURE_AUTH', false)) return false;
  return isStrictMode() || !!process.env.API_KEY;
}

function quoteTtlMs() {
  const min = parseInt(process.env.QUOTE_TTL_MINUTES || '30', 10);
  const safe = Number.isFinite(min) && min > 0 && min <= 24 * 60 ? min : 30;
  return safe * 60 * 1000;
}

/** Max(abs) or relative tolerance for premium match at bind. */
function premiumTolerance(expected) {
  const e = Number(expected) || 0;
  return Math.max(0.01, e * 0.005);
}

function getAllowedOrigins() {
  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getQuoteSigningSecret() {
  const s = process.env.QUOTE_SIGNING_SECRET;
  if (isStrictMode() && !s) {
    throw new Error('QUOTE_SIGNING_SECRET is required when SAFECOVER_STRICT=true or NODE_ENV=production');
  }
  return s || 'dev-insecure-quote-secret-change-me';
}

function getWebhookSecret() {
  return process.env.WEBHOOK_SECRET || '';
}

function shouldRequireWebhookSignature() {
  if (envBool('WEBHOOK_REQUIRE_SIGNATURE', false)) return true;
  return isStrictMode() && !!getWebhookSecret();
}

/**
 * Log critical misconfiguration. Optionally exit (SAFECOVER_FAIL_ON_CONFIG=1).
 */
function validateStartupConfig() {
  const strict = isStrictMode();
  const issues = [];
  if (strict) {
    if (!process.env.API_KEY) issues.push('API_KEY must be set in strict/production mode');
    try {
      getQuoteSigningSecret();
    } catch (e) {
      issues.push(e.message);
    }
    if (!getAllowedOrigins().length) issues.push('ALLOWED_ORIGINS should list trusted browser origins (comma-separated)');
    if (!getWebhookSecret() && shouldRequireWebhookSignature()) issues.push('WEBHOOK_SECRET required when signatures are enforced');
  }
  issues.forEach((m) => console.error('[SafeCover config]', m));
  if (issues.length && envBool('SAFECOVER_FAIL_ON_CONFIG', false)) {
    console.error('[SafeCover] Exiting due to SAFECOVER_FAIL_ON_CONFIG=1');
    process.exit(1);
  }
  return { strict, issues };
}

module.exports = {
  envBool,
  isStrictMode,
  isAuthRequired,
  quoteTtlMs,
  premiumTolerance,
  getAllowedOrigins,
  getQuoteSigningSecret,
  getWebhookSecret,
  shouldRequireWebhookSignature,
  validateStartupConfig,
};
