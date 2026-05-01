const { test, describe } = require('node:test');
const assert = require('node:assert');
const policyholderBilling = require('../services/policyholderBilling');

describe('policyholderBilling', () => {
  test('namesMatch ignores case and extra spaces', () => {
    assert.strictEqual(policyholderBilling.namesMatch('Jane M. Doe', 'jane  m.  doe'), true);
    assert.strictEqual(policyholderBilling.namesMatch('Jane Doe', 'John Doe'), false);
  });

  test('validateBind requires address and billing cardholder', () => {
    const cust = {
      name: 'Alex Insured',
      email: 'a@b.com',
      address: { line1: '10 High Street', city: 'London', postal_code: 'EC1A 1BB', country: 'GB' },
    };
    const ok = policyholderBilling.validateBindCustomerAndBilling(cust, { cardholder_name: 'Alex Insured' }, {});
    assert.strictEqual(ok.ok, true);

    const bad = policyholderBilling.validateBindCustomerAndBilling(cust, { cardholder_name: 'Other Person' }, {});
    assert.strictEqual(bad.ok, false);
    assert.strictEqual(bad.code, 'CARDHOLDER_NAME_MISMATCH');
  });
});
