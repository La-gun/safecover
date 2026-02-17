/**
 * Insurer adapter - forwards bound policies to insurer systems
 * Configure INSURER_WEBHOOK_URL to forward to real insurer
 */
const https = require('https');
const http = require('http');

const INSURER_WEBHOOK = process.env.INSURER_WEBHOOK_URL;

function forwardToInsurer(policy) {
  if (!INSURER_WEBHOOK) {
    console.log('[Insurer] No webhook configured, skipping forward. Policy:', policy.policy_id);
    return Promise.resolve({ forwarded: false });
  }

  return new Promise((resolve) => {
    const url = new URL(INSURER_WEBHOOK);
    const payload = JSON.stringify({
      event: 'policy.bound',
      policy_id: policy.policy_id,
      provider_id: policy.provider_id,
      plan_id: policy.plan_id,
      premium: policy.premium,
      coverage: policy.coverage_details,
      transaction_id: policy.transaction_id,
      customer: policy.customer,
      recorded_at: policy.recorded_at,
    });

    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      },
      (res) => {
        let body = '';
        res.on('data', (ch) => (body += ch));
        res.on('end', () => {
          console.log('[Insurer] Forwarded policy', policy.policy_id, 'status:', res.statusCode);
          resolve({ forwarded: true, status: res.statusCode });
        });
      }
    );
    req.on('error', (e) => {
      console.error('[Insurer] Forward error:', e.message);
      resolve({ forwarded: false, error: e.message });
    });
    req.write(payload);
    req.end();
  });
}

module.exports = { forwardToInsurer };
