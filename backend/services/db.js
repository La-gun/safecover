/**
 * SQLite database with audit trail, quote ledger, and policy lifecycle columns.
 * Uses better-sqlite3 for production-grade persistence
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'safecover.db');

let db = null;

function getDb() {
  if (db !== null) return db;
  try {
    const Database = require('better-sqlite3');
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    initSchema(db);
    return db;
  } catch (e) {
    db = false;
    console.warn('SQLite unavailable, using JSON fallback:', e.message);
    return null;
  }
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      policy_id TEXT PRIMARY KEY,
      provider_id TEXT,
      plan_id TEXT,
      provider_name TEXT,
      premium REAL,
      commission REAL,
      transaction_id TEXT,
      customer TEXT,
      quote_id TEXT,
      scenario TEXT,
      jurisdiction TEXT,
      coverage_details TEXT,
      tx_hash TEXT,
      contract_address TEXT,
      execution_steps TEXT,
      constructor_args TEXT,
      partner_id TEXT,
      recorded_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS claims (
      claim_id TEXT PRIMARY KEY,
      policy_id TEXT,
      claim_type TEXT,
      description TEXT,
      amount REAL,
      status TEXT,
      trigger_type TEXT,
      trigger_data TEXT,
      payout_amount REAL,
      payout_at TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (policy_id) REFERENCES policies(policy_id)
    );
    CREATE TABLE IF NOT EXISTS analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT,
      event_data TEXT,
      partner_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT,
      entity_id TEXT,
      action TEXT,
      old_value TEXT,
      new_value TEXT,
      actor TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT,
      api_key_hash TEXT,
      api_key_prefix TEXT,
      sandbox BOOLEAN DEFAULT 1,
      jurisdiction TEXT DEFAULT 'US',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS quotes (
      quote_id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      premium REAL NOT NULL,
      provider_id TEXT,
      plan_id TEXT,
      scenario TEXT,
      jurisdiction TEXT,
      items_fingerprint TEXT NOT NULL,
      signature TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_policies_email ON policies(customer);
    CREATE INDEX IF NOT EXISTS idx_claims_policy ON claims(policy_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_expires ON quotes(expires_at);
  `);
  migrateFraudColumns(database);
  migratePolicyLifecycleColumns(database);
  try {
    database.exec(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_policies_bind_idem ON policies(bind_idempotency_key) WHERE bind_idempotency_key IS NOT NULL'
    );
  } catch (e) {
    // column may not exist yet on very old DBs before migration runs
  }
}

function migrateFraudColumns(database) {
  try {
    const cols = database.prepare('PRAGMA table_info(policies)').all();
    const names = new Set(cols.map((c) => c.name));
    if (!names.has('fraud_decision')) {
      database.exec('ALTER TABLE policies ADD COLUMN fraud_decision TEXT');
      database.exec('ALTER TABLE policies ADD COLUMN fraud_score REAL');
      database.exec('ALTER TABLE policies ADD COLUMN fraud_reasons TEXT');
    }
  } catch (e) {
    console.warn('Fraud column migration:', e.message);
  }
}

function migratePolicyLifecycleColumns(database) {
  try {
    const cols = database.prepare('PRAGMA table_info(policies)').all();
    const names = new Set(cols.map((c) => c.name));
    const add = (name, ddl) => {
      if (!names.has(name)) database.exec(ddl);
    };
    add('status', 'ALTER TABLE policies ADD COLUMN status TEXT');
    add('confirmed_at', 'ALTER TABLE policies ADD COLUMN confirmed_at TEXT');
    add('payment_reference', 'ALTER TABLE policies ADD COLUMN payment_reference TEXT');
    add('bind_idempotency_key', 'ALTER TABLE policies ADD COLUMN bind_idempotency_key TEXT');
    add('regulatory_snapshot', 'ALTER TABLE policies ADD COLUMN regulatory_snapshot TEXT');
    add('commission_rate', 'ALTER TABLE policies ADD COLUMN commission_rate REAL');
    add('extras', 'ALTER TABLE policies ADD COLUMN extras TEXT');
    database.exec("UPDATE policies SET status = 'ACTIVE' WHERE status IS NULL");
  } catch (e) {
    console.warn('Policy lifecycle migration:', e.message);
  }
}

function audit(entityType, entityId, action, oldVal, newVal, actor = 'system') {
  const d = getDb();
  if (!d) return;
  try {
    d.prepare(
      'INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, actor) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(entityType, entityId, action, oldVal ? JSON.stringify(oldVal) : null, newVal ? JSON.stringify(newVal) : null, actor);
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
}

function policiesFromDb() {
  const d = getDb();
  if (!d) return [];
  const rows = d.prepare('SELECT * FROM policies ORDER BY created_at DESC').all();
  return rows.map(rowToPolicy);
}

function safeParse(val, fallback) {
  if (val == null) return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val || (typeof fallback === 'object' ? '{}' : '[]'));
  } catch {
    return fallback;
  }
}

/** Certificate / schedule fields and POS context — stored as JSON (extras column). */
function packPolicyExtras(p) {
  if (!p || typeof p !== 'object') return {};
  const keys = [
    'certificate_id',
    'certificate_token',
    'certificate_url',
    'period',
    'schedule',
    'insured_items',
    'insurer_legal',
    'excess',
    'currency',
    'product',
    'broker_or_platform',
    'pos_context',
    'smart_contract_url',
  ];
  const o = {};
  for (const k of keys) {
    if (p[k] !== undefined) o[k] = p[k];
  }
  return o;
}

function rowToPolicy(r) {
  const base = {
    policy_id: r.policy_id,
    provider_id: r.provider_id,
    plan_id: r.plan_id,
    provider_name: r.provider_name,
    premium: r.premium,
    commission: r.commission,
    commission_rate: r.commission_rate != null ? r.commission_rate : undefined,
    transaction_id: r.transaction_id,
    customer: safeParse(r.customer, {}),
    quote_id: r.quote_id,
    scenario: r.scenario,
    jurisdiction: r.jurisdiction,
    coverage_details: safeParse(r.coverage_details, {}),
    tx_hash: r.tx_hash,
    contract_address: r.contract_address,
    execution_steps: safeParse(r.execution_steps, []),
    constructor_args: safeParse(r.constructor_args, {}),
    partner_id: r.partner_id,
    recorded_at: r.recorded_at,
    fraud_decision: r.fraud_decision,
    fraud_score: r.fraud_score != null ? r.fraud_score : undefined,
    fraud_reasons: safeParse(r.fraud_reasons, []),
    status: r.status || 'ACTIVE',
    confirmed_at: r.confirmed_at || null,
    payment_reference: r.payment_reference || null,
    bind_idempotency_key: r.bind_idempotency_key || null,
    regulatory_snapshot: safeParse(r.regulatory_snapshot, null),
  };
  const ex = safeParse(r.extras, {});
  return { ...base, ...ex };
}

function savePolicyToDb(policy) {
  const d = getDb();
  if (!d) return policy;
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO policies (
      policy_id, provider_id, plan_id, provider_name, premium, commission, commission_rate,
      transaction_id, customer, quote_id, scenario, jurisdiction, coverage_details,
      tx_hash, contract_address, execution_steps, constructor_args, partner_id, recorded_at,
      fraud_decision, fraud_score, fraud_reasons,
      status, confirmed_at, payment_reference, bind_idempotency_key, regulatory_snapshot,
      extras
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    policy.policy_id,
    policy.provider_id,
    policy.plan_id,
    policy.provider_name,
    policy.premium,
    policy.commission,
    policy.commission_rate ?? null,
    policy.transaction_id,
    JSON.stringify(policy.customer || {}),
    policy.quote_id,
    policy.scenario,
    policy.jurisdiction,
    JSON.stringify(policy.coverage_details || {}),
    policy.tx_hash,
    policy.contract_address,
    JSON.stringify(policy.execution_steps || []),
    JSON.stringify(policy.constructor_args || {}),
    policy.partner_id,
    policy.recorded_at,
    policy.fraud_decision || null,
    policy.fraud_score ?? null,
    JSON.stringify(policy.fraud_reasons || []),
    policy.status || 'PENDING_PAYMENT',
    policy.confirmed_at || null,
    policy.payment_reference || null,
    policy.bind_idempotency_key || null,
    JSON.stringify(policy.regulatory_snapshot || {}),
    JSON.stringify(packPolicyExtras(policy))
  );
  audit('policy', policy.policy_id, 'create', null, policy, policy.partner_id);
  return policy;
}

function updatePolicyInDb(policyId, patch) {
  const d = getDb();
  if (!d) return null;
  const existing = d.prepare('SELECT * FROM policies WHERE policy_id = ?').get(policyId);
  if (!existing) return null;
  const cur = rowToPolicy(existing);
  const merged = { ...cur, ...patch };
  d.prepare(`
    INSERT OR REPLACE INTO policies (
      policy_id, provider_id, plan_id, provider_name, premium, commission, commission_rate,
      transaction_id, customer, quote_id, scenario, jurisdiction, coverage_details,
      tx_hash, contract_address, execution_steps, constructor_args, partner_id, recorded_at,
      fraud_decision, fraud_score, fraud_reasons,
      status, confirmed_at, payment_reference, bind_idempotency_key, regulatory_snapshot,
      extras
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    merged.policy_id,
    merged.provider_id,
    merged.plan_id,
    merged.provider_name,
    merged.premium,
    merged.commission,
    merged.commission_rate ?? null,
    merged.transaction_id,
    JSON.stringify(merged.customer || {}),
    merged.quote_id,
    merged.scenario,
    merged.jurisdiction,
    JSON.stringify(merged.coverage_details || {}),
    merged.tx_hash,
    merged.contract_address,
    JSON.stringify(merged.execution_steps || []),
    JSON.stringify(merged.constructor_args || {}),
    merged.partner_id,
    merged.recorded_at,
    merged.fraud_decision || null,
    merged.fraud_score ?? null,
    JSON.stringify(merged.fraud_reasons || []),
    merged.status || 'PENDING_PAYMENT',
    merged.confirmed_at ?? null,
    merged.payment_reference ?? null,
    merged.bind_idempotency_key || null,
    JSON.stringify(merged.regulatory_snapshot || {}),
    JSON.stringify(packPolicyExtras(merged))
  );
  const updated = d.prepare('SELECT * FROM policies WHERE policy_id = ?').get(policyId);
  const out = rowToPolicy(updated);
  audit('policy', policyId, 'update', cur, out, patch.actor || 'system');
  return out;
}

function getPolicyFromDb(id) {
  const d = getDb();
  if (!d) return null;
  const row = d.prepare('SELECT * FROM policies WHERE policy_id = ?').get(id);
  return row ? rowToPolicy(row) : null;
}

function getPolicyByBindIdempotencyFromDb(key) {
  const d = getDb();
  if (!d || !key) return null;
  const row = d.prepare('SELECT * FROM policies WHERE bind_idempotency_key = ?').get(key);
  return row ? rowToPolicy(row) : null;
}

function saveQuoteRecordToDb(record) {
  const d = getDb();
  if (!d) return record;
  d.prepare(`
    INSERT OR REPLACE INTO quotes (
      quote_id, partner_id, premium, provider_id, plan_id, scenario, jurisdiction,
      items_fingerprint, signature, expires_at, consumed, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))
  `).run(
    record.quote_id,
    record.partner_id,
    record.premium,
    record.provider_id,
    record.plan_id,
    record.scenario,
    record.jurisdiction,
    record.items_fingerprint,
    record.signature,
    record.expires_at,
    record.consumed ?? 0,
    record.created_at || null
  );
  return record;
}

function getQuoteRecordFromDb(quoteId) {
  const d = getDb();
  if (!d) return null;
  const r = d.prepare('SELECT * FROM quotes WHERE quote_id = ?').get(quoteId);
  if (!r) return null;
  return {
    quote_id: r.quote_id,
    partner_id: r.partner_id,
    premium: r.premium,
    provider_id: r.provider_id,
    plan_id: r.plan_id,
    scenario: r.scenario,
    jurisdiction: r.jurisdiction,
    items_fingerprint: r.items_fingerprint,
    signature: r.signature,
    expires_at: r.expires_at,
    consumed: r.consumed,
    created_at: r.created_at,
  };
}

function consumeQuoteRecordInDb(quoteId) {
  const d = getDb();
  if (!d) return;
  d.prepare('UPDATE quotes SET consumed = 1 WHERE quote_id = ?').run(quoteId);
}

function claimsFromDb() {
  const d = getDb();
  if (!d) return [];
  const rows = d.prepare('SELECT * FROM claims ORDER BY created_at DESC').all();
  return rows.map(rowToClaim);
}

function rowToClaim(r) {
  return {
    claim_id: r.claim_id,
    policy_id: r.policy_id,
    claim_type: r.claim_type,
    description: r.description,
    amount: r.amount,
    status: r.status,
    trigger_type: r.trigger_type,
    trigger_data: safeParse(r.trigger_data, {}),
    payout_amount: r.payout_amount,
    payout_at: r.payout_at,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function saveClaimToDb(claim) {
  const d = getDb();
  if (!d) return claim;
  d.prepare(`
    INSERT OR REPLACE INTO claims (claim_id, policy_id, claim_type, description, amount, status, trigger_type, trigger_data, payout_amount, payout_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    claim.claim_id,
    claim.policy_id,
    claim.claim_type,
    claim.description,
    claim.amount,
    claim.status,
    claim.trigger_type,
    JSON.stringify(claim.trigger_data || {}),
    claim.payout_amount,
    claim.payout_at,
    claim.created_at || new Date().toISOString(),
    claim.updated_at || new Date().toISOString()
  );
  audit('claim', claim.claim_id, 'create', null, claim);
  return claim;
}

function updateClaimInDb(id, updates) {
  const d = getDb();
  if (!d) return null;
  const existing = d.prepare('SELECT * FROM claims WHERE claim_id = ?').get(id);
  if (!existing) return null;
  const merged = { ...rowToClaim(existing), ...updates, updated_at: new Date().toISOString() };
  d.prepare(`
    UPDATE claims SET status=?, description=?, amount=?, payout_amount=?, payout_at=?, updated_at=? WHERE claim_id=?
  `).run(merged.status, merged.description, merged.amount, merged.payout_amount, merged.payout_at || null, merged.updated_at, id);
  audit('claim', id, 'update', existing, merged);
  return merged;
}

function getAuditLog(entityType, entityId, limit = 50) {
  const d = getDb();
  if (!d) return [];
  const rows = d.prepare(
    'SELECT * FROM audit_log WHERE entity_type=? AND entity_id=? ORDER BY created_at DESC LIMIT ?'
  ).all(entityType, entityId, limit);
  return rows;
}

module.exports = {
  getDb,
  policiesFromDb,
  savePolicyToDb,
  updatePolicyInDb,
  getPolicyFromDb,
  getPolicyByBindIdempotencyFromDb,
  saveQuoteRecordToDb,
  getQuoteRecordFromDb,
  consumeQuoteRecordInDb,
  claimsFromDb,
  saveClaimToDb,
  updateClaimInDb,
  getAuditLog,
  audit,
};
