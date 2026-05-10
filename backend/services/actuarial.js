/**
 * Competitive actuarial risk model for micro-insurance quotes
 *
 * Model: Gross Premium = Pure Premium × (1 + expense loading) × (1 + profit margin) × risk factors
 * Pure Premium = E[Loss] = λ × E[S] where λ = loss frequency, E[S] = expected severity
 *
 * Risk factors: exposure (value), coverage limit, duration, scenario, provider competitiveness
 */
const scenarios = require('../scenarios');
const providers = require('../providers');

// Base loss frequency (claims per 1000 exposures) by scenario - industry benchmarks
const BASE_FREQUENCY = {
  retail: 2.1,
  logistics: 3.2,
  healthcare: 4.5,
  hospitality: 2.8,
  food: 5.0,
  cyber: 1.2,
  mobility: 1.8,
  parametric: 3.5,
  gadgets: 8.0,
  events: 6.0,
  jewellery: 1.5,
  default: 2.5,
};

// Severity factor: expected loss as % of insured value (higher value = slightly lower % due to diversification)
function severityFactor(insuredValue, coverageLimit) {
  const cappedValue = Math.min(insuredValue, coverageLimit);
  // Power law: severity decreases slightly with value (economies of scale in claims)
  const base = 0.15; // 15% of value at $100
  const scale = Math.pow(100 / Math.max(cappedValue, 10), 0.1);
  return Math.min(base * scale, 0.5);
}

// Duration factor: longer coverage = higher risk (linear approximation)
function durationFactor(durationStr) {
  const days = parseDurationDays(durationStr);
  return 1 + (days / 365) * 0.5; // 50% loading per year
}

function parseDurationDays(s) {
  if (!s || typeof s !== 'string') return 7;
  const m = s.match(/(\d+)\s*(day|month|year)/i);
  if (!m) return 7;
  const n = parseInt(m[1], 10);
  if (/day/i.test(m[2])) return n;
  if (/month/i.test(m[2])) return n * 30;
  if (/year/i.test(m[2])) return n * 365;
  return n;
}

// Coverage limit factor: higher limit = more exposure
function limitFactor(insuredValue, coverageLimit) {
  const ratio = coverageLimit / Math.max(insuredValue, 1);
  return Math.min(1 + Math.log(1 + ratio) * 0.2, 2.0);
}

// Provider competitiveness: risk appetite and target margin per insurer
const FIXED_MODIFIERS = {
  safecover: { riskAppetite: 1.0, targetMargin: 0.15 },
  shieldpro: { riskAppetite: 0.95, targetMargin: 0.18 },
  covermax: { riskAppetite: 1.05, targetMargin: 0.12 },
  assurex: { riskAppetite: 1.02, targetMargin: 0.14 },
};

/**
 * Compute pure premium (expected loss) for a given exposure
 * E[Loss] = λ/1000 × value × severityFactor × limitFactor × durationFactor
 */
function purePremium(params) {
  const {
    insuredValue,
    coverageLimit,
    scenarioId = 'retail',
    duration,
    providerId,
    planId,
  } = params;

  const scenario = scenarios[scenarioId] || scenarios.retail;
  const lambda = (BASE_FREQUENCY[scenarioId] || BASE_FREQUENCY.default) / 1000;
  const sev = severityFactor(insuredValue, coverageLimit || scenario.max_value);
  const lim = limitFactor(insuredValue, coverageLimit || scenario.max_value);
  const dur = durationFactor(duration || scenario.duration);

  const mod = FIXED_MODIFIERS[providerId] || { riskAppetite: 1, targetMargin: 0.15 };
  const riskAppetite = mod.riskAppetite;

  const expectedLoss = insuredValue * lambda * sev * lim * dur * riskAppetite;
  return Math.min(expectedLoss, coverageLimit || scenario.max_value);
}

/**
 * Gross premium with expense loading and profit margin
 * expense_loading: 25% (acquisition, admin, claims handling)
 * profit_margin: provider-specific 12–20%
 */
function grossPremium(params) {
  const expenseLoading = 0.25;
  const mod = FIXED_MODIFIERS[params.providerId] || { targetMargin: 0.15 };
  const profitMargin = mod.targetMargin;

  const pure = purePremium(params);
  const gross = pure * (1 + expenseLoading) * (1 + profitMargin);
  return Math.max(gross, 0.05); // minimum $0.05
}

/**
 * Get actuarial quote for a single plan
 */
function quotePlan(provider, plan, insuredValue, scenarioId) {
  const scenario = scenarios[scenarioId] || scenarios.retail;
  const coverageLimit = plan.coverage;
  const duration = scenario.duration;

  const pure = purePremium({
    insuredValue,
    coverageLimit,
    scenarioId,
    duration,
    providerId: provider.id,
    planId: plan.id,
  });

  const gross = grossPremium({
    insuredValue,
    coverageLimit,
    scenarioId,
    duration,
    providerId: provider.id,
    planId: plan.id,
  });

  return {
    pure_premium: parseFloat(pure.toFixed(4)),
    gross_premium: parseFloat(gross.toFixed(2)),
    loss_ratio: pure / gross,
    risk_factors: {
      frequency: BASE_FREQUENCY[scenarioId] || BASE_FREQUENCY.default,
      coverage_limit: coverageLimit,
      duration,
    },
  };
}

/**
 * Generate competitive quotes for all providers, using actuarial model
 * Blends actuarial premium with provider base rate for market consistency
 */
function generateCompetitiveQuotes(items, scenarioId = 'retail') {
  const insuredValue = items.reduce((s, i) => s + (i.value || 0), 0);
  const results = [];

  providers.forEach((provider) => {
    (provider.plans || []).forEach((plan) => {
      const act = quotePlan(provider, plan, insuredValue, scenarioId);
      // Blend: 70% actuarial + 30% provider base rate (keeps provider differentiation)
      const blended = act.gross_premium * 0.7 + insuredValue * (plan.premium_rate || 0.003) * 0.3;
      const premium = parseFloat(Math.max(blended, 0.05).toFixed(2));

      results.push({
        provider_id: provider.id,
        provider_name: provider.name,
        plan_id: plan.id,
        plan_name: plan.name,
        premium,
        coverage: plan.coverage,
        actuarial: {
          pure_premium: act.pure_premium,
          gross_premium: act.gross_premium,
          loss_ratio: parseFloat(act.loss_ratio.toFixed(4)),
        },
      });
    });
  });

  return results;
}

module.exports = {
  purePremium,
  grossPremium,
  quotePlan,
  generateCompetitiveQuotes,
  BASE_FREQUENCY,
  severityFactor,
  durationFactor,
  limitFactor,
  parseDurationDays,
};
