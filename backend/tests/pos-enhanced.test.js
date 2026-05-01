const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  normalizePosItems,
  validateTerminal,
  transactionIdForPos,
  bindIdempotencyForPos,
} = require('../services/posEnhanced');

describe('posEnhanced helpers', () => {
  test('normalizePosItems accepts value', () => {
    const r = normalizePosItems([{ value: 10, sku: 'A' }]);
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.items, [{ value: 10, name: 'A' }]);
  });

  test('normalizePosItems computes from unit_price and quantity', () => {
    const r = normalizePosItems([{ unit_price: 5, quantity: 3, name: 'Widget' }]);
    assert.strictEqual(r.ok, true);
    assert.deepStrictEqual(r.items, [{ value: 15, name: 'Widget' }]);
  });

  test('validateTerminal requires store and register', () => {
    assert.strictEqual(validateTerminal(null).ok, false);
    assert.strictEqual(validateTerminal({ store_id: 'S1' }).ok, false);
    assert.strictEqual(validateTerminal({ store_id: 'S1', register_id: 'R2' }).ok, true);
  });

  test('transactionIdForPos is stable', () => {
    const t = { store_id: 'S1', register_id: 'R2' };
    assert.strictEqual(transactionIdForPos(t, 'T9'), 'POS:S1:R2:T9');
  });

  test('bindIdempotencyForPos is deterministic', () => {
    const t = { store_id: 'S1', register_id: 'R2' };
    const a = bindIdempotencyForPos('p1', t, 'T9');
    const b = bindIdempotencyForPos('p1', t, 'T9');
    assert.strictEqual(a, b);
    assert.ok(a.startsWith('posidem_'));
  });
});
