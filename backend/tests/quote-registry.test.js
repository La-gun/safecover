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
});
