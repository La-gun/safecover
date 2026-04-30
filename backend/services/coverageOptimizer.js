/**
 * Coverage Optimizer (rules-first + deterministic ranking)
 *
 * Goal: pick the simplest-to-claim cover first, then margin, then attach-rate proxy.
 * Designed to work without live carrier telemetry; uses proxies that can be replaced later.
 */
const scenarios = require('../scenarios');
const providers = require('../providers');

const SCENARIO_BY_CATEGORY = {
  logistics_shipping: 'logistics',
  healthcare: 'healthcare',
  hospitality_travel: 'hospitality',
  food_delivery: 'food',
  cyber_digital: 'cyber',
  mobility_gig: 'mobility',
  parametric_climate_events: 'parametric',
  retail_ecommerce: 'retail',
  gadgets_electronics: 'gadgets',
  events_ticketing: 'events',
  jewellery_watch: 'jewellery',
};

const CATEGORY_BY_SCENARIO = Object.fromEntries(Object.entries(SCENARIO_BY_CATEGORY).map(([k, v]) => [v, k]));

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function pickProviderMeta(providerId) {
  const p = providers.find((x) => x.id === providerId);
  return p || { id: providerId, name: providerId, commission_rate: 0.15 };
}

// Proxy: lower is simpler. Based on scenario + plan messaging.
function estimateClaimsFlow({ scenarioId, plan, providerId }) {
  const scenario = scenarios[scenarioId] || scenarios.retail;
  const benefitsText = (plan?.benefits || []).join(' ').toLowerCase();
  const summaryText = (plan?.summary || '').toLowerCase();
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
    parametric: 0, // goal: no paperwork
  };

  const docsRequiredCount = Math.max(
    0,
    (baseDocsByScenario[scenarioId] ?? 2) - (hasConcierge ? 1 : 0) - (hasDedicated ? 1 : 0) - (hasPriority ? 1 : 0)
  );

  // Settlement time proxy (days). Parametric and instant payout drop this.
  let avgSettlementDaysP50 = 10;
  if (scenarioId === 'parametric') avgSettlementDaysP50 = 1;
  else if (scenarioId === 'food') avgSettlementDaysP50 = 2;
  else if (scenarioId === 'events') avgSettlementDaysP50 = 5;
  else if (scenarioId === 'retail' || scenarioId === 'logistics') avgSettlementDaysP50 = 7;
  else if (scenarioId === 'gadgets' || scenarioId === 'jewellery') avgSettlementDaysP50 = 12;

  if (hasInstant) avgSettlementDaysP50 = Math.max(1, Math.round(avgSettlementDaysP50 * 0.4));
  if (hasSameDay) avgSettlementDaysP50 = Math.min(avgSettlementDaysP50, 1);

  return {
    fnolChannel: 'api',
    docsRequiredCount,
    avgSettlementDaysP50,
    // Keep it simple for now: a single entrypoint per line.
    entrypointsCount: 1,
    scenarioCoverageType: scenario.coverage_type,
  };
}

// Proxy severity: more exclusions => worse; parametric best.
function estimateExclusions({ scenarioId }) {
  const common = ['Fraud', 'Intentional damage'];
  if (scenarioId === 'parametric') return ['Fraud', 'Tampering with trigger data'];
  if (scenarioId === 'cyber') return common.concat(['Known vulnerabilities not patched', 'Insider misconduct']);
  if (scenarioId === 'jewellery') return common.concat(['Unattended in public place', 'No proof of ownership']);
  return common;
}

function exclusionsSeverityScore(exclusions = []) {
  // Simple proxy: map count to 0..1 where fewer is better.
  const n = Array.isArray(exclusions) ? exclusions.length : 0;
  // 2 exclusions => ~0.9, 6 exclusions => ~0.3
  return clamp01(1 - Math.max(0, n - 2) * 0.15);
}

function deductibleToValueScore(deductible, limit) {
  const d = Number(deductible) || 0;
  const l = Number(limit) || 1;
  const ratio = d / Math.max(1, l);
  // ratio 0 => 1, ratio 5% => 0.8, ratio 20% => 0.2
  return clamp01(1 - ratio * 4);
}

// Without real ops telemetry, treat all providers as "good" with tiny differentiation.
function providerReliabilityScore(providerId) {
  const baseByProvider = {
    safecover: 0.90,
    assurex: 0.88,
    covermax: 0.86,
    shieldpro: 0.87,
  };
  return clamp01(baseByProvider[providerId] ?? 0.85);
}

function attachRateProxyScore(premiumTotal, itemValue) {
  const p = Number(premiumTotal) || 0;
  const v = Number(itemValue) || 1;
  const ratio = p / Math.max(1, v);
  // 0.3% => high, 3% => low
  return clamp01(1 - (ratio * 40)); // 2.5% -> 0
}

function marginScore(expectedMarginNgn, premiumTotal) {
  const m = Number(expectedMarginNgn) || 0;
  const p = Number(premiumTotal) || 1;
  const r = m / Math.max(1, p);
  // 0% => 0, 20% => 1
  return clamp01(r / 0.2);
}

function claimsFrictionScore(quote) {
  const flow = quote.claimsFlow || {};
  const docsScore = clamp01(1 - (Number(flow.docsRequiredCount) || 0) * 0.18);
  const settleScore = clamp01(1 - (Number(flow.avgSettlementDaysP50) || 10) / 20);
  const entryScore = clamp01(1 - Math.max(0, (Number(flow.entrypointsCount) || 1) - 1) * 0.5);
  const exclScore = exclusionsSeverityScore(quote.exclusions || []);
  const dedScore = deductibleToValueScore(quote.deductible, quote.limit);
  // Weighted toward operational simplicity + clarity
  return clamp01(docsScore * 0.30 + settleScore * 0.30 + entryScore * 0.10 + exclScore * 0.20 + dedScore * 0.10);
}

function overallScore(quote, context) {
  const claims = claimsFrictionScore(quote);
  const reliability = providerReliabilityScore(quote.providerKey);
  const margin = marginScore(quote.commercials?.expectedMarginNgn, quote.premiumTotal);
  const attach = attachRateProxyScore(quote.premiumTotal, context?.itemValueTotal);
  // Your priority order: claims friction > margin > attach
  const overall = claims * 0.55 + reliability * 0.20 + margin * 0.15 + attach * 0.10;
  return {
    claimsFriction: claims,
    providerReliability: reliability,
    margin,
    attachRate: attach,
    overall: clamp01(overall),
  };
}

function buildCustomerBullets(quote, scores) {
  const flow = quote.claimsFlow || {};
  const bullets = [];
  bullets.push('Simple claims: fewer steps and clear requirements.');
  if (Number(flow.docsRequiredCount) === 0) bullets.push('No paperwork claim flow (trigger-based).');
  else bullets.push(`Typically ${flow.docsRequiredCount} document(s) required for claims.`);
  bullets.push(`Faster typical settlement (around ${flow.avgSettlementDaysP50 || 7} day(s)).`);
  if ((scores?.providerReliability ?? 0) >= 0.88) bullets.push('Reliable issuer and stable issuance experience.');
  return bullets.slice(0, 3);
}

function buildMerchantBullets(quote, context) {
  const bullets = [];
  bullets.push('Per-line policy structure reduces support and reconciliation overhead.');
  bullets.push('Lower bind failure risk reduces post-payment exceptions.');
  if (quote.commercials?.expectedMarginNgn != null) bullets.push('Healthy margin without sacrificing claims experience.');
  return bullets.slice(0, 3);
}

function normalizeQuote({ scenarioId, providerId, plan, premiumTotal, limit, deductible, tenureDays, expectedMarginNgn, commissionNgn }) {
  const claimsFlow = estimateClaimsFlow({ scenarioId, plan, providerId });
  const exclusions = estimateExclusions({ scenarioId });
  return {
    quoteId: `q_${providerId}_${plan?.id || 'plan'}_${Date.now()}`,
    providerKey: providerId,
    premiumTotal: Number(premiumTotal) || 0,
    tenureDays: tenureDays || 365,
    deductible: deductible ?? 0,
    limit: limit ?? plan?.coverage ?? null,
    exclusions,
    claimsFlow,
    bindRequirements: {
      // Keep as proxy: devices/jewellery typically need serial/valuation
      requiresSerialNumber: scenarioId === 'gadgets' || scenarioId === 'jewellery',
    },
    commercials: {
      expectedMarginNgn: expectedMarginNgn ?? null,
      commissionNgn: commissionNgn ?? null,
    },
    structureSupported: ['PER_LINE', 'PER_ITEM'],
  };
}

/**
 * Build candidates by scenario (product line) from a checkout items array.
 * This is the "rules-first" candidate generation baseline for when caller doesn't supply candidates.
 */
function buildCandidatesFromCheckout({ checkout, scenarioHint, currency = 'NGN' }) {
  const items = Array.isArray(checkout?.items) ? checkout.items : [];
  if (items.length === 0) return [];

  const grouped = new Map();
  for (const it of items) {
    const category = it.category;
    const scenarioId = SCENARIO_BY_CATEGORY[category] || scenarioHint || 'retail';
    const list = grouped.get(scenarioId) || [];
    list.push(it);
    grouped.set(scenarioId, list);
  }

  const results = [];
  for (const [scenarioId, its] of grouped.entries()) {
    const itemValueTotal = its.reduce((s, i) => s + (Number(i.unitPrice) || Number(i.value) || 0) * (Number(i.quantity) || 1), 0);

    // Reuse existing actuarial quote generator (expects items with .value)
    const actuarialItems = its.map((i) => ({ value: (Number(i.unitPrice) || Number(i.value) || 0) * (Number(i.quantity) || 1) }));
    // Lazy-load to avoid cycles
    // eslint-disable-next-line global-require
    const actuarial = require('./actuarial');
    const actuarialQuotes = actuarial.generateCompetitiveQuotes(actuarialItems, scenarioId);

    const quotes = actuarialQuotes.map((aq) => {
      const provider = pickProviderMeta(aq.provider_id);
      const plan = (provider.plans || []).find((p) => p.id === aq.plan_id) || { id: aq.plan_id, coverage: aq.coverage, benefits: [] };
      const premiumTotal = aq.premium;
      // Commission/margin proxies
      const commissionNgn = Number((premiumTotal * (provider.commission_rate ?? 0.15)).toFixed(2));
      const expectedMarginNgn = Number((premiumTotal * 0.20).toFixed(2)); // placeholder; replace with real unit economics
      return normalizeQuote({
        scenarioId,
        providerId: aq.provider_id,
        plan,
        premiumTotal,
        limit: aq.coverage,
        deductible: scenarioId === 'gadgets' || scenarioId === 'jewellery' ? Math.round((aq.coverage || 0) * 0.02) : 0,
        tenureDays: scenarioId === 'food' ? 1 : scenarioId === 'retail' ? 7 : 365,
        expectedMarginNgn,
        commissionNgn,
      });
    });

    results.push({
      productId: scenarioId,
      category: CATEGORY_BY_SCENARIO[scenarioId] || null,
      itemScope: its.map((i) => i.itemId).filter(Boolean),
      context: { itemValueTotal, currency },
      quotes,
    });
  }

  return results;
}

function rankQuotesForProduct(quotes, context) {
  const enriched = (quotes || []).map((q) => {
    const scores = overallScore(q, context);
    return { ...q, _scores: scores };
  });
  enriched.sort((a, b) => (b._scores.overall - a._scores.overall));
  return enriched;
}

/**
 * Recommend covers for a set of candidates.
 * @returns recommendations array shaped for API response
 */
function recommend({ correlationId, candidates, policyPreference }) {
  const recs = [];
  const warnings = [];
  for (const cand of candidates || []) {
    const context = cand.context || { itemValueTotal: null };
    const ranked = rankQuotesForProduct(cand.quotes || [], context);
    if (ranked.length === 0) continue;
    const best = ranked[0];

    const policyStructure = (policyPreference?.defaultStructure || 'PER_LINE') === 'PER_LINE' ? 'PER_LINE' : 'PER_LINE';
    const alternatives = ranked.slice(1, 3).map((q, idx) => ({
      label: idx === 0 ? 'Cheaper' : 'Broader cover',
      quoteId: q.quoteId,
      providerKey: q.providerKey,
      reason:
        idx === 0
          ? 'Lower premium, but may have higher deductible or more claim requirements.'
          : 'Higher limit or broader terms, but may cost more.',
    }));

    const scores = best._scores;
    const customerBullets = buildCustomerBullets(best, scores);
    const merchantBullets = buildMerchantBullets(best, context);

    if (best.bindRequirements?.requiresSerialNumber) {
      warnings.push({
        code: 'MISSING_BIND_FIELD',
        message: 'Serial/IMEI required for bind; collect before purchase or before bind call.',
        productId: cand.productId,
      });
    }

    recs.push({
      productId: cand.productId,
      category: cand.category,
      policyStructure,
      selected: [
        {
          quoteId: best.quoteId,
          providerKey: best.providerKey,
          coversItemIds: cand.itemScope || [],
        },
      ],
      alternatives,
      explanations: { customerBullets, merchantBullets },
      scores: {
        claimsFriction: Number(scores.claimsFriction.toFixed(2)),
        margin: Number(scores.margin.toFixed(2)),
        attachRate: Number(scores.attachRate.toFixed(2)),
        overall: Number(scores.overall.toFixed(2)),
      },
      audit: {
        modelVersion: 'coverage-optimizer-v1',
        decision: 'SELECTED_BEST_BALANCE',
        topSignals: [
          'docsRequiredCount',
          'avgSettlementDaysP50',
          'providerReliabilityProxy',
          'exclusionsSeverityScore',
          'deductibleToValueRatio',
        ],
        correlationId: correlationId || null,
      },
    });
  }

  return { recommendations: recs, warnings };
}

module.exports = {
  SCENARIO_BY_CATEGORY,
  CATEGORY_BY_SCENARIO,
  buildCandidatesFromCheckout,
  recommend,
  rankQuotesForProduct,
  overallScore,
  claimsFrictionScore,
};

