const { test, describe } = require('node:test');
const assert = require('node:assert');
const certificateService = require('../services/certificateService');
const scenarios = require('../scenarios');
const providers = require('../providers');

describe('certificateService', () => {
  test('parseDurationToMs handles days', () => {
    assert.ok(certificateService.parseDurationToMs('7 days') > 0);
    assert.strictEqual(certificateService.parseDurationToMs('24 hours'), 86400000);
  });

  test('verifyCertificateToken uses timing-safe compare', () => {
    const p = { certificate_token: 'abc123' };
    assert.strictEqual(certificateService.verifyCertificateToken(p, 'abc123'), true);
    assert.strictEqual(certificateService.verifyCertificateToken(p, 'wrong'), false);
    assert.strictEqual(certificateService.verifyCertificateToken(p, 'abc124'), false);
  });

  test('attachCertificateToPolicy sets schedule and token', () => {
    const scenario = scenarios.retail;
    const provider = providers[0];
    const plan = provider.plans[1];
    const req = { protocol: 'http', get: () => 'localhost:3000' };
    let policy = {
      policy_id: 'POL_test',
      provider_id: provider.id,
      plan_id: plan.id,
      provider_name: provider.name,
      premium: 3.2,
      transaction_id: 'ORD-1',
      customer: { name: 'Jane Doe', email: 'j@example.com' },
      quote_id: 'Q1',
      scenario: 'retail',
      jurisdiction: 'UK',
      status: 'PENDING_PAYMENT',
      recorded_at: '2026-05-01T12:00:00.000Z',
      coverage_details: {
        type: scenario.coverage_type,
        max_value: plan.coverage,
        duration: scenario.duration,
      },
    };
    policy = certificateService.attachCertificateToPolicy(policy, req, {
      scenario,
      plan,
      provider,
      items: [{ value: 99.99, name: 'Widget' }],
      partnerId: 'partner1',
      planName: plan.name,
    });
    assert.ok(policy.certificate_token.length > 20);
    assert.ok(policy.certificate_id.startsWith('CERT_'));
    assert.strictEqual(policy.excess, plan.excess);
    assert.ok(Array.isArray(policy.insured_items));
    assert.strictEqual(policy.insured_items[0].description, 'Widget');
    assert.ok(policy.certificate_url.includes('token='));
  });
});
