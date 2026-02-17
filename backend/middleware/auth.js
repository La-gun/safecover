/**
 * API key authentication - optional for demo
 * Set API_KEY env to require auth; otherwise demo key or no key accepted
 */
const REQUIRE_AUTH = !!process.env.API_KEY;
const VALID_KEYS = new Set([
  process.env.API_KEY,
  process.env.API_KEY_DEMO || 'demo',
  'demo',
].filter(Boolean));

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

  res.status(401).json({ error: 'Invalid or missing API key', code: 'UNAUTHORIZED' });
}

module.exports = { authMiddleware };
