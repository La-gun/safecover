/**
 * Input validation middleware for SafeCover API routes.
 *
 * Validates and sanitizes request bodies for:
 *   - POST /api/quote/rate   → validateQuoteBody
 *   - POST /api/policy/bind  → validateBindBody
 *   - POST /api/claim        → validateClaimBody
 *
 * Design principles:
 *  - Allowlist approach: unknown top-level keys are stripped from req.body.
 *  - All errors are collected before responding (not fail-fast).
 *  - No external dependencies — pure Node.js.
 *  - Returns 400 with { error, code: 'VALIDATION_ERROR', details: [...] } on failure.
 */

// Valid scenario IDs sourced from backend/scenarios.js
const VALID_SCENARIO_IDS = new Set([
  'logistics',
  'healthcare',
  'hospitality',
  'food',
  'cyber',
  'mobility',
  'parametric',
  'retail',
  'gadgets',
  'events',
  'jewellery',
]);

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;
const ALPHANUM_RE = /^[a-zA-Z0-9]+$/;
const TRANSACTION_ID_RE = /^[a-zA-Z0-9_\-]{1,200}$/;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Trim, strip null bytes, and truncate a string.
 * Returns null if input is not a string.
 */
function sanitizeString(s, maxLen) {
  if (typeof s !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x00/g, '').trim().slice(0, maxLen);
}

/**
 * Validate a single item in an items array.
 * Pushes error messages into the `errors` array.
 * Returns a sanitized item object, or null on failure.
 */
function validateItem(item, index, errors) {
  if (item === null || typeof item !== 'object' || Array.isArray(item)) {
    errors.push(`items[${index}]: must be an object`);
    return null;
  }

  const itemErrors = [];
  let name, value;

  if (typeof item.name !== 'string' || item.name.trim() === '') {
    itemErrors.push(`items[${index}].name: required string`);
  } else {
    name = sanitizeString(item.name, 200);
    if (name.length === 0) {
      itemErrors.push(`items[${index}].name: must not be empty after sanitization`);
    }
  }

  if (typeof item.value !== 'number' || !isFinite(item.value)) {
    itemErrors.push(`items[${index}].value: required finite number`);
  } else if (item.value <= 0) {
    itemErrors.push(`items[${index}].value: must be positive`);
  } else if (item.value > 1_000_000) {
    itemErrors.push(`items[${index}].value: must not exceed 1,000,000`);
  } else {
    value = item.value;
  }

  if (itemErrors.length > 0) {
    errors.push(...itemErrors);
    return null;
  }

  return { name, value };
}

/**
 * Validate and sanitize an items array.
 * Returns sanitized array on success, null on failure (errors appended).
 */
function validateItems(raw, errors) {
  if (!Array.isArray(raw)) {
    errors.push('items: required array');
    return null;
  }
  if (raw.length === 0) {
    errors.push('items: must contain at least one item');
    return null;
  }
  if (raw.length > 50) {
    errors.push('items: must not exceed 50 items');
    return null;
  }

  const sanitized = [];
  let itemsValid = true;
  for (let i = 0; i < raw.length; i++) {
    const item = validateItem(raw[i], i, errors);
    if (item === null) itemsValid = false;
    else sanitized.push(item);
  }

  return itemsValid ? sanitized : null;
}

/**
 * Emit a 400 validation error response.
 */
function fail(res, details) {
  return res.status(400).json({
    error: 'Validation failed',
    code: 'VALIDATION_ERROR',
    details,
  });
}

// ─── validateQuoteBody ────────────────────────────────────────────────────────

/**
 * Validates POST /api/quote/rate body.
 * Allowed keys: scenario, items, jurisdiction, partner_id
 */
function validateQuoteBody(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const errors = [];

  // scenario — required, must be a known scenario ID
  let scenario;
  if (typeof body.scenario !== 'string' || body.scenario.trim() === '') {
    errors.push('scenario: required string');
  } else {
    scenario = sanitizeString(body.scenario, 100);
    if (!VALID_SCENARIO_IDS.has(scenario)) {
      errors.push(`scenario: must be one of [${[...VALID_SCENARIO_IDS].join(', ')}]`);
    }
  }

  // items — required, non-empty array, max 50
  const items = validateItems(body.items, errors);

  // jurisdiction — optional, max 10, alphanumeric
  let jurisdiction;
  if (body.jurisdiction !== undefined && body.jurisdiction !== null) {
    if (typeof body.jurisdiction !== 'string') {
      errors.push('jurisdiction: must be a string');
    } else {
      jurisdiction = sanitizeString(body.jurisdiction, 10);
      if (jurisdiction.length > 0 && !ALPHANUM_RE.test(jurisdiction)) {
        errors.push('jurisdiction: must be alphanumeric only');
      }
    }
  }

  // partner_id — optional, max 100
  let partner_id;
  if (body.partner_id !== undefined && body.partner_id !== null) {
    if (typeof body.partner_id !== 'string') {
      errors.push('partner_id: must be a string');
    } else {
      partner_id = sanitizeString(body.partner_id, 100);
    }
  }

  if (errors.length > 0) return fail(res, errors);

  // Strip unknown keys — allowlist only
  req.body = { scenario };
  if (items !== null) req.body.items = items;
  if (jurisdiction !== undefined) req.body.jurisdiction = jurisdiction;
  if (partner_id !== undefined) req.body.partner_id = partner_id;

  next();
}

// ─── validateBindBody ─────────────────────────────────────────────────────────

/**
 * Validates POST /api/policy/bind body.
 * Allowed keys: quote_id, provider_id, plan_id, premium, transaction_id,
 *               customer, items, scenario, jurisdiction
 */
function validateBindBody(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const errors = [];

  // quote_id — required, max 100
  let quote_id;
  if (typeof body.quote_id !== 'string' || body.quote_id.trim() === '') {
    errors.push('quote_id: required string');
  } else {
    quote_id = sanitizeString(body.quote_id, 100);
    if (quote_id.length === 0) errors.push('quote_id: must not be empty');
  }

  // provider_id — required, max 100
  let provider_id;
  if (typeof body.provider_id !== 'string' || body.provider_id.trim() === '') {
    errors.push('provider_id: required string');
  } else {
    provider_id = sanitizeString(body.provider_id, 100);
    if (provider_id.length === 0) errors.push('provider_id: must not be empty');
  }

  // plan_id — required, max 100
  let plan_id;
  if (typeof body.plan_id !== 'string' || body.plan_id.trim() === '') {
    errors.push('plan_id: required string');
  } else {
    plan_id = sanitizeString(body.plan_id, 100);
    if (plan_id.length === 0) errors.push('plan_id: must not be empty');
  }

  // premium — required, positive number, max 100,000
  // Accept premium_paid as alias (used by checkout-ux-demo)
  let premium;
  const premiumRaw = body.premium ?? body.premium_paid;
  if (typeof premiumRaw !== 'number' || !isFinite(premiumRaw)) {
    errors.push('premium: required finite number');
  } else if (premiumRaw <= 0) {
    errors.push('premium: must be positive');
  } else if (premiumRaw > 100_000) {
    errors.push('premium: must not exceed 100,000');
  } else {
    premium = premiumRaw;
  }

  // transaction_id — required, alphanumeric+dash+underscore, max 200
  let transaction_id;
  if (typeof body.transaction_id !== 'string' || body.transaction_id.trim() === '') {
    errors.push('transaction_id: required string');
  } else {
    transaction_id = sanitizeString(body.transaction_id, 200);
    if (!TRANSACTION_ID_RE.test(transaction_id)) {
      errors.push('transaction_id: must match pattern [a-zA-Z0-9_-]{1,200}');
    }
  }

  // customer — required object with email, name, optional phone
  let customer;
  if (!body.customer || typeof body.customer !== 'object' || Array.isArray(body.customer)) {
    errors.push('customer: required object');
  } else {
    const c = body.customer;
    const customerErrors = [];
    let email, name, phone;

    if (typeof c.email !== 'string' || c.email.trim() === '') {
      customerErrors.push('customer.email: required string');
    } else {
      email = sanitizeString(c.email, 320);
      if (!EMAIL_RE.test(email)) {
        customerErrors.push('customer.email: must be a valid email address');
      }
    }

    if (typeof c.name !== 'string' || c.name.trim() === '') {
      customerErrors.push('customer.name: required string');
    } else {
      name = sanitizeString(c.name, 200);
      if (name.length === 0) customerErrors.push('customer.name: must not be empty');
    }

    if (c.phone !== undefined && c.phone !== null) {
      if (typeof c.phone !== 'string') {
        customerErrors.push('customer.phone: must be a string');
      } else {
        phone = sanitizeString(c.phone, 30);
      }
    }

    if (customerErrors.length > 0) {
      errors.push(...customerErrors);
    } else {
      customer = { email, name };
      if (phone !== undefined) customer.phone = phone;
    }
  }

  // items — required, same constraints as quote
  const items = validateItems(body.items, errors);

  // scenario — required, must be a known scenario ID
  let scenario;
  if (typeof body.scenario !== 'string' || body.scenario.trim() === '') {
    errors.push('scenario: required string');
  } else {
    scenario = sanitizeString(body.scenario, 100);
    if (!VALID_SCENARIO_IDS.has(scenario)) {
      errors.push(`scenario: must be one of [${[...VALID_SCENARIO_IDS].join(', ')}]`);
    }
  }

  // jurisdiction — optional, max 10, alphanumeric
  let jurisdiction;
  if (body.jurisdiction !== undefined && body.jurisdiction !== null) {
    if (typeof body.jurisdiction !== 'string') {
      errors.push('jurisdiction: must be a string');
    } else {
      jurisdiction = sanitizeString(body.jurisdiction, 10);
      if (jurisdiction.length > 0 && !ALPHANUM_RE.test(jurisdiction)) {
        errors.push('jurisdiction: must be alphanumeric only');
      }
    }
  }

  if (errors.length > 0) return fail(res, errors);

  // Strip unknown keys — allowlist only
  req.body = {
    quote_id,
    provider_id,
    plan_id,
    premium,
    transaction_id,
    customer,
    items,
    scenario,
  };
  if (jurisdiction !== undefined) req.body.jurisdiction = jurisdiction;

  next();
}

// ─── validateClaimBody ────────────────────────────────────────────────────────

/**
 * Validates POST /api/claim body.
 * Allowed keys: policy_id, claim_type, description, amount
 */
function validateClaimBody(req, res, next) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : {};
  const errors = [];

  // policy_id — required, max 100
  let policy_id;
  if (typeof body.policy_id !== 'string' || body.policy_id.trim() === '') {
    errors.push('policy_id: required string');
  } else {
    policy_id = sanitizeString(body.policy_id, 100);
    if (policy_id.length === 0) errors.push('policy_id: must not be empty');
  }

  // claim_type — required, max 100
  let claim_type;
  if (typeof body.claim_type !== 'string' || body.claim_type.trim() === '') {
    errors.push('claim_type: required string');
  } else {
    claim_type = sanitizeString(body.claim_type, 100);
    if (claim_type.length === 0) errors.push('claim_type: must not be empty');
  }

  // description — optional, max 2000
  let description;
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('description: must be a string');
    } else {
      description = sanitizeString(body.description, 2000);
    }
  }

  // amount — optional, positive, max 1,000,000
  let amount;
  if (body.amount !== undefined && body.amount !== null) {
    if (typeof body.amount !== 'number' || !isFinite(body.amount)) {
      errors.push('amount: must be a finite number');
    } else if (body.amount <= 0) {
      errors.push('amount: must be positive');
    } else if (body.amount > 1_000_000) {
      errors.push('amount: must not exceed 1,000,000');
    } else {
      amount = body.amount;
    }
  }

  if (errors.length > 0) return fail(res, errors);

  // Strip unknown keys — allowlist only
  req.body = { policy_id, claim_type };
  if (description !== undefined) req.body.description = description;
  if (amount !== undefined) req.body.amount = amount;

  next();
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  validateQuoteBody,
  validateBindBody,
  validateClaimBody,
  sanitizeString,
};
