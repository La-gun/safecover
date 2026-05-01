const express = require('express');
const path = require('path');
const safecoverEnv = require('./config/safecoverEnv');
const scenarios = require('./scenarios');
const providers = require('./providers');
const store = require('./services/store');
const actuarial = require('./services/actuarial');
const blockchain = require('./services/blockchain');
const insurer = require('./services/insurer');
const compliance = require('./services/compliance');
const fraud = require('./services/fraud');
const partners = require('./services/partners');
const coverageOptimizer = require('./services/coverageOptimizer');
const quoteRegistry = require('./services/quoteRegistry');
const insurerCore = require('./services/insurerCore');
const posEnhanced = require('./services/posEnhanced');
const certificateService = require('./services/certificateService');
const policyholderBilling = require('./services/policyholderBilling');
const { authMiddleware } = require('./middleware/auth');
const { rateLimitQuote, rateLimitBind, rateLimitPos } = require('./middleware/rateLimit');
const { securityHeaders, corsMiddleware } = require('./middleware/corsAndSecurity');
const { webhookVerifyMiddleware } = require('./middleware/webhookVerify');

safecoverEnv.validateStartupConfig();

const app = express();

// Reverse proxies (Render, Railway, Fly, etc.): correct req.protocol / host for certificate URLs.
if (process.env.TRUST_PROXY !== '0' && process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, service: 'safecover-api' });
});

const err = (res, status, msg, code = 'VALIDATION_ERROR') =>
  res.status(status).json({ error: msg, code });

app.use(securityHeaders);
app.use(corsMiddleware);

/** POS: allow larger bodies (many line items); register before global express.json limit */
app.post(
  '/api/pos/enhanced',
  express.json({ limit: '128kb' }),
  authMiddleware,
  rateLimitPos,
  (req, res) => posEnhanced.handlePosEnhanced(req, res)
);

app.post(
  '/api/webhook',
  express.raw({ type: 'application/json', limit: '64kb' }),
  webhookVerifyMiddleware,
  (req, res) => {
    try {
      const body = req.webhookJson;
      if (!body || typeof body !== 'object') {
        return err(res, 400, 'Request body must be a JSON object', 'INVALID_BODY');
      }
      const bodyStr = JSON.stringify(body);
      if (bodyStr.length > 64 * 1024) {
        return err(res, 413, 'Webhook payload too large', 'PAYLOAD_TOO_LARGE');
      }
      const eventType = body.event || body.type || 'unknown';
      console.log('Webhook received:', eventType);
      return res.sendStatus(200);
    } catch (e) {
      console.error('Webhook error:', e);
      return err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
    }
  }
);

app.use(express.json({ limit: '10kb' }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON', code: 'INVALID_JSON' });
  }
  next(err);
});

app.use(express.static(path.join(__dirname, '../frontend')));

const defaultScenario = scenarios.retail;

function getScenario(id) {
  return scenarios[id] || defaultScenario;
}

// Provider/plan lookup map for O(1) access
const providerMap = new Map(providers.map((p) => [p.id, p]));
const planMap = new Map();
providers.forEach((p) => {
  (p.plans || []).forEach((pl) => planMap.set(`${p.id}:${pl.id}`, pl));
});

function validateQuoteItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { valid: false, error: 'items must be a non-empty array' };
  const invalid = items.find((i) => typeof i?.value !== 'number' || i.value < 0);
  if (invalid) return { valid: false, error: 'Each item must have a non-negative numeric value' };
  return { valid: true };
}

function buildQuoteOptions(actuarialQuotes) {
  return actuarialQuotes.map((q) => {
    const provider = providerMap.get(q.provider_id);
    const plan = planMap.get(`${q.provider_id}:${q.plan_id}`);
    return {
      provider_id: q.provider_id,
      provider_name: q.provider_name,
      provider_logo: provider?.logo || '🛡️',
      provider_tagline: provider?.tagline || '',
      plan_id: q.plan_id,
      plan_name: q.plan_name,
      premium: q.premium,
      coverage: q.coverage,
      benefits: plan?.benefits || [],
      summary: plan?.summary || '',
      terms_url: provider?.terms_url || '/terms.html',
      quote_id: `QTY_${q.provider_id}_${q.plan_id}_${Date.now()}`,
      actuarial: q.actuarial,
    };
  });
}

app.get('/api/providers', (req, res) => res.json(providers));

app.get('/api/compliance/jurisdictions', (req, res) => {
  res.json({
    supported: compliance.SUPPORTED_JURISDICTIONS,
    default: compliance.getDefaultJurisdiction(),
  });
});

app.post('/api/partners', (req, res) => {
  try {
    const { name, sandbox = true, jurisdiction = 'US' } = req.body || {};
    const partner = partners.createPartner(name || 'New Partner', sandbox, jurisdiction);
    res.status(201).json(partner);
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/partners', authMiddleware, (req, res) => {
  try {
    const list = partners.listPartners();
    res.json({ partners: list });
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/quote/compare', authMiddleware, rateLimitQuote, (req, res) => {
  try {
    const { items, scenario: scenarioId, jurisdiction } = req.body || {};
    const validation = validateQuoteItems(items);
    if (!validation.valid) return err(res, 400, validation.error, 'INVALID_ITEMS');

    const comp = compliance.complianceCheck({ jurisdiction, scenario: scenarioId });
    if (!comp.valid) return err(res, 400, comp.error || 'Compliance check failed', 'COMPLIANCE_ERROR');

    const value = items.reduce((s, i) => s + (i.value || 0), 0);
    const actuarialQuotes = actuarial.generateCompetitiveQuotes(items, scenarioId || 'retail');
    const options = buildQuoteOptions(actuarialQuotes);
    quoteRegistry.registerOptionQuotes(store, {
      partnerId: req.partnerId,
      items,
      jurisdiction: comp.jurisdiction,
      scenario: scenarioId || 'retail',
      options,
    });

    store.recordAnalytics({ type: 'quote', partner_id: req.partnerId, cart_value: value, jurisdiction: comp.jurisdiction });
    res.json({
      cart_value: value,
      options,
      jurisdiction: comp.jurisdiction,
      disclosures: comp.disclosures || compliance.getDisclosures(comp.jurisdiction),
    });
  } catch (e) {
    console.error('Quote compare error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function providerTrustScore(providerId) {
  // Proxy until we have real telemetry / financial strength ratings.
  const base = {
    safecover: 0.90,
    assurex: 0.88,
    shieldpro: 0.87,
    covermax: 0.86,
  };
  return clamp01(base[providerId] ?? 0.85);
}

function estimateClaimsExperienceScore({ scenarioId, option }) {
  const benefitsText = (option?.benefits || []).join(' ').toLowerCase();
  const summaryText = (option?.summary || '').toLowerCase();
  const hasInstant = benefitsText.includes('instant') || summaryText.includes('instant');
  const hasSameDay = benefitsText.includes('same-day') || summaryText.includes('same-day');
  const hasConcierge = benefitsText.includes('concierge') || summaryText.includes('concierge');
  const hasDedicated = benefitsText.includes('dedicated') || summaryText.includes('dedicated');
  const hasPriority = benefitsText.includes('priority') || summaryText.includes('priority');

  const baseDocsByScenario = {
    gadgets: 3,
    jewellery: 4,
    cyber: 3,
    events: 2,
    hospitality: 2,
    logistics: 2,
    retail: 2,
    food: 1,
    healthcare: 2,
    mobility: 2,
    parametric: 0,
  };
  const docsRequired = Math.max(
    0,
    (baseDocsByScenario[scenarioId] ?? 2) - (hasConcierge ? 1 : 0) - (hasDedicated ? 1 : 0) - (hasPriority ? 1 : 0)
  );
  let settleDaysP50 = 10;
  if (scenarioId === 'parametric') settleDaysP50 = 1;
  else if (scenarioId === 'food') settleDaysP50 = 2;
  else if (scenarioId === 'events') settleDaysP50 = 5;
  else if (scenarioId === 'retail' || scenarioId === 'logistics') settleDaysP50 = 7;
  else if (scenarioId === 'gadgets' || scenarioId === 'jewellery') settleDaysP50 = 12;
  if (hasInstant) settleDaysP50 = Math.max(1, Math.round(settleDaysP50 * 0.4));
  if (hasSameDay) settleDaysP50 = Math.min(settleDaysP50, 1);

  const docsScore = clamp01(1 - docsRequired * 0.18);
  const settleScore = clamp01(1 - settleDaysP50 / 20);
  return clamp01(docsScore * 0.55 + settleScore * 0.45);
}

function deductibleScoreProxy({ scenarioId, coverage }) {
  // Proxy deductible when not explicitly modeled per plan.
  // Gadgets/jewellery generally have higher excess; others assume low/no excess.
  const limit = Number(coverage) || 0;
  if (!limit) return 0.7;
  const ratio = (scenarioId === 'gadgets' || scenarioId === 'jewellery') ? 0.02 : 0.0; // 2% vs 0%
  return clamp01(1 - ratio * 4); // 0% => 1, 5% => 0.8, 20% => 0.2
}

function marginScoreProxy(providerId, premium) {
  const p = providerMap.get(providerId);
  const commissionRate = p?.commission_rate ?? 0.15;
  const marginRate = clamp01((commissionRate ?? 0) / 0.2); // 20% => 1
  const affordabilityPenalty = clamp01(1 - (Number(premium) || 0) / 2.0); // keep very high premiums in check
  return clamp01(marginRate * 0.7 + affordabilityPenalty * 0.3);
}

function aiRateOptions(options, cartValue, scenarioId = 'retail') {
  if (!options || options.length === 0) return [];
  const value = Number(cartValue) || 0;

  const scored = options.map((o) => {
    const coverage = Number(o.coverage) || 0;
    const premium = Number(o.premium) || 0;
    const coverageRatio = value > 0 ? coverage / value : 0;
    const coverageScore = clamp01(coverageRatio >= 1 ? 1 : coverageRatio);

    // Price sensitivity as a secondary factor (not "lowest price wins").
    const premiumToValue = value > 0 ? premium / value : 1;
    const affordabilityScore = clamp01(1 - premiumToValue * 40); // 0.3% => high, 3% => low

    const trust = providerTrustScore(o.provider_id);
    const claims = estimateClaimsExperienceScore({ scenarioId, option: o });
    const deductible = deductibleScoreProxy({ scenarioId, coverage });
    const margin = marginScoreProxy(o.provider_id, premium);

    // Priority: claims experience + trust + adequate cover; price is secondary.
    const overall = clamp01(
      claims * 0.35 +
      trust * 0.20 +
      coverageScore * 0.25 +
      deductible * 0.10 +
      affordabilityScore * 0.05 +
      margin * 0.05
    );

    return {
      ...o,
      ai: {
        scenario: scenarioId,
        scores: {
          overall: Number(overall.toFixed(4)),
          claims: Number(claims.toFixed(4)),
          trust: Number(trust.toFixed(4)),
          coverage: Number(coverageScore.toFixed(4)),
          deductible: Number(deductible.toFixed(4)),
          affordability: Number(affordabilityScore.toFixed(4)),
          margin: Number(margin.toFixed(4)),
        },
      },
    };
  });

  scored.sort((a, b) => (b.ai.scores.overall - a.ai.scores.overall) || ((a.premium || 0) - (b.premium || 0)));
  return scored;
}

const SCENARIO_LABELS = {
  retail: 'Retail & E-commerce',
  logistics: 'Logistics & Shipping',
  gadgets: 'Gadgets & Electronics',
  hospitality: 'Hospitality & Travel',
  food: 'Food & Delivery',
  healthcare: 'Healthcare',
  cyber: 'Cyber & Digital',
  events: 'Events & Ticketing',
  mobility: 'Mobility & Gig Economy',
  parametric: 'Parametric (Climate/Events)',
  jewellery: 'Jewellery & Watch',
};

function aiSuggestScenario(items) {
  const text = (items || [])
    .map((i) => (i.name || i.description || '').toLowerCase())
    .join(' ');
  if (!text) return 'retail';
  const rules = [
    { keywords: ['ring', 'necklace', 'bracelet', 'watch', 'jewellery', 'jewelry', 'diamond', 'gold', 'silver', 'rolex', 'cartier'], scenario: 'jewellery' },
    { keywords: ['laptop', 'phone', 'tablet', 'headphone', 'cable', 'charger', 'electronic', 'gadget', 'device', 'usb', 'stand'], scenario: 'gadgets' },
    { keywords: ['food', 'meal', 'delivery', 'restaurant', 'grocer'], scenario: 'food' },
    { keywords: ['ticket', 'event', 'concert', 'show', 'game'], scenario: 'events' },
    { keywords: ['hotel', 'flight', 'trip', 'travel', 'vacation', 'booking'], scenario: 'hospitality' },
    { keywords: ['appointment', 'doctor', 'health', 'medical', 'clinic'], scenario: 'healthcare' },
    { keywords: ['ship', 'package', 'delivery', 'freight', 'cargo'], scenario: 'logistics' },
    { keywords: ['ride', 'uber', 'lyft', 'driver', 'gig'], scenario: 'mobility' },
  ];
  for (const rule of rules) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.scenario;
  }
  return 'retail';
}

app.post('/api/quote/rate', authMiddleware, rateLimitQuote, (req, res) => {
  try {
    const { items, scenario: scenarioId, jurisdiction } = req.body || {};
    const validation = validateQuoteItems(items);
    if (!validation.valid) return err(res, 400, validation.error, 'INVALID_ITEMS');

    const suggestedScenario = scenarioId || aiSuggestScenario(items);
    const comp = compliance.complianceCheck({ jurisdiction, scenario: suggestedScenario });
    if (!comp.valid) return err(res, 400, comp.error || 'Compliance check failed', 'COMPLIANCE_ERROR');

    const value = items.reduce((s, i) => s + (i.value || 0), 0);
    const actuarialQuotes = actuarial.generateCompetitiveQuotes(items, suggestedScenario);
    const options = buildQuoteOptions(actuarialQuotes);
    const ranked = aiRateOptions(options, value, suggestedScenario);
    quoteRegistry.registerOptionQuotes(store, {
      partnerId: req.partnerId,
      items,
      jurisdiction: comp.jurisdiction,
      scenario: suggestedScenario,
      options: ranked,
    });

    store.recordAnalytics({ type: 'quote', partner_id: req.partnerId, cart_value: value, jurisdiction: comp.jurisdiction });
    res.json({
      cart_value: value,
      options: ranked,
      recommended: ranked[0] || null,
      suggested_scenario: suggestedScenario,
      jurisdiction: comp.jurisdiction,
      disclosures: comp.disclosures || compliance.getDisclosures(comp.jurisdiction),
    });
  } catch (e) {
    console.error('Quote rate error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

/**
 * Coverage recommendations endpoint (rules-first + deterministic ranking)
 * - If caller passes `candidates`, we rank them.
 * - Else, we build candidates from `checkout.items` using category->scenario mapping.
 */
app.post('/api/coverage/recommendations', authMiddleware, rateLimitQuote, (req, res) => {
  try {
    const correlationId = req.get('X-Correlation-Id') || req.body?.correlationId || `corr_${Date.now()}`;
    const { checkout, candidates, policyPreference } = req.body || {};

    let builtCandidates = candidates;
    if (!Array.isArray(builtCandidates) || builtCandidates.length === 0) {
      const items = Array.isArray(checkout?.items) ? checkout.items : [];
      // Reuse scenario suggestion if categories are missing
      const scenarioHint = aiSuggestScenario(
        items.map((i) => ({
          name: i.name,
          description: i.description,
          value: i.unitPrice ?? i.value,
        }))
      );
      builtCandidates = coverageOptimizer.buildCandidatesFromCheckout({
        checkout,
        scenarioHint,
        currency: 'NGN',
      });
    }

    const result = coverageOptimizer.recommend({
      correlationId,
      candidates: builtCandidates,
      policyPreference: policyPreference || { defaultStructure: 'PER_LINE', allowPerItemIfRequired: true },
    });

    // Minimal audit trail (avoid raw PII)
    const checkoutId = checkout?.checkoutId || req.body?.checkoutId || 'unknown';
    store.recordAnalytics({
      type: 'quote',
      partner_id: req.partnerId,
      correlation_id: correlationId,
      checkout_id: checkoutId,
      event: 'coverage_recommendations',
    });
    try {
      (result.recommendations || []).forEach((r) => {
        store.appendAuditLog('coverage_recommendation', `${checkoutId}:${r.productId}`, {
          correlation_id: correlationId,
          product_id: r.productId,
          selected: r.selected,
          scores: r.scores,
          policy_structure: r.policyStructure,
          model_version: r.audit?.modelVersion,
        });
      });
    } catch (e) {
      // Non-fatal
      console.warn('Audit append failed:', e.message);
    }

    res.json({
      correlationId,
      checkoutId,
      recommendations: result.recommendations || [],
      warnings: result.warnings || [],
    });
  } catch (e) {
    console.error('Coverage recommendations error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/quote', authMiddleware, rateLimitQuote, (req, res) => {
  try {
    const { items, scenario: scenarioId, jurisdiction } = req.body || {};
    const validation = validateQuoteItems(items);
    if (!validation.valid) return err(res, 400, validation.error, 'INVALID_ITEMS');

    const comp = compliance.complianceCheck({ jurisdiction, scenario: scenarioId });
    if (!comp.valid) return err(res, 400, comp.error || 'Compliance check failed', 'COMPLIANCE_ERROR');

    const scenario = getScenario(scenarioId);
    const value = items.reduce((s, i) => s + (i.value || 0), 0);
    const quotes = actuarial.generateCompetitiveQuotes(items, scenarioId || 'retail');
    if (!quotes.length) {
      return err(res, 503, 'No quotes available (no providers/plans configured)', 'NO_QUOTES');
    }
    const best = quotes.reduce((a, b) => (a.premium < b.premium ? a : b));
    const premium = best.premium;
    const quoteId = 'QTY' + Date.now();
    quoteRegistry.registerQuote(store, {
      quote_id: quoteId,
      partner_id: req.partnerId,
      items,
      premium,
      provider_id: best.provider_id,
      plan_id: best.plan_id,
      scenario: scenario.id,
      jurisdiction: comp.jurisdiction,
    });

    store.recordAnalytics({ type: 'quote', partner_id: req.partnerId, scenario: scenario.id, jurisdiction: comp.jurisdiction });
    res.json({
      quote_id: quoteId,
      premium,
      scenario: scenario.id,
      jurisdiction: comp.jurisdiction,
      disclosures: comp.disclosures,
      actuarial: best.actuarial,
      coverage: {
        type: scenario.coverage_type,
        max_value: scenario.max_value,
        duration: scenario.duration,
      },
    });
  } catch (e) {
    console.error('Quote error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/policy/bind', authMiddleware, rateLimitBind, async (req, res) => {
  try {
    const {
      quote_id,
      customer,
      transaction_id,
      premium_paid,
      scenario: scenarioId,
      provider_id,
      plan_id,
      jurisdiction,
      items,
    } = req.body || {};

    if (!quote_id?.trim()) return err(res, 400, 'quote_id is required', 'INVALID_QUOTE_ID');
    if (!customer?.email?.includes?.('@')) return err(res, 400, 'customer.email must be a valid email', 'INVALID_EMAIL');
    if (!transaction_id) return err(res, 400, 'transaction_id is required', 'INVALID_TRANSACTION_ID');

    const customerNorm = policyholderBilling.normalizeCustomerInput(req.body);
    if (!customerNorm.email.includes('@')) {
      return err(res, 400, 'customer.email must be a valid email', 'INVALID_EMAIL');
    }
    const billingCheck = policyholderBilling.validateBindCustomerAndBilling(
      customerNorm,
      req.body.billing,
      {}
    );
    if (!billingCheck.ok) {
      return err(res, 400, billingCheck.error, billingCheck.code || 'BILLING_VALIDATION_ERROR');
    }
    const customerForPolicy = billingCheck.customer;

    const offering = insurerCore.validateOffering({ jurisdiction, scenario: scenarioId, items });
    if (!offering.ok) {
      return err(res, 400, offering.error || 'Product offering not permitted', 'COMPLIANCE_ERROR');
    }

    const bindIdem = req.get('X-Bind-Idempotency-Key')?.trim() || req.body?.bind_idempotency_key?.trim();
    if (bindIdem) {
      const existing = store.getPolicyByBindIdempotency(bindIdem);
      if (existing) {
        const cert = existing.certificate_url || certificateService.buildCertificateUrl(req, existing);
        return res.json({
          policy_id: existing.policy_id,
          certificate_id: existing.certificate_id,
          provider_id: existing.provider_id,
          plan_id: existing.plan_id,
          provider_name: existing.provider_name,
          certificate_url: cert,
          smart_contract_url: existing.smart_contract_url,
          contract_address: existing.contract_address,
          tx_hash: existing.tx_hash,
          execution_steps: existing.execution_steps,
          constructor_args: existing.constructor_args,
          coverage_details: existing.coverage_details,
          fraud_decision: existing.fraud_decision,
          fraud_score: existing.fraud_score,
          status: existing.status,
          idempotent: true,
        });
      }
    }

    const quoteEval = quoteRegistry.evaluateQuoteForBind(store, {
      quote_id,
      premium_paid,
      provider_id,
      plan_id,
      scenario: scenarioId,
      items,
      bind_partner_id: req.partnerId,
    });
    if (!quoteEval.ok) {
      return err(res, 400, quoteEval.error, quoteEval.code || 'QUOTE_ERROR');
    }

    const existingPolicies = store.policies();
    const fraudResult = fraud.evaluateBind({
      customer: customerForPolicy,
      transaction_id,
      quote_id,
      existingPolicies,
    });
    if (fraudResult.decision === 'BLOCK') {
      return err(res, 403, 'Transaction blocked by fraud rules', 'FRAUD_BLOCK');
    }

    const premium = parseFloat(premium_paid);
    if (isNaN(premium) || premium < 0) {
      return err(res, 400, 'premium_paid must be a non-negative number', 'INVALID_PREMIUM');
    }

    const effProvider = provider_id || quoteEval.record?.provider_id || 'safecover';
    const effPlan = plan_id || quoteEval.record?.plan_id || 'standard';
    const scenario = getScenario(scenarioId);
    const provider = providerMap.get(effProvider);
    const plan = planMap.get(`${effProvider}:${effPlan}`);
    const coverage = plan?.coverage ?? scenario.max_value;
    const commissionRate = provider?.commission_rate ?? 0.15;
    const commission = parseFloat((premium * commissionRate).toFixed(2));

    const policyId = 'POL_' + Date.now();
    const bcResult = await blockchain.recordPolicy(policyId, customerForPolicy.email, premium, coverage);

    let policy = {
      policy_id: policyId,
      provider_id: effProvider,
      plan_id: effPlan,
      provider_name: provider?.name || 'SafeCover',
      premium,
      commission,
      commission_rate: commissionRate,
      transaction_id: transaction_id,
      customer: customerForPolicy,
      quote_id: quote_id,
      scenario: scenarioId || 'retail',
      jurisdiction: offering.jurisdiction || null,
      fraud_decision: fraudResult.decision,
      fraud_score: fraudResult.score,
      fraud_reasons: fraudResult.reasons,
      coverage_details: {
        type: scenario.coverage_type,
        max_value: coverage,
        duration: scenario.duration,
      },
      smart_contract_url: bcResult.smart_contract_url,
      tx_hash: bcResult.tx_hash,
      contract_address: bcResult.contract_address,
      execution_steps: bcResult.execution_steps,
      constructor_args: bcResult.constructor_args,
      recorded_at: new Date().toISOString(),
      partner_id: req.partnerId,
      status: 'PENDING_PAYMENT',
      bind_idempotency_key: bindIdem || null,
    };
    policy = insurerCore.attachRegulatorySnapshot(policy);
    policy = certificateService.attachCertificateToPolicy(policy, req, {
      scenario,
      plan,
      provider,
      items: Array.isArray(items) ? items : [],
      partnerId: req.partnerId,
      planName: plan?.name,
    });

    store.savePolicy(policy);
    if (quoteEval.record) store.consumeQuoteRecord(quote_id);
    store.recordAnalytics({ type: 'bind', policy_id: policyId, premium, commission, partner_id: req.partnerId });

    insurer.forwardToInsurer(policy).catch((e) => {
      console.error('[Insurer] Forward failed for policy', policy.policy_id, e);
    });

    res.json({
      policy_id: policyId,
      certificate_id: policy.certificate_id,
      provider_id: policy.provider_id,
      plan_id: policy.plan_id,
      provider_name: policy.provider_name,
      certificate_url: policy.certificate_url,
      smart_contract_url: bcResult.smart_contract_url,
      contract_address: bcResult.contract_address,
      tx_hash: bcResult.tx_hash,
      execution_steps: bcResult.execution_steps,
      constructor_args: bcResult.constructor_args,
      coverage_details: policy.coverage_details,
      fraud_decision: fraudResult.decision,
      fraud_score: fraudResult.score,
      status: policy.status,
      disclosures: offering.disclosures,
    });
  } catch (e) {
    console.error('Policy bind error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/policy/confirm', authMiddleware, (req, res) => {
  try {
    const { policy_id, transaction_id, payment_reference } = req.body || {};

    if (!policy_id?.trim()) return err(res, 400, 'policy_id is required', 'INVALID_POLICY_ID');
    if (!transaction_id) return err(res, 400, 'transaction_id is required', 'INVALID_TRANSACTION_ID');

    const policy = store.getPolicy(policy_id);
    if (!policy) return err(res, 404, 'Policy not found', 'POLICY_NOT_FOUND');
    if (policy.transaction_id !== transaction_id) {
      return err(res, 400, 'transaction_id does not match policy', 'TRANSACTION_MISMATCH');
    }

    if (policy.status === 'ACTIVE') {
      return res.json({
        policy_id,
        status: policy.status,
        confirmed_at: policy.confirmed_at,
        payment_reference: policy.payment_reference || null,
        certificate_url: policy.certificate_url || certificateService.buildCertificateUrl(req, policy),
        idempotent: true,
      });
    }

    if (policy.status !== 'PENDING_PAYMENT') {
      return err(res, 400, 'Policy cannot be confirmed from current status', 'INVALID_POLICY_STATE');
    }

    const confirmedAt = new Date().toISOString();
    let updated = store.updatePolicy(policy_id, {
      status: 'ACTIVE',
      confirmed_at: confirmedAt,
      payment_reference: payment_reference || null,
      actor: req.partnerId || 'system',
    });
    const refreshed = certificateService.refreshCertificateAfterConfirm(
      { ...updated, confirmed_at: confirmedAt },
      req
    );
    updated = store.updatePolicy(policy_id, {
      period: refreshed.period,
      certificate_url: refreshed.certificate_url,
    });

    res.json({
      policy_id,
      status: updated.status,
      confirmed_at: updated.confirmed_at,
      payment_reference: updated.payment_reference,
      certificate_url: updated.certificate_url,
    });
  } catch (e) {
    console.error('Policy confirm error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/claim', authMiddleware, (req, res) => {
  try {
    const { policy_id, claim_type, description, amount } = req.body || {};

    if (!policy_id?.trim()) return err(res, 400, 'policy_id is required', 'INVALID_POLICY_ID');

    const policy = store.getPolicy(policy_id);
    if (!policy) return err(res, 404, 'Policy not found', 'POLICY_NOT_FOUND');
    if (policy.status !== 'ACTIVE') {
      return err(res, 400, 'Claims are only accepted for active (confirmed) policies', 'POLICY_NOT_ACTIVE');
    }

    const claimId = 'CLM_' + Date.now();
    const claim = {
      claim_id: claimId,
      policy_id,
      claim_type: claim_type || 'manual',
      description: description || '',
      amount: amount ? parseFloat(amount) : null,
      status: 'submitted',
      created_at: new Date().toISOString(),
    };

    store.saveClaim(claim);
    store.recordAnalytics({ type: 'claim', claim_id: claimId, policy_id });

    res.status(201).json({
      claim_id: claimId,
      policy_id,
      status: 'submitted',
      message: 'Claim submitted for review',
    });
  } catch (e) {
    console.error('Claim error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/claim/trigger', authMiddleware, (req, res) => {
  try {
    const { policy_id, trigger_type, trigger_data } = req.body || {};

    if (!policy_id?.trim()) return err(res, 400, 'policy_id is required', 'INVALID_POLICY_ID');
    if (!trigger_type) return err(res, 400, 'trigger_type is required', 'INVALID_TRIGGER');

    const policy = store.getPolicy(policy_id);
    if (!policy) return err(res, 404, 'Policy not found', 'POLICY_NOT_FOUND');
    if (policy.status !== 'ACTIVE') {
      return err(res, 400, 'Parametric triggers require an active policy', 'POLICY_NOT_ACTIVE');
    }

    const claimId = 'CLM_' + Date.now();
    const claim = {
      claim_id: claimId,
      policy_id,
      claim_type: 'parametric',
      trigger_type,
      trigger_data: trigger_data || {},
      status: 'triggered',
      created_at: new Date().toISOString(),
    };

    store.saveClaim(claim);
    store.recordAnalytics({ type: 'claim', claim_id: claimId, policy_id, trigger_type });

    res.status(201).json({
      claim_id: claimId,
      policy_id,
      status: 'triggered',
      message: 'Parametric trigger processed. Payout initiated.',
    });
  } catch (e) {
    console.error('Claim trigger error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/claims', authMiddleware, (req, res) => {
  try {
    const { policy_id, email, limit = 50 } = req.query;
    let claims = store.claims();
    if (policy_id) claims = claims.filter((c) => c.policy_id === policy_id);
    if (email) {
      const policyIds = store.policies().filter((p) => p.customer?.email === email).map((p) => p.policy_id);
      claims = claims.filter((c) => policyIds.includes(c.policy_id));
    }
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    claims = claims.slice(0, safeLimit).reverse();
    res.json({ claims });
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/audit/:entityType/:entityId', authMiddleware, (req, res) => {
  try {
    const log = store.getAuditLog(req.params.entityType, req.params.entityId, 50);
    res.json({ audit_log: log });
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/claim/:id', authMiddleware, (req, res) => {
  try {
    const claim = store.claims().find((c) => c.claim_id === req.params.id);
    if (!claim) return err(res, 404, 'Claim not found', 'NOT_FOUND');
    const policy = store.getPolicy(claim.policy_id);
    res.json({ ...claim, policy });
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.patch('/api/claim/:id', authMiddleware, (req, res) => {
  try {
    const { status, payout_amount } = req.body || {};
    const claim = store.claims().find((c) => c.claim_id === req.params.id);
    if (!claim) return err(res, 404, 'Claim not found', 'NOT_FOUND');
    const updates = {};
    if (status) updates.status = status;
    if (payout_amount != null) updates.payout_amount = parseFloat(payout_amount);
    if (status === 'approved' || status === 'paid') updates.payout_at = new Date().toISOString();
    const updated = store.updateClaim(req.params.id, updates);
    res.json(updated);
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/policies', authMiddleware, (req, res) => {
  try {
    const { email, limit = 50 } = req.query;
    let policies = store.policies();
    if (email) policies = policies.filter((p) => p.customer?.email === email);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    policies = policies.slice(-safeLimit).reverse();
    res.json({ policies });
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/policy/:id', authMiddleware, (req, res) => {
  try {
    let policy = store.getPolicy(req.params.id);
    if (!policy) return err(res, 404, 'Policy not found', 'NOT_FOUND');
    if (!policy.certificate_token) {
      const scenario = getScenario(policy.scenario);
      const provider = providerMap.get(policy.provider_id);
      const plan = planMap.get(`${policy.provider_id}:${policy.plan_id}`);
      const itemsFromPolicy = Array.isArray(policy.insured_items)
        ? policy.insured_items.map((i) => ({
            name: i.description,
            value: i.value,
            sku: i.sku,
          }))
        : [];
      policy = certificateService.attachCertificateToPolicy(policy, req, {
        scenario,
        plan,
        provider,
        items: itemsFromPolicy,
        partnerId: policy.partner_id,
        planName: plan?.name,
      });
      store.savePolicy(policy);
    } else if (!policy.certificate_url) {
      policy.certificate_url = certificateService.buildCertificateUrl(req, policy);
      store.savePolicy(policy);
    }
    res.json(policy);
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/policy/:id/certificate', (req, res) => {
  try {
    const policy = store.getPolicy(req.params.id);
    if (!policy) return err(res, 404, 'Policy not found', 'NOT_FOUND');
    const url = policy.certificate_url || certificateService.buildCertificateUrl(req, policy);
    res.redirect(302, url);
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

/** Machine-readable schedule + certificate (authenticated). */
app.get('/api/policy/:id/schedule', authMiddleware, (req, res) => {
  try {
    const policy = store.getPolicy(req.params.id);
    if (!policy) return err(res, 404, 'Policy not found', 'NOT_FOUND');
    res.json(certificateService.buildPublicCertificateDocument(policy));
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

/**
 * Public certificate JSON for the HTML viewer (token required).
 * Query: token — must match policy.certificate_token (constant-time compare).
 */
app.get('/api/public/certificate/:policy_id', (req, res) => {
  try {
    const policy = store.getPolicy(req.params.policy_id);
    if (!policy) return err(res, 404, 'Policy not found', 'NOT_FOUND');
    const token = req.query.token || req.get('X-Certificate-Token');
    if (!certificateService.verifyCertificateToken(policy, token)) {
      return err(res, 403, 'Invalid or missing certificate token', 'CERTIFICATE_FORBIDDEN');
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(certificateService.buildPublicCertificateDocument(policy));
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/analytics', authMiddleware, (req, res) => {
  try {
    const data = store.getAnalytics();
    const policies = store.policies();
    const claims = store.claims();
    const totalPremium = policies.reduce((s, p) => s + (p.premium || 0), 0);
    const totalCommission = policies.reduce((s, p) => s + (p.commission || 0), 0);

    res.json({
      quotes: data.quotes || 0,
      binds: data.binds || 0,
      claims: data.claims || 0,
      total_premium: parseFloat(totalPremium.toFixed(2)),
      total_commission: parseFloat(totalCommission.toFixed(2)),
      policies_count: policies.length,
      claims_count: claims.length,
    });
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/api/actuarial/backtest', authMiddleware, (req, res) => {
  try {
    const backtest = require('./scripts/actuarial-backtest');
    const result = backtest.runBacktest();
    res.json(result);
  } catch (e) {
    console.error('Backtest error:', e);
    err(res, 500, 'Backtest failed', 'INTERNAL_ERROR');
  }
});

app.get('/api/contract/simulate', authMiddleware, (req, res) => {
  try {
    const { policy_id, insured, premium, coverage } = req.query;
    const result = blockchain.simulateContractExecution(
      policy_id || 'POL_DEMO',
      insured || 'customer@example.com',
      parseFloat(premium) || 0.34,
      parseInt(coverage, 10) || 1000
    );
    res.json(result);
  } catch (e) {
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.get('/', (req, res) => {
  const scenario = process.env.SCENARIO;
  if (scenario) {
    return res.redirect(`/scenarios/scenario-${scenario}.html`);
  }
  res.redirect('/checkout-ux-demo.html');
});

app.get('/api/scenarios', (req, res) => {
  res.json(Object.values(scenarios));
});

app.use((req, res) => err(res, 404, 'Not found', 'NOT_FOUND'));

app.use((e, req, res, next) => {
  console.error('Error:', e);
  err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
});

app.listen(PORT, () => {
  console.log(`\n  SafeCover running at http://localhost:${PORT}`);
  console.log(`  - API:       http://localhost:${PORT}/api`);
  console.log(`  - Portal:    http://localhost:${PORT}/portal.html`);
  console.log(`  - E2E (10):  http://localhost:${PORT}/e2e-scenarios.html`);
  console.log(`  - Providers: http://localhost:${PORT}/providers-demo.html`);
  console.log(`  - Scenarios: http://localhost:${PORT}/scenarios-demo.html`);
  console.log(`  - Demo:      http://localhost:${PORT}/checkout-ux-demo.html`);
  console.log(`  - Flow:     http://localhost:${PORT}/flow-demo.html`);
  console.log(`  - Contract:  http://localhost:${PORT}/contract-demo.html`);
  console.log(`  - Actuarial: http://localhost:${PORT}/actuarial-demo.html`);
  console.log(`  - Claims:    http://localhost:${PORT}/claims.html`);
  console.log(`  - Partners:  http://localhost:${PORT}/partner-dashboard.html`);
  console.log(`  - Coverage:  http://localhost:${PORT}/coverage-demo.html`);
  console.log(`  - Widget:    http://localhost:${PORT}/widget.html\n`);
});
