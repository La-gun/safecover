/**
 * Policyholder identity + billing: address required on bind; cardholder name must match policyholder.
 */
const safecoverEnv = require('../config/safecoverEnv');

function skipBillingValidation() {
  return safecoverEnv.envBool('SAFECOVER_SKIP_BILLING_VALIDATION', false);
}

/** Normalise for comparison: NFKC, trim, lower, collapse internal spaces. */
function normalizePersonName(s) {
  return String(s || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function namesMatch(policyholderName, cardholderName) {
  const a = normalizePersonName(policyholderName);
  const b = normalizePersonName(cardholderName);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Build canonical customer object from request (supports nested address or legacy flat fields).
 */
function normalizeCustomerInput(body) {
  const c = (body && body.customer) || {};
  const line1 =
    (c.address && c.address.line1) ||
    c.address_line1 ||
    c.street ||
    (typeof body.address === 'string' ? body.address : '') ||
    '';
  const line2 = (c.address && c.address.line2) || c.address_line2 || '';
  const city = (c.address && c.address.city) || c.city || (typeof body.city === 'string' ? body.city : '') || '';
  const postal =
    (c.address && c.address.postal_code) ||
    c.postal_code ||
    c.postcode ||
    (typeof body.zip === 'string' ? body.zip : '') ||
    '';
  const country = (c.address && c.address.country) || c.country || body.country || '';
  const regionRaw =
    (c.address && (c.address.region || c.address.state)) || c.region || c.state || body.region || '';
  const region = String(regionRaw).trim() || undefined;

  return {
    name: String(c.name || body.policyholder_name || '').trim(),
    email: String(c.email || '').trim(),
    phone: c.phone != null && String(c.phone).trim() ? String(c.phone).trim() : undefined,
    address: {
      line1: String(line1).trim(),
      line2: String(line2).trim() || undefined,
      city: String(city).trim(),
      region,
      state: region,
      postal_code: String(postal).trim(),
      country: String(country).trim() || undefined,
    },
  };
}

function validateAddress(addr) {
  if (!addr || typeof addr !== 'object') {
    return { ok: false, error: 'customer.address is required', code: 'ADDRESS_REQUIRED' };
  }
  if (!addr.line1 || addr.line1.length < 3) {
    return { ok: false, error: 'customer.address.line1 must be at least 3 characters', code: 'ADDRESS_LINE1_INVALID' };
  }
  if (!addr.city || addr.city.length < 2) {
    return { ok: false, error: 'customer.address.city is required', code: 'ADDRESS_CITY_INVALID' };
  }
  if (!addr.postal_code || !/^[A-Za-z0-9][A-Za-z0-9 \-]{2,11}$/.test(addr.postal_code)) {
    return {
      ok: false,
      error: 'customer.address.postal_code must be a valid postcode / ZIP',
      code: 'ADDRESS_POSTAL_INVALID',
    };
  }
  if (!addr.country || String(addr.country).trim().length < 2) {
    return { ok: false, error: 'customer.address.country is required (ISO code)', code: 'ADDRESS_COUNTRY_INVALID' };
  }
  return { ok: true };
}

/**
 * @param {object} customerNorm - from normalizeCustomerInput
 * @param {object|null} billing - { cardholder_name }
 * @param {{ skipBillingCheck?: boolean }} opts
 */
function validateBindCustomerAndBilling(customerNorm, billing, opts = {}) {
  const skip = opts.skipBillingCheck === true || skipBillingValidation();

  if (!customerNorm.name || customerNorm.name.length < 2) {
    return {
      ok: false,
      error: 'customer.name (policyholder) is required',
      code: 'POLICYHOLDER_NAME_REQUIRED',
    };
  }

  const addrRes = validateAddress(customerNorm.address);
  if (!addrRes.ok) return addrRes;

  if (skip) {
    return { ok: true, customer: customerNorm };
  }

  const cardName = billing && String(billing.cardholder_name || '').trim();
  if (!cardName) {
    return {
      ok: false,
      error: 'billing.cardholder_name is required and must match the policyholder name',
      code: 'CARDHOLDER_NAME_REQUIRED',
    };
  }

  if (!namesMatch(customerNorm.name, cardName)) {
    return {
      ok: false,
      error:
        'Cardholder name must match policyholder name (same person). Check spelling; extra spaces and letter case are ignored.',
      code: 'CARDHOLDER_NAME_MISMATCH',
    };
  }

  return { ok: true, customer: customerNorm };
}

module.exports = {
  normalizePersonName,
  namesMatch,
  normalizeCustomerInput,
  validateAddress,
  validateBindCustomerAndBilling,
  skipBillingValidation,
};
