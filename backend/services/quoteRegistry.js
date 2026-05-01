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

function canonicalPayload(parts) {
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

function signQuote(secret, parts) {
  return crypto.createHmac('sha256', secret).update(canonicalPayload(parts)).digest('hex');
}

function verifySignature(secret, record) {
  const expected = signQuote(secret, {
    quote_id: record.quote_id,
    premium: record.premium,
    provider_id: record.provider_id,
    plan_id: record.plan_id,
    scenario: record.scenario,
    jurisdiction: record.jurisdiction,
    items_fingerprint: record.items_fingerprint,
    expires_at: record.expires_at,
    partner_id: record.partner_id,
  });
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(record.signature, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Register a quote for later bind validation. Persists via store.
 */
function registerQuote(store, params) {
  const secret = safecoverEnv.getQuoteSigningSecret();
  const ttl = safecoverEnv.quoteTtlMs();
  const expires_at = Date.now() + ttl;
  const items_fingerprint = itemsFingerprint(params.items);
  const partner_id = params.partner_id || params.partnerId || 'anonymous';
  const record = {
    quote_id: params.quote_id,
    partner_id,
    premium: Number(params.premium),
    provider_id: params.provider_id || null,
    plan_id: params.plan_id || null,
    scenario: params.scenario || 'retail',
    jurisdiction: params.jurisdiction || 'US',
    items_fingerprint,
    expires_at,
    consumed: 0,
    created_at: new Date().toISOString(),
    signature: signQuote(secret, {
      quote_id: params.quote_id,
      premium: Number(params.premium),
      provider_id: params.provider_id || null,
      plan_id: params.plan_id || null,
      scenario: params.scenario || 'retail',
      jurisdiction: params.jurisdiction || 'US',
      items_fingerprint,
      expires_at,
      partner_id,
    }),
  };
  store.saveQuoteRecord(record);
  return { expires_at: new Date(expires_at).toISOString(), items_fingerprint };
}

/** Register all marketplace options returned to the client (each quote_id bindable). */
function registerOptionQuotes(store, { partnerId, items, jurisdiction, scenario, options }) {
  for (const o of options || []) {
    if (!o.quote_id) continue;
    registerQuote(store, {
      quote_id: o.quote_id,
      partner_id: partnerId,
      items,
      premium: o.premium,
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
      error: 'premium_paid does not match quoted premium',
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
};
