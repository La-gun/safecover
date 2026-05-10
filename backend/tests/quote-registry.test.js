const { test, describe } = require('node:test');
const assert = require('node:assert');
const quoteRegistry = require('../services/quoteRegistry');

describe('quoteRegistry', () => {
  test('register then evaluate succeeds with matching cart', () => {
    const store = {
      _q: {},
      saveQuoteRecord(r) {
        this._q[r.quote_id] = { ...r };
      },
      getQuoteRecord(id) {
        return this._q[id] || null;
      },
      consumeQuoteRecord() {},
    };
    const qid = 'QTY_unit_' + Date.now();
    quoteRegistry.registerQuote(store, {
      quote_id: qid,
      partner_id: 'partner1',
      items: [{ value: 50 }],
      premium: 2.5,
      provider_id: 'safecover',
      plan_id: 'basic',
      scenario: 'retail',
      jurisdiction: 'US',
    });
    const ev = quoteRegistry.evaluateQuoteForBind(store, {
      quote_id: qid,
      premium_paid: 2.5,
      provider_id: 'safecover',
      plan_id: 'basic',
      scenario: 'retail',
      items: [{ value: 50 }],
      bind_partner_id: 'partner1',
    });
    assert.strictEqual(ev.ok, true);
    assert.ok(ev.record);
  });

  test('installment quote binds on first installment amount', () => {
    const installmentPricing = require('../services/installmentPricing');
    const store = {
      _q: {},
      saveQuoteRecord(r) {
        this._q[r.quote_id] = { ...r };
      },
      getQuoteRecord(id) {
        return this._q[id] || null;
      },
      consumeQuoteRecord() {},
    };
    const qid = 'QTY_inst_' + Date.now();
    const billing = installmentPricing.computeBillingPresentation({
      lumpSumPremium: 12,
      scenarioDurationStr: '12 months',
      billing_period: 'monthly',
    });
    quoteRegistry.registerQuote(store, {
      quote_id: qid,
      partner_id: 'partner1',
      items: [{ value: 50 }],
      premium: billing.premium_due_at_bind,
      premium_lump_sum: billing.premium_lump_sum,
      billing_period: billing.billing_period,
      financed_total: billing.financed_total,
      installment_count: billing.installment_count,
      first_installment: billing.first_installment,
      financing_load_rate: billing.financing_load_rate,
      schedule: billing.schedule,
      provider_id: 'safecover',
      plan_id: 'basic',
      scenario: 'gadgets',
      jurisdiction: 'US',
    });
    const ev = quoteRegistry.evaluateQuoteForBind(store, {
      quote_id: qid,
      premium_paid: billing.first_installment,
      provider_id: 'safecover',
      plan_id: 'basic',
      scenario: 'gadgets',
      items: [{ value: 50 }],
      bind_partner_id: 'partner1',
      billing_period: 'monthly',
    });
    assert.strictEqual(ev.ok, true);
  });
});
