/**
 * Insurer adapter — forwards bound policies and claims to insurer systems.
 *
 * Security properties:
 *  - HMAC-SHA256 request signing via X-SafeCover-Signature header
 *  - Bearer token authorization via INSURER_API_KEY
 *  - Partner isolation via X-SafeCover-Partner-Id header
 *  - Correlation ID propagation via X-Correlation-Id header
 *  - HTTP blocked in production (HTTPS enforced)
 *  - 10-second request timeout
 *  - Up to 3 attempts with exponential backoff on network errors or 5xx responses
 */

'use strict';

const https = require('https');
const crypto = require('crypto');

const INSURER_WEBHOOK = process.env.INSURER_WEBHOOK_URL;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSigningSecret() {
  return process.env.INSURER_SIGNING_SECRET || process.env.WEBHOOK_SECRET || '';
}

function signPayload(payloadStr) {
  const secret = getSigningSecret();
  if (!secret) return 'sha256=unsigned';
  const hex = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
  return `sha256=${hex}`;
}

function generateCorrelationId() {
  return `sc_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function buildHeaders(payloadStr, partnerId, correlationId) {
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payloadStr),
    'X-SafeCover-Signature': signPayload(payloadStr),
    'X-SafeCover-Partner-Id': partnerId || 'unknown',
    'X-Correlation-Id': correlationId,
    'User-Agent': 'SafeCover-Insurer-Adapter/1.0',
  };
  const apiKey = process.env.INSURER_API_KEY;
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  return headers;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function attemptPost(url, payloadStr, headers) {
  return new Promise((resolve, reject) => {
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
      return reject(new Error('HTTPS required for insurer webhook in production'));
    }

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers,
      timeout: 10000,
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode >= 500) {
          return reject(new Error(`Insurer returned ${res.statusCode}: ${body.slice(0, 200)}`));
        }
        resolve({ status: res.statusCode, body });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Insurer webhook request timed out after 10s'));
    });

    req.on('error', (e) => reject(e));

    req.write(payloadStr);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function forwardToInsurer(policy) {
  if (!INSURER_WEBHOOK) {
    console.log('[Insurer] No webhook configured, skipping forward. Policy:', policy.policy_id);
    return { forwarded: false };
  }

  let url;
  try {
    url = new URL(INSURER_WEBHOOK);
  } catch (e) {
    console.error('[Insurer] Invalid INSURER_WEBHOOK_URL:', e.message);
    return { forwarded: false, error: 'Invalid webhook URL' };
  }

  const correlationId = generateCorrelationId();
  const partnerId = policy.partner_id || 'unknown';

  const payloadStr = JSON.stringify({
    event: 'policy.bound',
    policy_id: policy.policy_id,
    provider_id: policy.provider_id,
    plan_id: policy.plan_id,
    premium: policy.premium,
    coverage: policy.coverage_details,
    transaction_id: policy.transaction_id,
    customer: policy.customer,
    recorded_at: policy.recorded_at,
    jurisdiction: policy.jurisdiction,
    regulatory_snapshot: policy.regulatory_snapshot,
    status: policy.status,
    correlation_id: correlationId,
  });

  const headers = buildHeaders(payloadStr, partnerId, correlationId);

  const MAX_ATTEMPTS = 3;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await attemptPost(url, payloadStr, headers);
      console.log(
        `[Insurer] Forwarded policy ${policy.policy_id} — status: ${result.status}, correlationId: ${correlationId}`
      );
      return { forwarded: true, status: result.status, correlationId };
    } catch (e) {
      lastError = e;
      console.warn(
        `[Insurer] Attempt ${attempt}/${MAX_ATTEMPTS} failed for policy ${policy.policy_id}: ${e.message}`
      );
      if (attempt < MAX_ATTEMPTS) {
        await sleep(200 * Math.pow(2, attempt - 1));
      }
    }
  }

  console.error(
    `[Insurer] All ${MAX_ATTEMPTS} attempts failed for policy ${policy.policy_id}: ${lastError?.message}`
  );
  return { forwarded: false, error: lastError?.message };
}

module.exports = { forwardToInsurer };
