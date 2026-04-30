/* eslint-disable no-console */
/**
 * Quick local demo for coverage recommendations.
 *
 * Usage:
 *   node scripts/coverage-recommendation-demo.js
 */
const coverageOptimizer = require('../services/coverageOptimizer');

function demo() {
  const checkout = {
    checkoutId: 'chk_demo',
    merchantId: 'm_demo',
    items: [
      { itemId: 'i1', category: 'gadgets_electronics', name: 'Phone', unitPrice: 600000, quantity: 1 },
      { itemId: 'i2', category: 'logistics_shipping', name: 'Shipment', unitPrice: 200000, quantity: 1 },
      { itemId: 'i3', category: 'events_ticketing', name: 'Concert ticket', unitPrice: 30000, quantity: 2 },
    ],
  };

  const candidates = coverageOptimizer.buildCandidatesFromCheckout({
    checkout,
    scenarioHint: 'retail',
    currency: 'NGN',
  });

  const result = coverageOptimizer.recommend({
    correlationId: 'corr_demo',
    candidates,
    policyPreference: { defaultStructure: 'PER_LINE', allowPerItemIfRequired: true },
  });

  console.log(JSON.stringify(result, null, 2));
}

demo();

