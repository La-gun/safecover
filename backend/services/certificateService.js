/**
 * Policy certificate / schedule document: URL builder, period maths, public payload.
 */
const crypto = require('crypto');
const certificateWording = require('./certificateWording');

function timingSafeEqualString(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

/** Parse scenario duration strings into milliseconds (approximate for months/years). */
function parseDurationToMs(durationStr) {
  const s = String(durationStr || '').toLowerCase().trim();
  const m = s.match(/(\d+(?:\.\d+)?)/);
  const n = m ? parseFloat(m[1]) : NaN;
  if (s.includes('hour')) return (Number.isFinite(n) ? n : 24) * 3600000;
  if (s.includes('day')) return (Number.isFinite(n) ? n : 7) * 86400000;
  if (s.includes('month')) return (Number.isFinite(n) ? n : 12) * 30 * 86400000;
  if (s.includes('year')) return (Number.isFinite(n) ? n : 1) * 365 * 86400000;
  if (s.includes('trip') || s.includes('event')) return 7 * 86400000;
  return 7 * 86400000;
}

function computePeriodEnd(startIso, durationStr) {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + parseDurationToMs(durationStr));
  return end.toISOString();
}

function normalizeInsuredItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return [{ description: 'Insured goods as per order / schedule', value: null, sku: null }];
  }
  return items.map((i, idx) => ({
    line_id: i.line_id != null ? String(i.line_id) : `L${idx + 1}`,
    description: String(i.name || i.description || i.sku || 'Insured item').slice(0, 300),
    value: typeof i.value === 'number' && Number.isFinite(i.value) ? i.value : null,
    sku: i.sku != null ? String(i.sku).slice(0, 80) : null,
    quantity: typeof i.quantity === 'number' ? i.quantity : null,
  }));
}

function formatItemsPipeList(normalizedItems, currencySymbol = '£') {
  return normalizedItems
    .map((i) => {
      const parts = [i.description];
      if (i.value != null) parts.push(`${currencySymbol}${Number(i.value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      if (i.sku) parts.push(`SKU ${i.sku}`);
      return parts.join(' — ');
    })
    .join('|');
}

function publicBaseUrl(req) {
  if (req && req.get && req.get('host')) {
    return `${req.protocol || 'http'}://${req.get('host')}`;
  }
  return process.env.BASE_URL || 'http://localhost:3000';
}

function newCertificateId() {
  return `CERT_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function newCertificateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function envInsurerOverrides() {
  return {
    legal_name: process.env.INSURER_LEGAL_NAME || null,
    registered_address: process.env.INSURER_REGISTERED_ADDRESS || null,
    fca_registration: process.env.INSURER_FCA_NUMBER || null,
    phone: process.env.INSURER_PHONE || null,
    enquiries_email: process.env.INSURER_ENQUIRIES_EMAIL || null,
    claims_email: process.env.INSURER_CLAIMS_EMAIL || null,
    governing_law: process.env.POLICY_GOVERNING_LAW || null,
    complaints_email: process.env.INSURER_COMPLAINTS_EMAIL || null,
    fos_url: process.env.FOS_URL || 'https://www.financial-ombudsman.org.uk',
  };
}

function insurerLegalFromProvider(provider) {
  const e = envInsurerOverrides();
  if (!provider) {
    return {
      legal_name: e.legal_name || 'SafeCover Insurance Ltd',
      registered_address: e.registered_address || '123 Insurance House, London EC2V 7HH',
      fca_registration: e.fca_registration || '123456',
      phone: e.phone || '0800 123 4567',
      enquiries_email: e.enquiries_email || 'enquiries@safecover.co.uk',
      claims_email: e.claims_email || 'claims@safecover.co.uk',
    };
  }
  return {
    legal_name: e.legal_name || provider.legal_entity_name || `${provider.name} Insurance Ltd`,
    registered_address: e.registered_address || provider.registered_address || '123 Insurance House, London EC2V 7HH',
    fca_registration: e.fca_registration || provider.fca_registration_number || '123456',
    phone: e.phone || provider.claims_phone || '0800 123 4567',
    enquiries_email: e.enquiries_email || provider.enquiries_email || 'enquiries@safecover.co.uk',
    claims_email: e.claims_email || provider.claims_email || 'claims@safecover.co.uk',
  };
}

function defaultCurrencyForJurisdiction(jurisdiction) {
  const j = String(jurisdiction || '').toUpperCase();
  if (j === 'UK' || j === 'GB' || j === 'GBR') return 'GBP';
  if (j === 'NG' || j === 'NGA' || j === 'NIGERIA') return 'NGN';
  if (j === 'US' || j === 'USA') return 'USD';
  return process.env.DEFAULT_POLICY_CURRENCY || 'GBP';
}

function currencySymbol(cur) {
  const c = String(cur || 'GBP').toUpperCase();
  if (c === 'GBP') return '£';
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  if (c === 'NGN') return '₦';
  return `${c} `;
}

/**
 * Attach certificate fields at bind. Does not replace existing certificate_id/token if already set (idempotent retry).
 */
function attachCertificateToPolicy(policy, req, ctx) {
  const {
    scenario,
    plan,
    provider,
    items,
    partnerId,
    planName,
  } = ctx;
  const currency = defaultCurrencyForJurisdiction(policy.jurisdiction);
  const sym = currencySymbol(currency);
  const normalizedItems = normalizeInsuredItems(items);
  const duration = policy.coverage_details?.duration || scenario?.duration || '7 days';
  const inception = policy.recorded_at || new Date().toISOString();
  const endIso = computePeriodEnd(inception, duration);
  const excess = plan?.excess != null ? Number(plan.excess) : 50;
  const sumInsured = policy.coverage_details?.max_value ?? scenario?.max_value ?? 0;
  const cartTotal = normalizedItems.reduce((s, i) => s + (typeof i.value === 'number' ? i.value : 0), 0);
  const totalSum = cartTotal > 0 ? Math.min(cartTotal, sumInsured) : sumInsured;

  const insurer = insurerLegalFromProvider(provider);
  const wording = certificateWording.getWordingForScenario(policy.scenario || scenario?.id || 'retail');
  const certificateId = policy.certificate_id || newCertificateId();
  const certificateToken = policy.certificate_token || newCertificateToken();

  const next = {
    ...policy,
    certificate_id: certificateId,
    certificate_token: certificateToken,
    currency,
    excess,
    insured_items: normalizedItems,
    broker_or_platform: {
      platform_id: partnerId || policy.partner_id || null,
      name: process.env.PLATFORM_DISPLAY_NAME || 'SafeCover embedded platform',
    },
    insurer_legal: insurer,
    schedule: {
      policy_number: policy.policy_id,
      certificate_number: certificateId,
      order_or_transaction_id: policy.transaction_id,
      plan_name: planName || plan?.name || null,
      sum_insured: sumInsured,
      total_sum_insured: totalSum,
      inner_limit_per_item: sumInsured,
      excess,
      currency,
      insured_items_summary: formatItemsPipeList(normalizedItems, sym),
      policyholder_name: policy.customer?.name || null,
      policyholder_address: policy.customer?.address || null,
      risk_address_single_line: formatAddressOneLine(policy.customer?.address),
    },
    period: {
      timezone: process.env.POLICY_TIMEZONE || 'Europe/London',
      duration_text: duration,
      start_date: inception,
      end_date: endIso,
      provisional: policy.status === 'PENDING_PAYMENT',
    },
    product: {
      product_id: `${policy.scenario || 'retail'}:${policy.provider_id}:${policy.plan_id}`,
      product_name: wording.product_title,
      coverage_type: policy.coverage_details?.type || scenario?.coverage_type,
      wording_version: policy.regulatory_snapshot?.policy_wording_version || '1.0.0',
    },
    certificate_url: policy.certificate_url,
  };

  next.certificate_url = buildCertificateUrl(req, next);
  return next;
}

/** After payment confirm: fix inception to confirmed_at and recompute end; refresh URL. */
function refreshCertificateAfterConfirm(policy, req) {
  const confirmed = policy.confirmed_at || new Date().toISOString();
  const duration = policy.coverage_details?.duration || policy.period?.duration_text || '7 days';
  const endIso = computePeriodEnd(confirmed, duration);
  const updated = {
    ...policy,
    period: {
      ...(policy.period || {}),
      start_date: confirmed,
      end_date: endIso,
      provisional: false,
      timezone: policy.period?.timezone || process.env.POLICY_TIMEZONE || 'Europe/London',
      duration_text: duration,
    },
  };
  updated.certificate_url = buildCertificateUrl(req, updated);
  return updated;
}

function buildCertificateUrl(req, policy) {
  const base = publicBaseUrl(req);
  const params = new URLSearchParams({
    policy_id: policy.policy_id || '',
    token: policy.certificate_token || '',
  });
  return `${base}/ipid-certificate.html?${params.toString()}`;
}

function buildLegacyCertificateUrl(req, policy) {
  const base = publicBaseUrl(req);
  const cov = policy.coverage_details || {};
  const sym = currencySymbol(policy.currency || defaultCurrencyForJurisdiction(policy.jurisdiction));
  const itemsStr =
    policy.schedule?.insured_items_summary ||
    formatItemsPipeList(policy.insured_items || normalizeInsuredItems([]), sym);
  const inception = (policy.period && policy.period.start_date) || policy.confirmed_at || policy.recorded_at || new Date().toISOString();
  const params = new URLSearchParams({
    policy_id: policy.policy_id || '',
    premium: String(policy.premium ?? 0),
    sum_insured: String(cov.max_value ?? 0),
    total_sum: String(policy.schedule?.total_sum_insured ?? cov.max_value ?? 0),
    effective: String(inception).slice(0, 10),
    duration: cov.duration || '12 months',
    excess: String(policy.excess ?? 50),
    insurer: policy.provider_name || 'SafeCover Insurance Ltd',
    items: itemsStr.slice(0, 1800),
    currency: policy.currency || 'GBP',
    certificate_id: policy.certificate_id || '',
    policyholder: policy.customer?.name || '',
    email: policy.customer?.email || '',
    transaction_id: policy.transaction_id || '',
    legacy: '1',
  });
  return `${base}/ipid-certificate.html?${params.toString()}`;
}

/**
 * Public JSON for certificate page — no secrets.
 */
function buildPublicCertificateDocument(policy) {
  const scenarioId = policy.scenario || 'retail';
  const wording = certificateWording.getWordingForScenario(scenarioId);
  const cov = policy.coverage_details || {};
  const e = envInsurerOverrides();
  const sym = currencySymbol(policy.currency);

  return {
    schema_version: '1.0',
    document_type: 'certificate_and_schedule',
    policy_id: policy.policy_id,
    certificate_id: policy.certificate_id,
    quote_id: policy.quote_id || null,
    status: policy.status,
    product: {
      ...(policy.product || {}),
      product_name: wording.product_title,
      coverage_type_label: wording.coverage_type_label,
    },
    parties: {
      insurer: {
        trading_name: policy.provider_name,
        ...(policy.insurer_legal || insurerLegalFromProvider(null)),
      },
      policyholder: {
        full_name: policy.customer?.name || null,
        email: policy.customer?.email || null,
        phone: policy.customer?.phone || null,
        address: policy.customer?.address || null,
        address_lines: formatAddressLines(policy.customer?.address),
        address_single_line: formatAddressOneLine(policy.customer?.address),
        customer_ref: policy.customer?.customer_id || null,
      },
      broker_or_platform: policy.broker_or_platform || null,
    },
    coverage: {
      coverage_type: cov.type,
      covered_risks: wording.covered_risks,
      excluded_risks: wording.exclusions,
      insuring_clause: wording.insuring_clause,
      sum_insured: cov.max_value,
      limit_per_claim: cov.max_value,
      aggregate_limit: policy.schedule?.total_sum_insured ?? cov.max_value,
      excess: policy.excess,
      currency: policy.currency,
      insured_items: policy.insured_items || [],
    },
    period: policy.period || {},
    premium: {
      premium_amount: policy.premium,
      currency: policy.currency,
      payment_status: policy.status === 'ACTIVE' ? 'PAID' : policy.status === 'PENDING_PAYMENT' ? 'PENDING' : 'UNKNOWN',
      payment_reference: policy.payment_reference || null,
      commission: policy.commission,
    },
    conditions: wording.conditions_obligations,
    claims: {
      phone: policy.insurer_legal?.phone,
      email: policy.insurer_legal?.claims_email,
      steps: wording.claims_process,
      notification_days: parseInt(process.env.CLAIM_NOTIFY_DAYS || '7', 10) || 7,
    },
    legal: {
      governing_law: e.governing_law || (String(policy.jurisdiction || '').toUpperCase() === 'UK' ? 'England and Wales' : policy.jurisdiction || 'As per schedule'),
      regulator_note: 'Refer to insurer FCA / local regulator details on this document',
      complaints_email: e.complaints_email || policy.insurer_legal?.enquiries_email,
      financial_ombudsman_url: e.fos_url,
      privacy_note: 'Personal data processed per insurer privacy notice and applicable law (e.g. UK GDPR)',
      regulatory_snapshot: policy.regulatory_snapshot || null,
      legal_notes: wording.legal_notes,
    },
    schedule: policy.schedule || {},
    verification: {
      issued_at: policy.recorded_at,
      confirmed_at: policy.confirmed_at || null,
      verify_url: policy.certificate_url || null,
    },
    certificate_short_form: {
      certificate_number: policy.certificate_id,
      policy_number: policy.policy_id,
      policyholder: policy.customer?.name,
      policyholder_address: formatAddressOneLine(policy.customer?.address),
      coverage: wording.coverage_type_label,
      period: `${(policy.period?.start_date || '').slice(0, 10)} → ${(policy.period?.end_date || '').slice(0, 10)}`,
      sum_insured: `${sym}${Number(cov.max_value || 0).toLocaleString('en-GB')}`,
      excess: `${sym}${Number(policy.excess || 0).toLocaleString('en-GB')}`,
    },
  };
}

function verifyCertificateToken(policy, token) {
  if (!policy?.certificate_token || !token) return false;
  return timingSafeEqualString(policy.certificate_token, token);
}

function formatAddressLines(addr) {
  if (!addr || typeof addr !== 'object') return [];
  const lines = [];
  if (addr.line1) lines.push(String(addr.line1));
  if (addr.line2) lines.push(String(addr.line2));
  const cityPost = [addr.city, addr.region || addr.state, addr.postal_code].filter(Boolean).join(', ');
  if (cityPost) lines.push(cityPost);
  if (addr.country) lines.push(String(addr.country));
  return lines;
}

function formatAddressOneLine(addr) {
  return formatAddressLines(addr).join(', ');
}

module.exports = {
  attachCertificateToPolicy,
  refreshCertificateAfterConfirm,
  buildCertificateUrl,
  buildLegacyCertificateUrl,
  buildPublicCertificateDocument,
  verifyCertificateToken,
  formatAddressLines,
  formatAddressOneLine,
  normalizeInsuredItems,
  formatItemsPipeList,
  computePeriodEnd,
  parseDurationToMs,
  publicBaseUrl,
  newCertificateId,
  newCertificateToken,
  currencySymbol,
  defaultCurrencyForJurisdiction,
};
