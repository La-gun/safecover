const { test, describe } = require('node:test');
const assert = require('node:assert');
const installmentPricing = require('../services/installmentPricing');

describe('installmentPricing', () => {
  test('lump_sum has no financing load and single installment', () => {
    const r = installmentPricing.computeBillingPresentation({
      lumpSumPremium: 10,
      scenarioDurationStr: '12 months',
      billing_period: 'lump_sum',
    });
    assert.strictEqual(r.financing_load_rate, 0);
    assert.strictEqual(r.financed_total, 10);
    assert.strictEqual(r.installment_count, 1);
    assert.strictEqual(r.first_installment, 10);
    assert.strictEqual(r.premium_due_at_bind, 10);
    assert.strictEqual(r.schedule.length, 1);
  });

  test('monthly adds financing load and schedule sums to financed_total', () => {
    const r = installmentPricing.computeBillingPresentation({
      lumpSumPremium: 12,
      scenarioDurationStr: '12 months',
      billing_period: 'monthly',
    });
    assert.ok(r.financing_load_rate > 0);
    assert.ok(r.financed_total > r.premium_lump_sum);
    const sum = r.schedule.reduce((s, x) => s + x.amount, 0);
    assert.ok(Math.abs(sum - r.financed_total) < 0.02);
    assert.strictEqual(r.installment_count, 12);
  });

  test('normalizeBillingPeriod rejects invalid', () => {
    const bad = installmentPricing.normalizeBillingPeriod('daily');
    assert.strictEqual(bad.ok, false);
  });
});
