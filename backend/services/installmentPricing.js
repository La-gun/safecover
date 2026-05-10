/**
 * Billing period presentation: lump sum vs financed installments with an explicit financing load.
 * Sum(schedule) === financed_total === premium_lump_sum * (1 + financing_load_rate) when rate > 0.
 */
const { parseDurationDays } = require('./actuarial');

const BILLING_PERIODS = new Set(['lump_sum', 'weekly', 'monthly']);

function normalizeBillingPeriod(raw) {
  const p = String(raw == null ? 'lump_sum' : raw)
    .toLowerCase()
    .trim();
  if (!BILLING_PERIODS.has(p)) {
    return { ok: false, error: 'billing_period must be lump_sum, weekly, or monthly', code: 'INVALID_BILLING_PERIOD' };
  }
  return { ok: true, billing_period: p };
}

function financingLoadRate(billingPeriod) {
  if (billingPeriod === 'lump_sum') return 0;
  if (billingPeriod === 'weekly') {
    const v = parseFloat(process.env.SAFECOVER_FINANCING_LOAD_WEEKLY || '0.02');
    return Number.isFinite(v) && v >= 0 ? v : 0.02;
  }
  if (billingPeriod === 'monthly') {
    const v = parseFloat(process.env.SAFECOVER_FINANCING_LOAD_MONTHLY || '0.035');
    return Number.isFinite(v) && v >= 0 ? v : 0.035;
  }
  return 0;
}

function installmentCount(policyDays, billingPeriod) {
  const d = Math.max(1, Math.floor(Number(policyDays) || 1));
  if (billingPeriod === 'lump_sum') return 1;
  if (billingPeriod === 'weekly') return Math.max(1, Math.ceil(d / 7));
  if (billingPeriod === 'monthly') return Math.max(1, Math.ceil(d / 30));
  return 1;
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Split financed total into n installments (cents-first), last row absorbs any drift.
 */
function splitFinancedTotal(financedTotal, n) {
  const nSafe = Math.max(1, Math.floor(n));
  const cents = Math.round(financedTotal * 100);
  const base = Math.floor(cents / nSafe);
  const rem = cents - base * nSafe;
  const out = [];
  for (let i = 0; i < nSafe; i++) {
    const c = base + (i < rem ? 1 : 0);
    out.push(c / 100);
  }
  const sum = out.reduce((a, b) => a + b, 0);
  const drift = roundMoney(financedTotal - sum);
  if (Math.abs(drift) >= 0.001 && out.length) {
    out[out.length - 1] = roundMoney(out[out.length - 1] + drift);
  }
  return out.map(roundMoney);
}

function buildSchedule(amounts) {
  return amounts.map((amount, idx) => ({ installment: idx + 1, amount: roundMoney(amount) }));
}

/**
 * @param {object} params
 * @param {number} params.lumpSumPremium - actuarial premium for the policy term (no financing load)
 * @param {string} params.scenarioDurationStr - scenario.duration
 * @param {string} params.billing_period - lump_sum | weekly | monthly
 */
function computeBillingPresentation({ lumpSumPremium, scenarioDurationStr, billing_period }) {
  const policyDays = parseDurationDays(scenarioDurationStr);
  const lump = roundMoney(Math.max(0.05, Number(lumpSumPremium) || 0));
  const rate = financingLoadRate(billing_period);
  const n = installmentCount(policyDays, billing_period);
  const financedTotal =
    billing_period === 'lump_sum' ? lump : roundMoney(lump * (1 + Math.max(0, rate)));
  const amounts = splitFinancedTotal(financedTotal, n);
  const schedule = buildSchedule(amounts);
  const first_installment = schedule[0] ? schedule[0].amount : lump;
  const premium_due_at_bind = first_installment;

  return {
    billing_period,
    premium_lump_sum: lump,
    financing_load_rate: rate,
    financed_total: financedTotal,
    installment_count: n,
    first_installment,
    premium_due_at_bind,
    schedule,
    policy_term_days: policyDays,
  };
}

module.exports = {
  BILLING_PERIODS,
  normalizeBillingPeriod,
  financingLoadRate,
  installmentCount,
  computeBillingPresentation,
  roundMoney,
};
