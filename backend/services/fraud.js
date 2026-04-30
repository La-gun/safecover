/**
 * Fraud decision engine - score-based block/hold/approve
 * Decision logic: BLOCK if any reason starts with "BLOCK:", HOLD if score >= 60, else APPROVE
 */

/** @typedef {'BLOCK' | 'HOLD' | 'APPROVE'} FraudDecision */

/**
 * @typedef {Object} FraudResult
 * @property {FraudDecision} decision
 * @property {number} score
 * @property {string[]} reasons
 */

/**
 * Decide fraud outcome from score and reasons.
 * @param {number} score - Fraud risk score (0-100)
 * @param {string[]} reasons - List of risk reasons; any starting with "BLOCK:" forces BLOCK
 * @returns {FraudResult}
 */
function decide(score, reasons = []) {
  if (reasons.some((r) => r && r.startsWith('BLOCK:'))) return { decision: 'BLOCK', score, reasons };
  if (score >= 60) return { decision: 'HOLD', score, reasons };
  return { decision: 'APPROVE', score, reasons };
}

/**
 * Evaluate a bind request for fraud risk.
 * Returns score, reasons, and final decision.
 * @param {Object} params
 * @param {Object} params.customer - Customer object (email, etc.)
 * @param {string} params.transaction_id - Transaction ID
 * @param {string} [params.quote_id] - Quote ID
 * @param {Object} [params.existingPolicies] - Existing policies for duplicate checks
 * @returns {FraudResult}
 */
function evaluateBind({ customer, transaction_id, quote_id, existingPolicies = [] }) {
  const reasons = [];
  let score = 0;

  // Invalid or missing email
  if (!customer?.email?.includes?.('@')) {
    reasons.push('BLOCK:Invalid or missing customer email');
    score = 100;
  }

  // Duplicate transaction_id across policies
  const dupTxn = existingPolicies.filter((p) => p.transaction_id === transaction_id);
  if (dupTxn.length > 0) {
    reasons.push('BLOCK:Duplicate transaction_id across policies');
    score = Math.max(score, 100);
  }

  // Same email with many recent policies (potential abuse)
  const email = customer?.email;
  if (email) {
    const sameEmail = existingPolicies.filter(
      (p) => (p.customer?.email || (typeof p.customer === 'string' ? p.customer : '')) === email
    );
    if (sameEmail.length >= 5) {
      reasons.push(`HOLD:High policy count for email (${sameEmail.length})`);
      score = Math.max(score, 65);
    } else if (sameEmail.length >= 3) {
      reasons.push(`Multiple policies for same email (${sameEmail.length})`);
      score = Math.max(score, 45);
    }
  }

  // No blocking reasons and low score - ensure we have at least one reason for audit
  if (reasons.length === 0) {
    reasons.push('No fraud indicators');
  }

  return decide(score, reasons);
}

module.exports = {
  decide,
  evaluateBind,
};
