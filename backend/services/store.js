/**
 * Simple JSON file store for policies, claims, and analytics
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const POLICIES_FILE = path.join(DATA_DIR, 'policies.json');
const CLAIMS_FILE = path.join(DATA_DIR, 'claims.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

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

function policies() {
  return readJson(POLICIES_FILE, []);
}

function savePolicy(policy) {
  const policies = readJson(POLICIES_FILE, []);
  policies.push(policy);
  writeJson(POLICIES_FILE, policies);
  return policy;
}

function getPolicy(id) {
  return policies().find((p) => p.policy_id === id);
}

function claims() {
  return readJson(CLAIMS_FILE, []);
}

function saveClaim(claim) {
  const claims = readJson(CLAIMS_FILE, []);
  claims.push(claim);
  writeJson(CLAIMS_FILE, claims);
  return claim;
}

function updateClaim(id, updates) {
  const all = claims();
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

module.exports = {
  policies,
  savePolicy,
  getPolicy,
  claims,
  saveClaim,
  updateClaim,
  recordAnalytics,
  getAnalytics,
};
