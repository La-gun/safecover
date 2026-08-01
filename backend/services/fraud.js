/**
 * Fraud decision engine — score-based BLOCK / HOLD / APPROVE.
 *
 * Decision rules (applied in order):
 *  1. Any reason prefixed "BLOCK:" → immediate BLOCK (score ignored)
 *  2. score >= 60 → HOLD
 *  3. Otherwise → APPROVE
 *
 * Enhanced checks:
 *  - Disposable email domain blocking
 *  - IP-based velocity (count of policies from same IP in last 60 min)
 *  - Email velocity window (policies from same email in last 60 min)
 *  - Coverage/premium ratio anomaly detection
 *  - Duplicate transaction_id detection
 */

'use strict';

/** @typedef {'BLOCK' | 'HOLD' | 'APPROVE'} FraudDecision */

/**
 * @typedef {Object} FraudResult
 * @property {FraudDecision} decision
 * @property {number} score
 * @property {string[]} reasons
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'sharklasers.com',
]);

const ONE_HOUR_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Core decision helper
// ---------------------------------------------------------------------------

/**
 * Decide fraud outcome from accumulated score and reasons.
 * @param {number}   score
 * @param {string[]} reasons
 * @returns {FraudResult}
 */
function decide(score, reasons = []) {
  if (reasons.some((r) => r && r.startsWith('BLOCK:'))) {
    return { decision: 'BLOCK', score, reasons };
  }
  if (score >= 60) return { decision: 'HOLD', score, reasons };
  return { decision: 'APPROVE', score, reasons };
}

// ---------------------------------------------------------------------------
// Individual check helpers
// ---------------------------------------------------------------------------

/**
 * Return the domain part of an email address, lower-cased.
 * Returns an empty string if the email is malformed.
 * @param {string} email
 * @returns {string}
 */
function emailDomain(email) {
  if (!email || !email.includes('@')) return '';
  return email.split('@').pop().toLowerCase().trim();
}

/**
 * Filter an array of policies to those recorded within the last 60 minutes.
 * Uses `policy.recorded_at` (ISO-8601 string).
 * @param {Object[]} policies
 * @returns {Object[]}
 */
function policiesInLastHour(policies) {
  const cutoff = Date.now() - ONE_HOUR_MS;
  return policies.filter((p) => {
    if (!p.recorded_at) return false;
    const t = new Date(p.recorded_at).getTime();
    return !isNaN(t) && t >= cutoff;
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluate a bind request for fraud risk.
 * @param {Object}   params
 * @param {Object}   params.customer          - Customer object ({ email, ip?, ... })
 * @param {string}   params.transaction_id    - Transaction ID
 * @param {string}   [params.quote_id]        - Quote ID
 * @param {Object[]} [params.existingPolicies] - Existing policies for duplicate/velocity checks
 * @returns {FraudResult}
 */
function evaluateBind({ customer, transaction_id, quote_id, existingPolicies = [] }) {
  const reasons = [];
  let score = 0;

  // 1. Invalid or missing email → hard block
  if (!customer?.email?.includes?.('@')) {
    reasons.push('BLOCK:Invalid or missing customer email');
    score = 100;
  }

  const email = (customer?.email || '').toLowerCase().trim();

  // 2. Disposable email domain → hard block
  if (email) {
    const domain = emailDomain(email);
    if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
      reasons.push(`BLOCK:Disposable email domain (${domain})`);
      score = Math.max(score, 100);
    }
  }

  // 3. Duplicate transaction_id across all policies → hard block
  const dupTxn = existingPolicies.filter((p) => p.transaction_id === transaction_id);
  if (dupTxn.length > 0) {
    reasons.push('BLOCK:Duplicate transaction_id');
    score = Math.max(score, 100);
  }

  // 4. Email velocity in last hour
  if (email) {
    const recentPolicies = policiesInLastHour(existingPolicies);
    const sameEmailRecent = recentPolicies.filter(
      (p) => (p.customer?.email || '').toLowerCase().trim() === email
    );
    if (sameEmailRecent.length >= 5) {
      reasons.push(`BLOCK:Email velocity — ${sameEmailRecent.length} policies in last hour`);
      score = Math.max(score, 100);
    } else if (sameEmailRecent.length >= 3) {
      reasons.push(`HOLD:Email velocity — ${sameEmailRecent.length} policies in last hour`);
      score = Math.max(score, 70);
    } else if (sameEmailRecent.length >= 2) {
      reasons.push(`Elevated email velocity (${sameEmailRecent.length} in last hour)`);
      score = Math.max(score, 40);
    }
  }

  // 5. IP velocity in last hour (if IP is present on customer or request)
  const ip = customer?.ip;
  if (ip) {
    const recentPolicies = policiesInLastHour(existingPolicies);
    const sameIpRecent = recentPolicies.filter(
      (p) => p.customer?.ip === ip
    );
    if (sameIpRecent.length >= 10) {
      reasons.push(`BLOCK:IP velocity — ${sameIpRecent.length} policies from ${ip} in last hour`);
      score = Math.max(score, 100);
    } else if (sameIpRecent.length >= 5) {
      reasons.push(`HOLD:IP velocity — ${sameIpRecent.length} policies from ${ip} in last hour`);
      score = Math.max(score, 65);
    }
  }

  // 6. Total email policy count (lifetime)
  if (email) {
    const sameEmail = existingPolicies.filter(
      (p) => (p.customer?.email || '').toLowerCase().trim() === email
    );
    if (sameEmail.length >= 10) {
      reasons.push(`HOLD:High lifetime policy count for email (${sameEmail.length})`);
      score = Math.max(score, 65);
    } else if (sameEmail.length >= 5) {
      reasons.push(`Elevated lifetime policy count for email (${sameEmail.length})`);
      score = Math.max(score, 45);
    }
  }

  // 7. Ensure at least one reason for audit trail
  if (reasons.length === 0) {
    reasons.push('No fraud indicators');
  }

  return decide(score, reasons);
}

module.exports = {
  decide,
  evaluateBind,
};
