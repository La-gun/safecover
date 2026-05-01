/**
 * Product wording for certificates / IPID-style summaries, keyed by scenario id.
 * Fallback: retail (goods-in-transit / checkout protection).
 */
const DEFAULT = {
  product_title: 'Embedded purchase protection',
  coverage_type_label: 'Goods in transit & checkout protection',
  insuring_clause:
    'The insurer agrees to indemnify the policyholder, subject to the terms of this policy, for physical loss of or damage to the insured goods arising from covered perils during the policy period and within the territorial limits stated in the schedule.',
  covered_risks: [
    'Loss or damage to insured goods during transit from merchant to the policyholder',
    'Theft of goods after delivery where evidenced in line with claims conditions',
    'Accidental damage to insured goods during the coverage period',
    'Non-delivery or damage in transit where supported by delivery records',
  ],
  exclusions: [
    'Wear and tear, gradual deterioration, or inherent vice',
    'Loss or damage caused intentionally by the policyholder or household',
    'Unexplained disappearance or theft from unattended vehicles or unsecured locations',
    'Consequential loss, loss of profit, or indirect financial loss',
    'War, terrorism, sanctions, or confiscation by authorities',
    'Items not listed on the schedule or above the sum insured / inner limits',
    'Loss where the policyholder fails to meet notification or cooperation conditions',
  ],
  conditions_obligations: [
    'Duty of fair presentation: disclose material facts before inception and at renewal (where applicable)',
    'Notify claims as soon as reasonably possible and within the period stated in the schedule',
    'Provide proof of purchase, evidence of loss, and cooperate with the insurer’s investigation',
    'Take reasonable steps to mitigate loss and preserve recoveries',
    'Fraudulent claims may void cover and may be reported to authorities',
  ],
  claims_process: [
    'Notify: use the claims contact details on this certificate or the insurer’s portal',
    'Provide: proof of purchase, photographs/video where relevant, police report for theft',
    'Assessment: the insurer may appoint a loss adjuster; settlement follows policy terms',
    'Disputes: follow the complaints procedure and Financial Ombudsman Service (UK) where applicable',
  ],
  legal_notes: [
    'Governing law and jurisdiction are stated in the schedule',
    'This certificate is evidence of cover only; the full policy wording and schedule form the contract',
    'Cooling-off rights may apply as set out in the policy documentation for your jurisdiction',
  ],
};

const BY_SCENARIO = {
  jewellery: {
    product_title: 'Jewellery & watch insurance – all risks',
    coverage_type_label: 'Jewellery & watch – specified all risks',
    insuring_clause:
      'The insurer agrees to indemnify the policyholder for accidental damage, theft (where evidenced), and mechanical breakdown of watches for items specified in the schedule, subject to limits, excess, and exclusions.',
    covered_risks: [
      'Accidental damage: repair or replacement (e.g. impact, drop)',
      'Theft: replacement where a valid police report and crime reference are provided',
      'Loss evidenced as theft as per policy conditions',
      'Mechanical breakdown of insured watches (subject to limits)',
      'Worldwide cover unless the schedule states otherwise',
    ],
    exclusions: [
      'Unexplained disappearance or loss not evidenced as theft',
      'Wear and tear, scratching from normal use',
      'Theft from unattended vehicles or unsecured public areas (e.g. gym lockers)',
      'Damage covered by manufacturer warranty or routine servicing',
      'Intentional damage by the policyholder or household',
      'War, terrorism, confiscation',
      'Items not on the schedule or above sum insured',
    ],
    conditions_obligations: [
      'Accurate description, value, and proof of purchase / valuation for scheduled items',
      'Secure storage when items are not worn; reasonable care',
      'Notify changes of risk (address, high-value acquisitions) that may be material',
      'Theft: notify police and insurer promptly; obtain crime reference',
    ],
    claims_process: [
      'Report theft to police immediately; obtain crime reference',
      'Contact claims with schedule reference, proof of purchase, and photographs',
      'Cooperate with investigation and any repairer/valuer appointed',
    ],
    legal_notes: DEFAULT.legal_notes,
  },
  retail: {
    ...DEFAULT,
    product_title: 'Checkout & transit purchase protection',
    coverage_type_label: 'Goods in transit / purchase protection',
  },
  gadgets: {
    ...DEFAULT,
    product_title: 'Gadget & electronics protection',
    coverage_type_label: 'Device accidental damage & theft (schedule)',
    covered_risks: [
      'Accidental damage including screen breakage (as scheduled)',
      'Theft from the policyholder where conditions are met',
      'Mechanical or electrical failure where included on the schedule',
    ],
    exclusions: [
      ...DEFAULT.exclusions.slice(0, 4),
      'Manufacturer warranty defects or recall',
      ...DEFAULT.exclusions.slice(4),
    ],
  },
  logistics: {
    ...DEFAULT,
    product_title: 'Logistics & shipping protection',
    coverage_type_label: 'Goods in transit',
  },
  healthcare: {
    ...DEFAULT,
    product_title: 'Healthcare appointment protection',
    coverage_type_label: 'Appointment cancellation / no-show (schedule)',
    covered_risks: [
      'Fees or deposits lost due to covered cancellation per schedule',
      'No-show events where covered and evidenced',
    ],
    exclusions: [
      'Pre-existing circumstances not disclosed',
      'Cancellations outside the scope of the schedule',
      ...DEFAULT.exclusions.slice(2),
    ],
  },
  hospitality: {
    ...DEFAULT,
    product_title: 'Travel & hospitality protection',
    coverage_type_label: 'Trip / booking protection (schedule)',
  },
  food: {
    ...DEFAULT,
    product_title: 'Food delivery guarantee',
    coverage_type_label: 'Delivery guarantee (schedule)',
  },
  cyber: {
    ...DEFAULT,
    product_title: 'Cyber & digital assistance',
    coverage_type_label: 'Cyber support / breach response (schedule)',
    exclusions: [
      'Business interruption beyond schedule limits',
      'Cryptocurrency loss unless expressly scheduled',
      ...DEFAULT.exclusions.slice(3),
    ],
  },
  mobility: {
    ...DEFAULT,
    product_title: 'Mobility & per-trip cover',
    coverage_type_label: 'Per-trip accident cover (schedule)',
  },
  parametric: {
    ...DEFAULT,
    product_title: 'Parametric protection',
    coverage_type_label: 'Parametric trigger benefit (schedule)',
    insuring_clause:
      'The insurer agrees to pay the benefit amount stated in the schedule when the parametric trigger and verification criteria are met.',
  },
  events: {
    ...DEFAULT,
    product_title: 'Events & ticketing protection',
    coverage_type_label: 'Ticket / event protection (schedule)',
  },
};

function getWordingForScenario(scenarioId) {
  return BY_SCENARIO[scenarioId] || BY_SCENARIO.retail || DEFAULT;
}

module.exports = {
  getWordingForScenario,
  DEFAULT,
  BY_SCENARIO,
};
