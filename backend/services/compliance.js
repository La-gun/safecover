/**
 * Jurisdiction and compliance handling
 * Validates quote/bind requests against regulatory requirements
 */

const SUPPORTED_JURISDICTIONS = ['US', 'UK', 'EU', 'CA', 'AU', 'SG', 'NG'];
const RESTRICTED_SCENARIOS = {
  US: [],
  UK: ['cyber'],
  EU: [],
  CA: [],
  AU: [],
  SG: [],
  NG: ['cyber', 'parametric'],
};

const DISCLOSURE_REQUIRED = {
  US: ['Insurance is not a deposit', 'Policy terms apply'],
  UK: ['FCA regulated', 'Policy terms apply'],
  EU: ['IDD compliant', 'Policy terms apply'],
  CA: ['Provincial regulation varies', 'Policy terms apply'],
  AU: ['AFSL required', 'Policy terms apply'],
  SG: ['MAS regulated', 'Policy terms apply'],
  NG: ['NAICOM regulated', 'Policy terms apply'],
};

function getDefaultJurisdiction() {
  return process.env.DEFAULT_JURISDICTION || 'US';
}

function validateJurisdiction(jurisdiction) {
  if (!jurisdiction) return { valid: true, jurisdiction: getDefaultJurisdiction(), warnings: [] };
  const j = String(jurisdiction).toUpperCase();
  if (!SUPPORTED_JURISDICTIONS.includes(j)) {
    return { valid: false, error: 'Unsupported jurisdiction', jurisdiction: j };
  }
  return { valid: true, jurisdiction: j, warnings: [] };
}

function validateScenarioForJurisdiction(scenarioId, jurisdiction) {
  const j = validateJurisdiction(jurisdiction);
  if (!j.valid) return j;
  const restricted = RESTRICTED_SCENARIOS[j.jurisdiction] || [];
  if (restricted.includes(scenarioId)) {
    return {
      valid: false,
      error: `Scenario ${scenarioId} not available in ${j.jurisdiction}`,
      jurisdiction: j.jurisdiction,
    };
  }
  return { valid: true, jurisdiction: j.jurisdiction, warnings: [] };
}

function getDisclosures(jurisdiction) {
  const j = jurisdiction || getDefaultJurisdiction();
  return DISCLOSURE_REQUIRED[j] || DISCLOSURE_REQUIRED.US;
}

function complianceCheck(params) {
  const { jurisdiction, scenario, items } = params;
  const result = validateScenarioForJurisdiction(scenario || 'retail', jurisdiction);
  if (!result.valid) return result;
  const disclosures = getDisclosures(result.jurisdiction);
  return {
    ...result,
    disclosures,
    required_disclosures: disclosures,
  };
}

module.exports = {
  SUPPORTED_JURISDICTIONS,
  validateJurisdiction,
  validateScenarioForJurisdiction,
  getDisclosures,
  complianceCheck,
  getDefaultJurisdiction,
};
