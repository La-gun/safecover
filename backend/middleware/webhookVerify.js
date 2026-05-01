/**
 * HMAC-SHA256 verification for webhook raw body (hex digest in X-SafeCover-Signature).
 */
const crypto = require('crypto');
const safecoverEnv = require('../config/safecoverEnv');

function timingEqualHex(hexA, hexB) {
  try {
    const ba = Buffer.from(String(hexA), 'hex');
    const bb = Buffer.from(String(hexB), 'hex');
    if (ba.length !== bb.length || ba.length === 0) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function computeSignature(secret, rawBuffer) {
  return crypto.createHmac('sha256', secret).update(rawBuffer).digest('hex');
}

/**
 * Express middleware: expects req.body as Buffer (use express.raw on route).
 * Sets req.webhookJson to parsed object on success.
 */
function webhookVerifyMiddleware(req, res, next) {
  const requireSig = safecoverEnv.shouldRequireWebhookSignature();
  const secret = safecoverEnv.getWebhookSecret();
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '', 'utf8');

  if (requireSig) {
    if (!secret) {
      return res.status(500).json({ error: 'Webhook signing not configured', code: 'WEBHOOK_MISCONFIGURED' });
    }
    const sigHeader = req.get('X-SafeCover-Signature') || req.get('x-safecover-signature') || '';
    const expected = computeSignature(secret, buf);
    if (!sigHeader || !timingEqualHex(sigHeader, expected)) {
      return res.status(401).json({ error: 'Invalid webhook signature', code: 'WEBHOOK_SIGNATURE_INVALID' });
    }
  }

  let json;
  try {
    json = JSON.parse(buf.toString('utf8') || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body', code: 'INVALID_JSON' });
  }
  req.webhookJson = json;
  next();
}

module.exports = { webhookVerifyMiddleware, computeSignature };
