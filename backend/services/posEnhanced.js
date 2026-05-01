/**
 * Point-of-sale enhanced API: terminal context, line-item shapes, and optional bind+confirm in one call.
 */
const crypto = require('crypto');
const store = require('./store');
const actuarial = require('./actuarial');
const compliance = require('./compliance');
const quoteRegistry = require('./quoteRegistry');
const fraud = require('./fraud');
const blockchain = require('./blockchain');
const insurer = require('./insurer');
const insurerCore = require('./insurerCore');
const certificateService = require('./certificateService');
const policyholderBilling = require('./policyholderBilling');
const providers = require('../providers');
const scenarios = require('../scenarios');

const providerMap = new Map(providers.map((p) => [p.id, p]));
const planMap = new Map();
providers.forEach((p) => {
  (p.plans || []).forEach((pl) => planMap.set(`${p.id}:${pl.id}`, pl));
});

const defaultScenario = scenarios.retail;

function getScenario(id) {
  return scenarios[id] || defaultScenario;
}

function validateQuoteItems(items) {
  if (!Array.isArray(items) || items.length === 0) return { valid: false, error: 'items must be a non-empty array' };
  const invalid = items.find((i) => typeof i?.value !== 'number' || i.value < 0);
  if (invalid) return { valid: false, error: 'Each item must have a non-negative numeric value' };
  return { valid: true };
}

function normalizePosItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'items must be a non-empty array', code: 'INVALID_ITEMS' };
  }
  const out = [];
  for (const i of rawItems) {
    let value;
    if (typeof i?.value === 'number' && i.value >= 0) {
      value = i.value;
    } else if (typeof i?.line_total === 'number' && i.line_total >= 0) {
      value = i.line_total;
    } else if (typeof i?.unit_price === 'number' && typeof i?.quantity === 'number') {
      value = i.unit_price * i.quantity;
      if (!Number.isFinite(value) || value < 0) {
        return { ok: false, error: 'Invalid unit_price/quantity for item', code: 'INVALID_ITEMS' };
      }
    } else {
      return {
        ok: false,
        error: 'Each item needs value, line_total, or unit_price+quantity',
        code: 'INVALID_ITEMS',
      };
    }
    const name = i.name || i.description || (i.sku != null ? String(i.sku) : '') || '';
    out.push({ value, name: String(name).slice(0, 200) });
  }
  return { ok: true, items: out };
}

function validateTerminal(t) {
  if (!t || typeof t !== 'object') return { ok: false, error: 'terminal is required', code: 'INVALID_TERMINAL' };
  if (!String(t.store_id || '').trim()) return { ok: false, error: 'terminal.store_id is required', code: 'INVALID_TERMINAL' };
  if (!String(t.register_id || '').trim()) {
    return { ok: false, error: 'terminal.register_id is required', code: 'INVALID_TERMINAL' };
  }
  return { ok: true };
}

function posMeta(terminal, ticketId) {
  return {
    channel: 'pos',
    store_id: String(terminal.store_id).trim(),
    register_id: String(terminal.register_id).trim(),
    lane: terminal.lane != null ? String(terminal.lane) : null,
    operator_id: terminal.operator_id != null ? String(terminal.operator_id) : null,
    ticket_id: ticketId != null && ticketId !== '' ? String(ticketId) : null,
  };
}

function transactionIdForPos(terminal, ticketId) {
  const t = String(ticketId || '').trim();
  if (!t) return null;
  return `POS:${String(terminal.store_id).trim()}:${String(terminal.register_id).trim()}:${t}`;
}

function bindIdempotencyForPos(partnerId, terminal, ticketId) {
  const raw = `${partnerId}|${terminal.store_id}|${terminal.register_id}|${ticketId}`;
  return `posidem_${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40)}`;
}

function jsonErr(res, status, msg, code) {
  return res.status(status).json({ error: msg, code });
}

async function performBind(req, body, terminal, ticketId, items) {
  const partnerId = req.partnerId;
  const {
    quote_id,
    customer,
    premium_paid,
    scenario: scenarioId,
    provider_id,
    plan_id,
    jurisdiction,
  } = body;

  const transaction_id = body.transaction_id || transactionIdForPos(terminal, ticketId);
  if (!transaction_id) {
    return { ok: false, status: 400, error: 'ticket_id or transaction_id is required', code: 'INVALID_TRANSACTION_ID' };
  }
  if (!quote_id?.trim()) return { ok: false, status: 400, error: 'quote_id is required', code: 'INVALID_QUOTE_ID' };
  if (!customer?.email?.includes?.('@')) {
    return { ok: false, status: 400, error: 'customer.email must be a valid email', code: 'INVALID_EMAIL' };
  }

  const customerNorm = policyholderBilling.normalizeCustomerInput({ customer, ...body });
  if (!customerNorm.email.includes('@')) {
    return { ok: false, status: 400, error: 'customer.email must be a valid email', code: 'INVALID_EMAIL' };
  }
  const billingCheck = policyholderBilling.validateBindCustomerAndBilling(customerNorm, body.billing, {});
  if (!billingCheck.ok) {
    return { ok: false, status: 400, error: billingCheck.error, code: billingCheck.code || 'BILLING_VALIDATION_ERROR' };
  }
  const customerForPolicy = billingCheck.customer;

  const offering = insurerCore.validateOffering({ jurisdiction, scenario: scenarioId, items });
  if (!offering.ok) {
    return { ok: false, status: 400, error: offering.error || 'Product offering not permitted', code: 'COMPLIANCE_ERROR' };
  }

  const bindIdem =
    req.get('X-Bind-Idempotency-Key')?.trim() ||
    body.bind_idempotency_key?.trim() ||
    bindIdempotencyForPos(partnerId, terminal, String(ticketId || '').trim() || transaction_id);

  if (bindIdem) {
    const existing = store.getPolicyByBindIdempotency(bindIdem);
    if (existing) {
      const cert = existing.certificate_url || certificateService.buildCertificateUrl(req, existing);
      return {
        ok: true,
        idempotent: true,
        json: {
          policy_id: existing.policy_id,
          certificate_id: existing.certificate_id,
          provider_id: existing.provider_id,
          plan_id: existing.plan_id,
          provider_name: existing.provider_name,
          certificate_url: cert,
          smart_contract_url: existing.smart_contract_url,
          contract_address: existing.contract_address,
          tx_hash: existing.tx_hash,
          execution_steps: existing.execution_steps,
          constructor_args: existing.constructor_args,
          coverage_details: existing.coverage_details,
          fraud_decision: existing.fraud_decision,
          fraud_score: existing.fraud_score,
          status: existing.status,
          transaction_id: existing.transaction_id,
          pos: existing.pos_context || null,
          bind_idempotent: true,
        },
      };
    }
  }

  const quoteEval = quoteRegistry.evaluateQuoteForBind(store, {
    quote_id,
    premium_paid,
    provider_id,
    plan_id,
    scenario: scenarioId,
    items,
    bind_partner_id: partnerId,
  });
  if (!quoteEval.ok) {
    return { ok: false, status: 400, error: quoteEval.error, code: quoteEval.code || 'QUOTE_ERROR' };
  }

  const existingPolicies = store.policies();
  const fraudResult = fraud.evaluateBind({
    customer: customerForPolicy,
    transaction_id,
    quote_id,
    existingPolicies,
  });
  if (fraudResult.decision === 'BLOCK') {
    return { ok: false, status: 403, error: 'Transaction blocked by fraud rules', code: 'FRAUD_BLOCK' };
  }

  const premium = parseFloat(premium_paid);
  if (isNaN(premium) || premium < 0) {
    return { ok: false, status: 400, error: 'premium_paid must be a non-negative number', code: 'INVALID_PREMIUM' };
  }

  const effProvider = provider_id || quoteEval.record?.provider_id || 'safecover';
  const effPlan = plan_id || quoteEval.record?.plan_id || 'standard';
  const scenario = getScenario(scenarioId);
  const provider = providerMap.get(effProvider);
  const plan = planMap.get(`${effProvider}:${effPlan}`);
  const coverage = plan?.coverage ?? scenario.max_value;
  const commissionRate = provider?.commission_rate ?? 0.15;
  const commission = parseFloat((premium * commissionRate).toFixed(2));

  const policyId = 'POL_' + Date.now();
  const bcResult = await blockchain.recordPolicy(policyId, customerForPolicy.email, premium, coverage);

  const pos_context = posMeta(terminal, ticketId);

  let policy = {
    policy_id: policyId,
    provider_id: effProvider,
    plan_id: effPlan,
    provider_name: provider?.name || 'SafeCover',
    premium,
    commission,
    commission_rate: commissionRate,
    transaction_id,
    customer: customerForPolicy,
    quote_id,
    scenario: scenarioId || 'retail',
    jurisdiction: offering.jurisdiction || null,
    fraud_decision: fraudResult.decision,
    fraud_score: fraudResult.score,
    fraud_reasons: fraudResult.reasons,
    coverage_details: {
      type: scenario.coverage_type,
      max_value: coverage,
      duration: scenario.duration,
    },
    smart_contract_url: bcResult.smart_contract_url,
    tx_hash: bcResult.tx_hash,
    contract_address: bcResult.contract_address,
    execution_steps: bcResult.execution_steps,
    constructor_args: bcResult.constructor_args,
    recorded_at: new Date().toISOString(),
    partner_id: partnerId,
    status: 'PENDING_PAYMENT',
    bind_idempotency_key: bindIdem || null,
    pos_context,
  };
  policy = insurerCore.attachRegulatorySnapshot(policy);
  policy = certificateService.attachCertificateToPolicy(policy, req, {
    scenario,
    plan,
    provider,
    items,
    partnerId,
    planName: plan?.name,
  });

  store.savePolicy(policy);
  if (quoteEval.record) store.consumeQuoteRecord(quote_id);
  store.recordAnalytics({
    type: 'bind',
    policy_id: policyId,
    premium,
    commission,
    partner_id: partnerId,
    channel: 'pos',
    pos_store_id: pos_context.store_id,
    pos_register_id: pos_context.register_id,
  });

  insurer.forwardToInsurer(policy).catch((e) => {
    console.error('[Insurer] Forward failed for policy', policy.policy_id, e);
  });

  return {
    ok: true,
    json: {
      policy_id: policyId,
      certificate_id: policy.certificate_id,
      provider_id: policy.provider_id,
      plan_id: policy.plan_id,
      provider_name: policy.provider_name,
      certificate_url: policy.certificate_url,
      smart_contract_url: bcResult.smart_contract_url,
      contract_address: bcResult.contract_address,
      tx_hash: bcResult.tx_hash,
      execution_steps: bcResult.execution_steps,
      constructor_args: bcResult.constructor_args,
      coverage_details: policy.coverage_details,
      fraud_decision: fraudResult.decision,
      fraud_score: fraudResult.score,
      status: policy.status,
      disclosures: offering.disclosures,
      transaction_id,
      pos: pos_context,
    },
  };
}

function performConfirm(req, body, terminal, ticketId) {
  const { policy_id, payment_reference } = body;
  const transaction_id = body.transaction_id || transactionIdForPos(terminal, ticketId);
  if (!transaction_id) {
    return { ok: false, status: 400, error: 'ticket_id or transaction_id is required', code: 'INVALID_TRANSACTION_ID' };
  }
  if (!policy_id?.trim()) return { ok: false, status: 400, error: 'policy_id is required', code: 'INVALID_POLICY_ID' };

  const policy = store.getPolicy(policy_id);
  if (!policy) return { ok: false, status: 404, error: 'Policy not found', code: 'POLICY_NOT_FOUND' };
  if (policy.transaction_id !== transaction_id) {
    return { ok: false, status: 400, error: 'transaction_id does not match policy', code: 'TRANSACTION_MISMATCH' };
  }

  if (policy.status === 'ACTIVE') {
    return {
      ok: true,
      json: {
        policy_id,
        status: policy.status,
        confirmed_at: policy.confirmed_at,
        payment_reference: policy.payment_reference || null,
        certificate_url: policy.certificate_url || certificateService.buildCertificateUrl(req, policy),
        idempotent: true,
        pos: policy.pos_context || null,
      },
    };
  }

  if (policy.status !== 'PENDING_PAYMENT') {
    return {
      ok: false,
      status: 400,
      error: 'Policy cannot be confirmed from current status',
      code: 'INVALID_POLICY_STATE',
    };
  }

  const confirmedAt = new Date().toISOString();
  let updated = store.updatePolicy(policy_id, {
    status: 'ACTIVE',
    confirmed_at: confirmedAt,
    payment_reference: payment_reference || null,
    actor: req.partnerId || 'system',
  });
  const refreshed = certificateService.refreshCertificateAfterConfirm(
    { ...updated, confirmed_at: confirmedAt },
    req
  );
  updated = store.updatePolicy(policy_id, {
    period: refreshed.period,
    certificate_url: refreshed.certificate_url,
  });

  return {
    ok: true,
    json: {
      policy_id,
      status: updated.status,
      confirmed_at: updated.confirmed_at,
      payment_reference: updated.payment_reference,
      certificate_url: updated.certificate_url,
      pos: policy.pos_context || null,
    },
  };
}

async function handlePosEnhanced(req, res) {
  try {
    const body = req.body || {};
    const operation = String(body.operation || '').toLowerCase();
    const allowed = new Set(['quote', 'bind', 'confirm', 'sale']);
    if (!allowed.has(operation)) {
      return jsonErr(res, 400, 'operation must be quote, bind, confirm, or sale', 'INVALID_OPERATION');
    }

    const termRes = validateTerminal(body.terminal);
    if (!termRes.ok) return jsonErr(res, 400, termRes.error, termRes.code);
    const terminal = body.terminal;
    const ticketId = body.ticket_id != null ? String(body.ticket_id).trim() : '';

    if (operation === 'quote') {
      const norm = normalizePosItems(body.items);
      if (!norm.ok) return jsonErr(res, 400, norm.error, norm.code);
      const items = norm.items;
      const validation = validateQuoteItems(items);
      if (!validation.valid) return jsonErr(res, 400, validation.error, 'INVALID_ITEMS');

      const { scenario: scenarioId, jurisdiction } = body;
      const comp = compliance.complianceCheck({ jurisdiction, scenario: scenarioId });
      if (!comp.valid) return jsonErr(res, 400, comp.error || 'Compliance check failed', 'COMPLIANCE_ERROR');

      const scenario = getScenario(scenarioId);
      const value = items.reduce((s, i) => s + (i.value || 0), 0);
      const quotes = actuarial.generateCompetitiveQuotes(items, scenarioId || 'retail');
      if (!quotes.length) {
        return jsonErr(res, 503, 'No quotes available (no providers/plans configured)', 'NO_QUOTES');
      }
      const best = quotes.reduce((a, b) => (a.premium < b.premium ? a : b));
      const premium = best.premium;
      const quoteId = 'QTY' + Date.now();
      quoteRegistry.registerQuote(store, {
        quote_id: quoteId,
        partner_id: req.partnerId,
        items,
        premium,
        provider_id: best.provider_id,
        plan_id: best.plan_id,
        scenario: scenario.id,
        jurisdiction: comp.jurisdiction,
      });

      store.recordAnalytics({
        type: 'quote',
        partner_id: req.partnerId,
        scenario: scenario.id,
        jurisdiction: comp.jurisdiction,
        channel: 'pos',
        pos_store_id: String(terminal.store_id).trim(),
        pos_register_id: String(terminal.register_id).trim(),
      });

      const suggestedTx = ticketId ? transactionIdForPos(terminal, ticketId) : null;
      const idemHint = ticketId ? bindIdempotencyForPos(req.partnerId, terminal, ticketId) : null;

      return res.json({
        operation: 'quote',
        quote_id: quoteId,
        premium,
        scenario: scenario.id,
        jurisdiction: comp.jurisdiction,
        disclosures: comp.disclosures,
        actuarial: best.actuarial,
        coverage: {
          type: scenario.coverage_type,
          max_value: scenario.max_value,
          duration: scenario.duration,
        },
        provider_id: best.provider_id,
        plan_id: best.plan_id,
        pos: posMeta(terminal, ticketId || null),
        suggested_transaction_id: suggestedTx,
        suggested_bind_idempotency_key: idemHint,
      });
    }

    if (operation === 'bind') {
      if (!ticketId && !body.transaction_id) {
        return jsonErr(res, 400, 'ticket_id (or transaction_id) is required for bind', 'INVALID_TRANSACTION_ID');
      }
      const norm = normalizePosItems(body.items);
      if (!norm.ok) return jsonErr(res, 400, norm.error, norm.code);
      const items = norm.items;
      const v = validateQuoteItems(items);
      if (!v.valid) return jsonErr(res, 400, v.error, 'INVALID_ITEMS');

      const bindResult = await performBind(req, body, terminal, ticketId, items);
      if (!bindResult.ok) return jsonErr(res, bindResult.status, bindResult.error, bindResult.code);
      return res.json({ operation: 'bind', ...bindResult.json });
    }

    if (operation === 'confirm') {
      if (!ticketId && !body.transaction_id) {
        return jsonErr(res, 400, 'ticket_id (or transaction_id) is required for confirm', 'INVALID_TRANSACTION_ID');
      }
      const c = performConfirm(req, body, terminal, ticketId);
      if (!c.ok) return jsonErr(res, c.status, c.error, c.code);
      return res.json({ operation: 'confirm', ...c.json });
    }

    if (operation === 'sale') {
      if (!body.payment_captured) {
        return jsonErr(
          res,
          400,
          'sale requires payment_captured: true after card/cash tender at the register',
          'PAYMENT_NOT_CAPTURED'
        );
      }
      if (!ticketId && !body.transaction_id) {
        return jsonErr(res, 400, 'ticket_id (or transaction_id) is required for sale', 'INVALID_TRANSACTION_ID');
      }
      const norm = normalizePosItems(body.items);
      if (!norm.ok) return jsonErr(res, 400, norm.error, norm.code);
      const items = norm.items;
      const v = validateQuoteItems(items);
      if (!v.valid) return jsonErr(res, 400, v.error, 'INVALID_ITEMS');

      const bindResult = await performBind(req, body, terminal, ticketId, items);
      if (!bindResult.ok) return jsonErr(res, bindResult.status, bindResult.error, bindResult.code);
      if (bindResult.idempotent) {
        const conf = performConfirm(req, { ...body, policy_id: bindResult.json.policy_id }, terminal, ticketId);
        if (!conf.ok) return jsonErr(res, conf.status, conf.error, conf.code);
        return res.json({
          operation: 'sale',
          bind: { idempotent: true, ...bindResult.json },
          confirm: conf.json,
        });
      }

      const conf = performConfirm(
        req,
        {
          policy_id: bindResult.json.policy_id,
          transaction_id: bindResult.json.transaction_id,
          payment_reference: body.payment_reference,
        },
        terminal,
        ticketId
      );
      if (!conf.ok) return jsonErr(res, conf.status, conf.error, conf.code);
      store.recordAnalytics({
        type: 'pos_sale',
        policy_id: bindResult.json.policy_id,
        partner_id: req.partnerId,
        channel: 'pos',
      });
      return res.json({
        operation: 'sale',
        bind: bindResult.json,
        confirm: conf.json,
      });
    }

    return jsonErr(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  } catch (e) {
    console.error('POS enhanced error:', e);
    return jsonErr(res, 500, 'Internal server error', 'INTERNAL_ERROR');
  }
}

module.exports = {
  handlePosEnhanced,
  normalizePosItems,
  validateTerminal,
  transactionIdForPos,
  bindIdempotencyForPos,
};
