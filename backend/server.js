const express = require('express');
const path = require('path');
const scenarios = require('./scenarios');
const providers = require('./providers');
const store = require('./services/store');
const blockchain = require('./services/blockchain');
const insurer = require('./services/insurer');
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

app.get('/api/providers', (req, res) => res.json(providers));

app.post('/api/quote/compare', authMiddleware, rateLimitQuote, (req, res) => {
  try {
    const { items, scenario: scenarioId, jurisdiction } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return err(res, 400, 'items must be a non-empty array', 'INVALID_ITEMS');
    }
    const invalid = items.find((i) => typeof i?.value !== 'number' || i.value < 0);
    if (invalid) return err(res, 400, 'Each item must have a non-negative numeric value', 'INVALID_ITEM_VALUE');

    const value = items.reduce((s, i) => s + (i.value || 0), 0);
    const options = [];

    providers.forEach((provider) => {
      provider.plans.forEach((plan) => {
        const premium = parseFloat((value * plan.premium_rate).toFixed(2));
        options.push({
          provider_id: provider.id,
          provider_name: provider.name,
          provider_logo: provider.logo,
          provider_tagline: provider.tagline,
          plan_id: plan.id,
          plan_name: plan.name,
          premium,
          coverage: plan.coverage,
          benefits: plan.benefits,
          summary: plan.summary || '',
          terms_url: provider.terms_url || '/terms.html',
          quote_id: `QTY_${provider.id}_${plan.id}_${Date.now()}`,
        });
      });
    });

    store.recordAnalytics({ type: 'quote', partner_id: req.partnerId, cart_value: value, jurisdiction });
    res.json({ cart_value: value, options, jurisdiction: jurisdiction || null });
  } catch (e) {
    console.error('Quote compare error:', e);
    err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
});

app.post('/api/quote', authMiddleware, rateLimitQuote, (req, res) => {
  try {
    const { items, scenario: scenarioId, jurisdiction } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return err(res, 400, 'items must be a non-empty array', 'INVALID_ITEMS');
    }
    const invalid = items.find((i) => typeof i?.value !== 'number' || i.value < 0);
    if (invalid) return err(res, 400, 'Each item must have a non-negative numeric value', 'INVALID_ITEM_VALUE');

    const scenario = getScenario(scenarioId);
    const value = items.reduce((s, i) => s + (i.value || 0), 0);
    const rate = scenario.premium_rate || 0.003;
    const premium = parseFloat((value * rate).toFixed(2));

    store.recordAnalytics({ type: 'quote', partner_id: req.partnerId, scenario: scenario.id, jurisdiction });
    res.json({
      quote_id: 'QTY' + Date.now(),
      premium,
      scenario: scenario.id,
      jurisdiction: jurisdiction || null,
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

    const premium = parseFloat(premium_paid);
    if (isNaN(premium) || premium < 0) {
      return err(res, 400, 'premium_paid must be a non-negative number', 'INVALID_PREMIUM');
    }

    const scenario = getScenario(scenarioId);
    const provider = providers.find((p) => p.id === provider_id);
    const plan = provider?.plans?.find((p) => p.id === plan_id);
    const coverage = plan?.coverage ?? scenario.max_value;
    const commissionRate = provider?.commission_rate ?? 0.15;
    const commission = parseFloat((premium * commissionRate).toFixed(2));

    const policyId = 'POL_' + Date.now();
    const bcResult = blockchain.recordPolicy(policyId, customer?.email, premium, coverage);

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
      jurisdiction: jurisdiction || null,
      coverage_details: {
        type: scenario.coverage_type,
        max_value: coverage,
        duration: scenario.duration,
      },
      smart_contract_url: bcResult.smart_contract_url,
      tx_hash: bcResult.tx_hash,
      contract_address: bcResult.contract_address,
      recorded_at: new Date().toISOString(),
      partner_id: req.partnerId,
    };

    store.savePolicy(policy);
    store.recordAnalytics({ type: 'bind', policy_id: policyId, premium, commission, partner_id: req.partnerId });

    insurer.forwardToInsurer(policy).catch(() => {});

    res.json({
      policy_id: policyId,
      provider_id: policy.provider_id,
      plan_id: policy.plan_id,
      provider_name: policy.provider_name,
      smart_contract_url: bcResult.smart_contract_url,
      contract_address: bcResult.contract_address,
      coverage_details: policy.coverage_details,
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

app.get('/api/policies', authMiddleware, (req, res) => {
  try {
    const { email, limit = 50 } = req.query;
    let policies = store.policies();
    if (email) policies = policies.filter((p) => p.customer?.email === email);
    policies = policies.slice(-limit).reverse();
    res.json({ policies });
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
  console.log('Webhook:', req.body);
  res.sendStatus(200);
});

app.get('/', (req, res) => res.redirect('/checkout-ux-demo.html'));

app.use((req, res) => err(res, 404, 'Not found', 'NOT_FOUND'));

app.use((e, req, res, next) => {
  console.error('Error:', e);
  err(res, 500, 'Internal server error', 'INTERNAL_ERROR');
});

app.get('/api/scenarios', (req, res) => {
  res.json(Object.values(scenarios));
});

app.listen(PORT, () => {
  console.log(`\n  SafeCover running at http://localhost:${PORT}`);
  console.log(`  - API:       http://localhost:${PORT}/api`);
  console.log(`  - Portal:    http://localhost:${PORT}/portal.html`);
  console.log(`  - E2E (10):  http://localhost:${PORT}/e2e-scenarios.html`);
  console.log(`  - Providers: http://localhost:${PORT}/providers-demo.html`);
  console.log(`  - Scenarios: http://localhost:${PORT}/scenarios-demo.html`);
  console.log(`  - Demo:      http://localhost:${PORT}/checkout-ux-demo.html`);
  console.log(`  - Widget:    http://localhost:${PORT}/widget.html\n`);
});
