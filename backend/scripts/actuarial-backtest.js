#!/usr/bin/env node
/**
 * Actuarial model backtest - validate loss ratios with synthetic data
 * Run: node scripts/actuarial-backtest.js
 */
const actuarial = require('../services/actuarial');
const scenarios = require('../scenarios');

const SCENARIOS = Object.keys(scenarios);
const ITERATIONS = 1000;
const RANDOM_SEED = 42;

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const random = seededRandom(RANDOM_SEED);

function simulateClaims(policies, scenarioFreq) {
  const claims = [];
  policies.forEach((p) => {
    const lambda = (scenarioFreq[p.scenario] || 2.5) / 1000;
    const u = random();
    if (u < lambda) {
      const severity = 0.1 + random() * 0.3;
      const amount = Math.min(p.insured_value * severity, p.coverage);
      claims.push({ policy_id: p.policy_id, amount, scenario: p.scenario });
    }
  });
  return claims;
}

function runBacktest() {
  const policies = [];
  let totalPremium = 0;
  let totalExpectedLoss = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const value = 50 + random() * 450;
    const items = [{ value }];
    const quotes = actuarial.generateCompetitiveQuotes(items, scenario);
    const q = quotes[i % quotes.length];
    const premium = q.premium;
    const purePremium = q.actuarial?.pure_premium || premium * 0.6;
    totalPremium += premium;
    totalExpectedLoss += purePremium;
    policies.push({
      policy_id: 'POL_' + i,
      scenario,
      insured_value: value,
      coverage: q.coverage,
      premium,
      pure_premium: purePremium,
    });
  }

  const scenarioFreq = { ...actuarial.BASE_FREQUENCY };
  const claims = simulateClaims(policies, scenarioFreq);
  const totalClaimAmount = claims.reduce((s, c) => s + c.amount, 0);

  const actualLossRatio = totalClaimAmount / totalPremium;
  const expectedLossRatio = totalExpectedLoss / totalPremium;

  const byScenario = {};
  claims.forEach((c) => {
    byScenario[c.scenario] = (byScenario[c.scenario] || 0) + 1;
  });

  const validation =
    actualLossRatio > 0.95
      ? 'WARNING: Underpricing'
      : actualLossRatio < 0.4
        ? 'WARNING: Overpricing'
        : 'OK: Within range';

  return {
    policies_simulated: policies.length,
    total_premium: parseFloat(totalPremium.toFixed(2)),
    total_expected_loss: parseFloat(totalExpectedLoss.toFixed(2)),
    claims_count: claims.length,
    total_claims: parseFloat(totalClaimAmount.toFixed(2)),
    expected_loss_ratio: parseFloat((expectedLossRatio * 100).toFixed(1)),
    actual_loss_ratio: parseFloat((actualLossRatio * 100).toFixed(1)),
    validation,
    claims_by_scenario: byScenario,
  };
}

if (require.main === module) {
  console.log('=== Actuarial Model Backtest ===\n');
  const result = runBacktest();
  console.log(JSON.stringify(result, null, 2));
  console.log('\nValidation:', result.validation);
}

module.exports = { runBacktest };
