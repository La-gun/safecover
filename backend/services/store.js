/**
 * Store - SQLite with JSON fallback, audit trail
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');
const CLAIMS_FILE = path.join(DATA_DIR, 'claims.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

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
  return readJson(POLICIES_FILE, []);
}

function savePolicy(policy) {
  if (useDb()) return dbModule.savePolicyToDb(policy);
  const policies = readJson(POLICIES_FILE, []);
  policies.push(policy);
  writeJson(POLICIES_FILE, policies);
  return policy;
}

function getPolicy(id) {
  if (useDb()) return dbModule.getPolicyFromDb(id);
  return readJson(POLICIES_FILE, []).find((p) => p.policy_id === id);
}

function claims() {
  if (useDb()) return dbModule.claimsFromDb();
  return readJson(CLAIMS_FILE, []);
}

function saveClaim(claim) {
  if (useDb()) return dbModule.saveClaimToDb(claim);
  const claims = readJson(CLAIMS_FILE, []);
  claims.push(claim);
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

function recordAnalytics(event) {
  const data = readJson(ANALYTICS_FILE, { quotes: 0, binds: 0, claims: 0, events: [] });
  data.events = (data.events || []).slice(-999);
  data.events.push({ ...event, ts: new Date().toISOString() });
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
  return [];
}

function migrateJsonToDb() {
  if (!useDb()) return;
  try {
    const dbPolicies = dbModule.policiesFromDb();
    if (dbPolicies.length > 0) return; // already migrated
    const existingPolicies = readJson(POLICIES_FILE, []);
    const existingClaims = readJson(CLAIMS_FILE, []);
    if (existingPolicies.length > 0 || existingClaims.length > 0) {
      existingPolicies.forEach((p) => dbModule.savePolicyToDb(p));
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
  claims,
  saveClaim,
  updateClaim,
  recordAnalytics,
  getAnalytics,
  getAuditLog,
};
