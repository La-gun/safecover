/**
 * Regulated insurer core — product offering validation and policy regulatory metadata.
 * Wire env to your licensed carrier / product filing identifiers in production.
 */
const compliance = require('./compliance');

function validateOffering(params) {
  const { jurisdiction, scenario, items } = params || {};
  const c = compliance.complianceCheck({ jurisdiction, scenario, items });
  if (!c.valid) {
    return { ok: false, error: c.error || 'Compliance check failed', jurisdiction: c.jurisdiction };
  }
  const regulatory = {
    carrier_entity_id: process.env.CARRIER_ENTITY_ID || null,
    carrier_license_reference: process.env.CARRIER_LICENSE_REFERENCE || null,
    product_filing_code: process.env.PRODUCT_FILING_CODE || null,
    policy_wording_version: process.env.POLICY_WORDING_VERSION || '1.0.0',
    sandbox: process.env.SAFECOVER_SANDBOX === 'true',
  };
  return {
    ok: true,
    jurisdiction: c.jurisdiction,
    disclosures: c.disclosures || compliance.getDisclosures(c.jurisdiction),
    regulatory,
  };
}

function buildRegulatorySnapshot(policy) {
  return {
    carrier_entity_id: process.env.CARRIER_ENTITY_ID || 'unconfigured',
    carrier_license_reference: process.env.CARRIER_LICENSE_REFERENCE || 'unconfigured',
    product_filing_code: process.env.PRODUCT_FILING_CODE || `embedded-${policy.scenario || 'retail'}`,
    policy_wording_version: process.env.POLICY_WORDING_VERSION || '1.0.0',
    jurisdiction: policy.jurisdiction || null,
    scenario: policy.scenario || null,
    sandbox: process.env.SAFECOVER_SANDBOX === 'true',
    bound_at: policy.recorded_at || new Date().toISOString(),
  };
}

function attachRegulatorySnapshot(policy) {
  return {
    ...policy,
    regulatory_snapshot: buildRegulatorySnapshot(policy),
  };
}

module.exports = {
  validateOffering,
  attachRegulatorySnapshot,
  buildRegulatorySnapshot,
};
