const express = require('express');
const path = require('path');
const scenarios = require('./scenarios');
const providers = require('./providers');
const store = require('./services/store');
const actuarial = require('./services/actuarial');
const blockchain = require('./services/blockchain');
const insurer = require('./services/insurer');
const compliance = require('./services/compliance');
const fraud = require('./services/fraud');
const partners = require('./services/partners');
const { authMiddleware } = require('./middleware/auth');
const { rateLimitQuote, rateLimitBind } = require('./middleware/rateLimit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10kb' }));

app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-Partner-Id, Authorization',
  });
  next();
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON', code: 'INVALID_JSON' });
  }
  next(err);
});

app.use(express.static(path.join(__dirname, '../frontend')));

const err = (res, status, msg, code = 'VALIDATION_ERROR') =>
  res.status(status).json({ error: msg, code });

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

function aiRateOptions(options, cartValue) {
  if (!options || options.length === 0) return [];
  const adequate = options.filter((o) => (o.coverage || 0) >= cartValue);
  const inadequate = options.filter((o) => (o.coverage || 0) < cartValue);
  const sortByPremium = (a, b) => (a.premium || 0) - (b.premium || 0);
  adequate.sort(sortByPremium);
  inadequate.sort((a, b) => (b.coverage || 0) - (a.coverage || 0));
  return adequate.concat(inadequate);
}

const SCENARIO_LABELS = {
  retail: 'Retail & E-commerce',
  logistics: 'Logistics & Shipping',
  gadgets: 'Gadgets & Electronics',
  hospitality: 'Hospitality & Travel',
  food: 'Food & Delivery',
  healthcare: 'Healthcare',
  events: 'Events & Ticketing',
  mobility: 'Mobility & Gig Economy',
};

function aiSuggestScenario(items) {
  const text = (items || [])
    .map((i) => (i.name || i.description || '').toLowerCase())
    .join(' ');
  if (!text) return 'retail';
  const rules = [
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
    const ranked = aiRateOptions(options, value);

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
    const best = quotes.reduce((a, b) => (a.premium < b.premium ? a : b));
    const premium = best.premium;

    store.recordAnalytics({ type: 'quote', partner_id: req.partnerId, scenario: scenario.id, jurisdiction: comp.jurisdiction });
    res.json({
      quote_id: 'QTY' + Date.now(),
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
    const { quote_id, customer, transaction_id, premium_paid, scenario: scenarioId, provider_id, plan_id, jurisdiction } = req.body || {};

    if (!quote_id?.trim()) return err(res, 400, 'quote_id is required', 'INVALID_QUOTE_ID');
    if (!customer?.email?.includes?.('@')) return err(res, 400, 'customer.email must be a valid email', 'INVALID_EMAIL');
    if (!transaction_id) return err(res, 400, 'transaction_id is required', 'INVALID_TRANSACTION_ID');

    const comp = compliance.complianceCheck({ jurisdiction, scenario: scenarioId });
    if (!comp.valid) return err(res, 400, comp.error || 'Compliance check failed', 'COMPLIANCE_ERROR');

    const existingPolicies = store.policies();
    const fraudResult = fraud.evaluateBind({
      customer,
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

    const scenario = getScenario(scenarioId);
    const provider = providerMap.get(provider_id);
    const plan = planMap.get(`${provider_id}:${plan_id}`);
    const coverage = plan?.coverage ?? scenario.max_value;
    const commissionRate = provider?.commission_rate ?? 0.15;
    const commission = parseFloat((premium * commissionRate).toFixed(2));

    const policyId = 'POL_' + Date.now();
    const bcResult = await blockchain.recordPolicy(policyId, customer?.email, premium, coverage);

    const policy = {
      policy_id: policyId,
      provider_id: provider_id || 'safecover',
      plan_id: plan_id || 'standard',
      provider_name: provider?.name || 'SafeCover',
      premium,
      commission,
      commission_rate: commissionRate,
      transaction_id: transaction_id,
      customer: customer,
      quote_id: quote_id,
      scenario: scenarioId || 'retail',
      jurisdiction: comp.jurisdiction || null,
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
    };

    store.savePolicy(policy);
    store.recordAnalytics({ type: 'bind', policy_id: policyId, premium, commission, partner_id: req.partnerId });

    insurer.forwardToInsurer(policy).catch((e) => {
      console.error('[Insurer] Forward failed for policy', policy.policy_id, e);
    });

    res.json({
      policy_id: policyId,
      provider_id: policy.provider_id,
      plan_id: policy.plan_id,
      provider_name: policy.provider_name,
      smart_contract_url: bcResult.smart_contract_url,
      contract_address: bcResult.contract_address,
      tx_hash: bcResult.tx_hash,
      execution_steps: bcResult.execution_steps,
      constructor_args: bcResult.constructor_args,
      coverage_details: policy.coverage_details,
      fraud_decision: fraudResult.decision,
      fraud_score: fraudResult.score,
    });
  } catch (e) {
    console.error('Policy bind error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/policy/confirm', authMiddleware, (req, res) => {
  try {
    const { policy_id, transaction_id } = req.body || {};

    if (!policy_id?.trim()) return err(res, 400, 'policy_id is required', 'INVALID_POLICY_ID');
    if (!transaction_id) return err(res, 400, 'transaction_id is required', 'INVALID_TRANSACTION_ID');

    res.json({
      policy_id,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
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
    const policy = store.getPolicy(req.params.id);
    if (!policy) return err(res, 404, 'Policy not found', 'NOT_FOUND');
    res.json(policy);
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

app.post('/api/webhook', (req, res) => {
  if (!req.body || typeof req.body !== 'object') {
    return err(res, 400, 'Request body must be a JSON object', 'INVALID_BODY');
  }
  const bodyStr = JSON.stringify(req.body);
  if (bodyStr.length > 64 * 1024) {
    return err(res, 413, 'Webhook payload too large', 'PAYLOAD_TOO_LARGE');
  }
  // Log type/event only; avoid logging full payload (may contain PII)
  const eventType = req.body.event || req.body.type || 'unknown';
  console.log('Webhook received:', eventType);
  res.sendStatus(200);
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
