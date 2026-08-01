/**
 * Audit log — append-only structured log for security-critical operations.
 * Writes to data/audit.log (NDJSON). In production, pipe stdout to your SIEM.
 *
 * Logged events: BIND, CLAIM, TRIGGER, PARTNER_CREATE, AUTH_FAIL, RATE_LIMIT, FRAUD_BLOCK
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const AUDIT_PATH = path.join(DATA_DIR, 'audit.log');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Write an audit entry. Non-blocking (fire and forget).
 * @param {string} event - e.g. 'BIND', 'CLAIM', 'AUTH_FAIL'
 * @param {object} data - structured metadata
 */
function log(event, data = {}) {
  try {
    ensureDir();
    const entry = {
      ts: new Date().toISOString(),
      event,
      id: crypto.randomBytes(8).toString('hex'),
      ...data,
    };
    // Redact PII fields before writing
    if (entry.customer) {
      const email = entry.customer.email || '';
      entry.customer = {
        email_hash: email ? crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16) : null,
        email_domain: email.includes('@') ? email.split('@')[1] : null,
      };
    }
    fs.appendFile(AUDIT_PATH, JSON.stringify(entry) + '\n', () => {});
    // Also log to stdout for log aggregators (Datadog, CloudWatch, etc.)
    console.log('[AUDIT]', JSON.stringify(entry));
  } catch (e) {
    // Never throw from audit log — don't break the request
    console.error('[AUDIT ERROR]', e.message);
  }
}

function logBind(req, policy, fraudResult) {
  log('BIND', {
    policy_id: policy.policy_id,
    partner_id: req.partnerId,
    sandbox: req.partnerSandbox,
    scenario: policy.scenario,
    jurisdiction: policy.jurisdiction,
    premium: policy.premium,
    correlation_id: req.correlationId,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    fraud_decision: fraudResult?.decision,
    fraud_score: fraudResult?.score,
    customer: policy.customer,
  });
}

function logClaimFiled(req, claim) {
  log('CLAIM', {
    claim_id: claim.claim_id,
    policy_id: claim.policy_id,
    claim_type: claim.claim_type,
    amount: claim.amount,
    partner_id: req.partnerId,
    correlation_id: req.correlationId,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    customer: claim.customer,
  });
}

function logAuthFail(req, reason) {
  log('AUTH_FAIL', {
    reason,
    path: req.path,
    method: req.method,
    correlation_id: req.correlationId,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    partner_id_header: req.headers['x-partner-id'],
  });
}

function logFraudBlock(req, fraudResult, context) {
  log('FRAUD_BLOCK', {
    decision: fraudResult.decision,
    score: fraudResult.score,
    reasons: fraudResult.reasons,
    context,
    partner_id: req.partnerId,
    correlation_id: req.correlationId,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    customer: context?.customer,
  });
}

function logRateLimit(req, endpoint) {
  log('RATE_LIMIT', {
    endpoint,
    partner_id: req.partnerId,
    correlation_id: req.correlationId,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
  });
}

module.exports = { log, logBind, logClaimFiled, logAuthFail, logFraudBlock, logRateLimit };
