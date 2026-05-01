/**
 * API key authentication — strict/production requires valid keys (see config/safecoverEnv.js).
 */
const safecoverEnv = require('../config/safecoverEnv');
const REQUIRE_AUTH = safecoverEnv.isAuthRequired();
const VALID_KEYS = new Set([
  process.env.API_KEY,
  process.env.API_KEY_DEMO || 'demo',
  'demo',
].filter(Boolean));

const { validateApiKey } = require('../services/partners');

function authMiddleware(req, res, next) {
  if (process.env.API_AUTH_DISABLED === 'true') {
    req.partnerId = req.headers['x-partner-id'] || 'anonymous';
    return next();
  }

  const key = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const partnerId = req.headers['x-partner-id'] || 'anonymous';

  if (!REQUIRE_AUTH) {
    req.partnerId = partnerId;
    req.apiKey = key || 'anonymous';
    return next();
  }

  if (key && VALID_KEYS.has(key)) {
    req.partnerId = partnerId;
    req.apiKey = key;
    return next();
  }

  const partner = validateApiKey(key);
  if (partner) {
    req.partnerId = partner.id;
    req.apiKey = key;
    return next();
  }

  res.status(401).json({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
}

module.exports = { authMiddleware };
