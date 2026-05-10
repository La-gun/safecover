/**
 * Server-side quote ledger: bind must match a registered quote (strict mode),
 * or optionally skip if quote missing in dev (non-strict).
 */
const crypto = require('crypto');
const safecoverEnv = require('../config/safecoverEnv');

function itemsFingerprint(items) {
  const normalized = (items || []).map((i) => ({
    v: Number(i.value) || 0,
    n: (i.name || i.description || '').slice(0, 120),
  }));
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function canonicalPayloadV1(parts) {
  const o = {
    quote_id: parts.quote_id,
    premium: Number(parts.premium),
    provider_id: parts.provider_id || null,
    plan_id: parts.plan_id || null,
    scenario: parts.scenario || 'retail',
    jurisdiction: parts.jurisdiction || 'US',
    items_fingerprint: parts.items_fingerprint,
    expires_at: parts.expires_at,
    partner_id: parts.partner_id || 'anonymous',
  };
  return JSON.stringify(o);
}

function canonicalPayloadV2(parts) {
  const o = {
    quote_id: parts.quote_id,
    premium: Number(parts.premium),
    provider_id: parts.provider_id || null,
    plan_id: parts.plan_id || null,
    scenario: parts.scenario || 'retail',
    jurisdiction: parts.jurisdiction || 'US',
    items_fingerprint: parts.items_fingerprint,
    expires_at: parts.expires_at,
    partner_id: parts.partner_id || 'anonymous',
    billing_period: parts.billing_period || 'lump_sum',
    premium_lump_sum: Number(parts.premium_lump_sum),
    financed_total: Number(parts.financed_total),
    installment_count: Number(parts.installment_count),
    first_installment: Number(parts.first_installment),
    financing_load_rate: Number(parts.financing_load_rate),
  };
  return JSON.stringify(o);
}

function signPayload(secret, canonical) {
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/** @deprecated use signingPartsFromParams + canonicalPayloadV2 */
function signQuote(secret, parts) {
  return signPayload(secret, canonicalPayloadV2(parts));
}

function signingPartsFromParams(params, expires_at) {
  const premiumBind = Number(params.premium);
  const lump =
    params.premium_lump_sum != null && params.premium_lump_sum !== ''
      ? Number(params.premium_lump_sum)
      : premiumBind;
  const bp = params.billing_period || 'lump_sum';
  return {
    quote_id: params.quote_id,
    premium: premiumBind,
    provider_id: params.provider_id || null,
    plan_id: params.plan_id || null,
    scenario: params.scenario || 'retail',
    jurisdiction: params.jurisdiction || 'US',
    items_fingerprint: itemsFingerprint(params.items),
    expires_at,
    partner_id: params.partner_id || params.partnerId || 'anonymous',
    billing_period: bp,
    premium_lump_sum: lump,
    financed_total:
      params.financed_total != null && params.financed_total !== '' ? Number(params.financed_total) : lump,
    installment_count:
      params.installment_count != null && params.installment_count !== ''
        ? Number(params.installment_count)
        : 1,
    first_installment:
      params.first_installment != null && params.first_installment !== ''
        ? Number(params.first_installment)
        : premiumBind,
    financing_load_rate:
      params.financing_load_rate != null && params.financing_load_rate !== ''
        ? Number(params.financing_load_rate)
        : 0,
  };
}

function recordToSigningParts(record) {
  const premiumBind = Number(record.premium);
  const lump = record.premium_lump_sum != null ? Number(record.premium_lump_sum) : premiumBind;
  const bp = record.billing_period || 'lump_sum';
  return {
    quote_id: record.quote_id,
    premium: premiumBind,
    provider_id: record.provider_id || null,
    plan_id: record.plan_id || null,
    scenario: record.scenario || 'retail',
    jurisdiction: record.jurisdiction || 'US',
    items_fingerprint: record.items_fingerprint,
    expires_at: record.expires_at,
    partner_id: record.partner_id || 'anonymous',
    billing_period: bp,
    premium_lump_sum: lump,
    financed_total: record.financed_total != null ? Number(record.financed_total) : lump,
    installment_count: record.installment_count != null ? Number(record.installment_count) : 1,
    first_installment: record.first_installment != null ? Number(record.first_installment) : premiumBind,
    financing_load_rate: record.financing_load_rate != null ? Number(record.financing_load_rate) : 0,
  };
}

function recordToLegacyV1Parts(record) {
  return {
    quote_id: record.quote_id,
    premium: Number(record.premium),
    provider_id: record.provider_id || null,
    plan_id: record.plan_id || null,
    scenario: record.scenario || 'retail',
    jurisdiction: record.jurisdiction || 'US',
    items_fingerprint: record.items_fingerprint,
    expires_at: record.expires_at,
    partner_id: record.partner_id || 'anonymous',
  };
}

function timingSafeEqualHex(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

function verifySignature(secret, record) {
  const version = record.quote_signing_version;
  if (version === 2) {
    const expected = signPayload(secret, canonicalPayloadV2(recordToSigningParts(record)));
    return timingSafeEqualHex(expected, record.signature);
  }
  const expectedLegacy = signPayload(secret, canonicalPayloadV1(recordToLegacyV1Parts(record)));
  return timingSafeEqualHex(expectedLegacy, record.signature);
}

/**
 * Register a quote for later bind validation. Persists via store.
 */
function registerQuote(store, params) {
  const secret = safecoverEnv.getQuoteSigningSecret();
  const ttl = safecoverEnv.quoteTtlMs();
  const expires_at = Date.now() + ttl;
  const partner_id = params.partner_id || params.partnerId || 'anonymous';
  const parts = signingPartsFromParams({ ...params, partner_id }, expires_at);
  const record = {
    quote_id: params.quote_id,
    partner_id,
    premium: parts.premium,
    provider_id: parts.provider_id,
    plan_id: parts.plan_id,
    scenario: parts.scenario,
    jurisdiction: parts.jurisdiction,
    items_fingerprint: parts.items_fingerprint,
    expires_at,
    consumed: 0,
    created_at: new Date().toISOString(),
    quote_signing_version: 2,
    billing_period: parts.billing_period,
    premium_lump_sum: parts.premium_lump_sum,
    financed_total: parts.financed_total,
    installment_count: parts.installment_count,
    first_installment: parts.first_installment,
    financing_load_rate: parts.financing_load_rate,
    schedule: Array.isArray(params.schedule) ? params.schedule : null,
    signature: signPayload(secret, canonicalPayloadV2(parts)),
  };
  store.saveQuoteRecord(record);
  return { expires_at: new Date(expires_at).toISOString(), items_fingerprint: parts.items_fingerprint };
}

/** Register all marketplace options returned to the client (each quote_id bindable). */
function registerOptionQuotes(store, { partnerId, items, jurisdiction, scenario, options }) {
  for (const o of options || []) {
    if (!o.quote_id) continue;
    const b = o.billing || {};
    registerQuote(store, {
      quote_id: o.quote_id,
      partner_id: partnerId,
      items,
      premium: b.premium_due_at_bind != null ? b.premium_due_at_bind : o.premium,
      premium_lump_sum: b.premium_lump_sum != null ? b.premium_lump_sum : o.premium,
      billing_period: b.billing_period || 'lump_sum',
      financed_total: b.financed_total,
      installment_count: b.installment_count,
      first_installment: b.first_installment,
      financing_load_rate: b.financing_load_rate,
      schedule: b.schedule,
      provider_id: o.provider_id,
      plan_id: o.plan_id,
      scenario,
      jurisdiction,
    });
  }
}

/**
 * Validate quote for bind (does not consume — call store.consumeQuoteRecord after policy is saved).
 */
function evaluateQuoteForBind(store, ctx) {
  const strict = safecoverEnv.isStrictMode();
  const {
    quote_id,
    premium_paid,
    provider_id,
    plan_id,
    scenario,
    items,
    bind_partner_id,
    billing_period: bindBillingPeriod,
  } = ctx;

  const record = store.getQuoteRecord(quote_id);
  if (!record) {
    if (strict) {
      return { ok: false, code: 'UNKNOWN_QUOTE', error: 'Unknown or expired quote_id; request a new quote' };
    }
    return { ok: true, skipped: true, record: null };
  }

  if (record.consumed) {
    return { ok: false, code: 'QUOTE_CONSUMED', error: 'Quote already used; request a new quote' };
  }

  if (Date.now() > record.expires_at) {
    return { ok: false, code: 'QUOTE_EXPIRED', error: 'Quote expired; request a new quote' };
  }

  const pid = bind_partner_id || 'anonymous';
  if (record.partner_id !== pid) {
    return { ok: false, code: 'QUOTE_PARTNER_MISMATCH', error: 'Quote was issued for a different partner' };
  }

  const paid = Number(premium_paid);
  const tol = safecoverEnv.premiumTolerance(record.premium);
  if (Math.abs(paid - record.premium) > tol) {
    return {
      ok: false,
      code: 'PREMIUM_MISMATCH',
      error:
        'premium_paid does not match quoted amount due at bind (premium_due_at_bind / first_installment for installment quotes)',
    };
  }

  if (record.scenario !== (scenario || 'retail')) {
    return { ok: false, code: 'SCENARIO_MISMATCH', error: 'scenario does not match quote' };
  }

  if (record.provider_id && (!provider_id || record.provider_id !== provider_id)) {
    return { ok: false, code: 'PROVIDER_MISMATCH', error: 'provider_id does not match quote' };
  }
  if (record.plan_id && (!plan_id || record.plan_id !== plan_id)) {
    return { ok: false, code: 'PLAN_MISMATCH', error: 'plan_id does not match quote' };
  }

  const recBp = record.billing_period || 'lump_sum';
  if (bindBillingPeriod != null && String(bindBillingPeriod).trim()) {
    const b = String(bindBillingPeriod).toLowerCase().trim();
    if (b !== recBp) {
      return { ok: false, code: 'BILLING_PERIOD_MISMATCH', error: 'billing_period does not match quote' };
    }
  }

  if (strict && record && (!items || items.length === 0)) {
    return { ok: false, code: 'ITEMS_REQUIRED', error: 'items array required at bind to verify cart fingerprint' };
  }
  if (items && items.length) {
    const fp = itemsFingerprint(items);
    if (fp !== record.items_fingerprint) {
      return { ok: false, code: 'CART_MISMATCH', error: 'Cart items do not match quoted fingerprint' };
    }
  }

  const secret = safecoverEnv.getQuoteSigningSecret();
  if (!verifySignature(secret, record)) {
    return { ok: false, code: 'QUOTE_SIGNATURE_INVALID', error: 'Quote integrity check failed' };
  }

  return { ok: true, record };
}

module.exports = {
  itemsFingerprint,
  registerQuote,
  registerOptionQuotes,
  evaluateQuoteForBind,
  signQuote,
  canonicalPayloadV1,
  canonicalPayloadV2,
  signingPartsFromParams,
};
