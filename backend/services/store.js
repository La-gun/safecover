/**
 * Store - SQLite with JSON fallback, audit trail
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');
const CLAIMS_FILE = path.join(DATA_DIR, 'claims.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const QUOTES_FILE = path.join(DATA_DIR, 'quotes.json');

let dbModule = null;
try {
  dbModule = require('./db');
} catch (e) {
  // db not available
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson(file, defaultVal = []) {
  ensureDir();
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch {
    return defaultVal;
  }
}

function writeJson(file, data) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function useDb() {
  if (!dbModule) return false;
  try {
    const d = dbModule.getDb();
    return !!d;
  } catch {
    return false;
  }
}

function policies() {
  if (useDb()) return dbModule.policiesFromDb();
  return readJson(POLICIES_FILE, []).map(normalizePolicy);
}

function savePolicy(policy) {
  if (useDb()) return dbModule.savePolicyToDb(policy);
  const policies = readJson(POLICIES_FILE, []);
  const idx = policies.findIndex((p) => p.policy_id === policy.policy_id);
  if (idx >= 0) policies[idx] = policy;
  else policies.push(policy);
  writeJson(POLICIES_FILE, policies);
  return policy;
}

function getPolicy(id) {
  if (useDb()) return dbModule.getPolicyFromDb(id);
  const p = readJson(POLICIES_FILE, []).find((x) => x.policy_id === id);
  return p ? normalizePolicy(p) : null;
}

function normalizePolicy(p) {
  if (!p) return p;
  return {
    ...p,
    status: p.status || 'ACTIVE',
    regulatory_snapshot: p.regulatory_snapshot || null,
  };
}

function updatePolicy(policyId, patch) {
  if (useDb()) return dbModule.updatePolicyInDb(policyId, patch);
  const all = readJson(POLICIES_FILE, []);
  const idx = all.findIndex((p) => p.policy_id === policyId);
  if (idx < 0) return null;
  all[idx] = { ...normalizePolicy(all[idx]), ...patch };
  writeJson(POLICIES_FILE, all);
  return all[idx];
}

function getPolicyByBindIdempotency(key) {
  if (!key) return null;
  if (useDb()) return dbModule.getPolicyByBindIdempotencyFromDb(key);
  return readJson(POLICIES_FILE, []).find((p) => p.bind_idempotency_key === key) || null;
}

function saveQuoteRecord(record) {
  if (useDb()) return dbModule.saveQuoteRecordToDb(record);
  const all = readJson(QUOTES_FILE, []);
  const idx = all.findIndex((q) => q.quote_id === record.quote_id);
  if (idx >= 0) all[idx] = record;
  else all.push(record);
  writeJson(QUOTES_FILE, all);
  return record;
}

function getQuoteRecord(quoteId) {
  if (useDb()) return dbModule.getQuoteRecordFromDb(quoteId);
  return readJson(QUOTES_FILE, []).find((q) => q.quote_id === quoteId) || null;
}

function consumeQuoteRecord(quoteId) {
  if (useDb()) return dbModule.consumeQuoteRecordInDb(quoteId);
  const all = readJson(QUOTES_FILE, []);
  const q = all.find((x) => x.quote_id === quoteId);
  if (q) {
    q.consumed = 1;
    writeJson(QUOTES_FILE, all);
  }
}

function claims() {
  if (useDb()) return dbModule.claimsFromDb();
  return readJson(CLAIMS_FILE, []);
}

function saveClaim(claim) {
  if (useDb()) return dbModule.saveClaimToDb(claim);
  const claims = readJson(CLAIMS_FILE, []);
  const idx = claims.findIndex((c) => c.claim_id === claim.claim_id);
  if (idx >= 0) claims[idx] = claim;
  else claims.push(claim);
  writeJson(CLAIMS_FILE, claims);
  return claim;
}

function updateClaim(id, updates) {
  if (useDb()) return dbModule.updateClaimInDb(id, updates);
  const all = readJson(CLAIMS_FILE, []);
  const idx = all.findIndex((c) => c.claim_id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    writeJson(CLAIMS_FILE, all);
    return all[idx];
  }
  return null;
}

const MAX_ANALYTICS_EVENTS = 999;

function recordAnalytics(event) {
  const data = readJson(ANALYTICS_FILE, { quotes: 0, binds: 0, claims: 0, events: [] });
  const events = (data.events || []).slice(-MAX_ANALYTICS_EVENTS);
  events.push({ ...event, ts: new Date().toISOString() });
  data.events = events;
  if (event.type === 'quote') data.quotes = (data.quotes || 0) + 1;
  if (event.type === 'bind') data.binds = (data.binds || 0) + 1;
  if (event.type === 'claim') data.claims = (data.claims || 0) + 1;
  writeJson(ANALYTICS_FILE, data);
  return data;
}

function getAnalytics() {
  return readJson(ANALYTICS_FILE, { quotes: 0, binds: 0, claims: 0, events: [] });
}

function getAuditLog(entityType, entityId, limit = 50) {
  if (useDb() && dbModule.getAuditLog) return dbModule.getAuditLog(entityType, entityId, limit);
  const all = readJson(AUDIT_FILE, []);
  const filtered = all.filter((e) => e && e.entityType === entityType && e.entityId === entityId);
  return filtered.slice(-Math.max(1, limit));
}

function appendAuditLog(entityType, entityId, entry) {
  if (!entityType || !entityId) return null;
  const safeEntry = {
    entityType,
    entityId,
    ts: new Date().toISOString(),
    ...entry,
  };
  // Prefer DB audit if available
  if (useDb() && dbModule.appendAuditLog) return dbModule.appendAuditLog(entityType, entityId, safeEntry);
  const all = readJson(AUDIT_FILE, []);
  all.push(safeEntry);
  // Keep file bounded
  const bounded = all.slice(-5000);
  writeJson(AUDIT_FILE, bounded);
  return safeEntry;
}

function migrateJsonToDb() {
  if (!useDb()) return;
  try {
    const dbPolicies = dbModule.policiesFromDb();
    if (dbPolicies.length > 0) return; // already migrated
    const existingPolicies = readJson(POLICIES_FILE, []);
    const existingClaims = readJson(CLAIMS_FILE, []);
    if (existingPolicies.length > 0 || existingClaims.length > 0) {
      existingPolicies.forEach((p) =>
        dbModule.savePolicyToDb({ ...normalizePolicy(p), status: p.status || 'ACTIVE' })
      );
      existingClaims.forEach((c) => dbModule.saveClaimToDb(c));
      console.log('Migrated', existingPolicies.length, 'policies and', existingClaims.length, 'claims to SQLite');
    }
  } catch (e) {
    console.warn('Migration skipped:', e.message);
  }
}

try {
  migrateJsonToDb();
} catch (e) {
  // ignore
}

module.exports = {
  policies,
  savePolicy,
  getPolicy,
  updatePolicy,
  getPolicyByBindIdempotency,
  saveQuoteRecord,
  getQuoteRecord,
  consumeQuoteRecord,
  claims,
  saveClaim,
  updateClaim,
  recordAnalytics,
  getAnalytics,
  getAuditLog,
  appendAuditLog,
};
