/**
 * SQLite database with audit trail
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
    CREATE INDEX IF NOT EXISTS idx_policies_email ON policies(customer);
    CREATE INDEX IF NOT EXISTS idx_claims_policy ON claims(policy_id);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
  `);
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

function rowToPolicy(r) {
  return {
    policy_id: r.policy_id,
    provider_id: r.provider_id,
    plan_id: r.plan_id,
    provider_name: r.provider_name,
    premium: r.premium,
    commission: r.commission,
    transaction_id: r.transaction_id,
    customer: typeof r.customer === 'string' ? JSON.parse(r.customer || '{}') : r.customer,
    quote_id: r.quote_id,
    scenario: r.scenario,
    jurisdiction: r.jurisdiction,
    coverage_details: typeof r.coverage_details === 'string' ? JSON.parse(r.coverage_details || '{}') : r.coverage_details,
    tx_hash: r.tx_hash,
    contract_address: r.contract_address,
    execution_steps: typeof r.execution_steps === 'string' ? JSON.parse(r.execution_steps || '[]') : r.execution_steps,
    constructor_args: typeof r.constructor_args === 'string' ? JSON.parse(r.constructor_args || '{}') : r.constructor_args,
    partner_id: r.partner_id,
    recorded_at: r.recorded_at,
  };
}

function savePolicyToDb(policy) {
  const d = getDb();
  if (!d) return policy;
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO policies (policy_id, provider_id, plan_id, provider_name, premium, commission, transaction_id, customer, quote_id, scenario, jurisdiction, coverage_details, tx_hash, contract_address, execution_steps, constructor_args, partner_id, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    policy.policy_id,
    policy.provider_id,
    policy.plan_id,
    policy.provider_name,
    policy.premium,
    policy.commission,
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
    policy.recorded_at
  );
  audit('policy', policy.policy_id, 'create', null, policy, policy.partner_id);
  return policy;
}

function getPolicyFromDb(id) {
  const d = getDb();
  if (!d) return null;
  const row = d.prepare('SELECT * FROM policies WHERE policy_id = ?').get(id);
  return row ? rowToPolicy(row) : null;
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
    trigger_data: typeof r.trigger_data === 'string' ? JSON.parse(r.trigger_data || '{}') : r.trigger_data,
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
  getPolicyFromDb,
  claimsFromDb,
  saveClaimToDb,
  updateClaimInDb,
  getAuditLog,
  audit,
};
