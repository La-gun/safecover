/**
 * Partner management - API keys, sandbox
 */
const crypto = require('crypto');
let db = null;
try {
  db = require('./db');
} catch (e) {}

const inMemoryPartners = [];
const inMemoryKeys = new Map();

function generateApiKey() {
  return 'sk_' + crypto.randomBytes(24).toString('hex');
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function createPartner(name, sandbox = true, jurisdiction = 'US') {
  const id = 'partner_' + Date.now();
  const apiKey = generateApiKey();
  const hash = hashKey(apiKey);
  const prefix = apiKey.substring(0, 12) + '...';

  const d = db && db.getDb ? db.getDb() : null;
  if (d) {
    try {
      d.prepare(
        'INSERT INTO partners (id, name, api_key_hash, api_key_prefix, sandbox, jurisdiction) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, name, hash, prefix, sandbox ? 1 : 0, jurisdiction);
    } catch (e) {
      console.error('Partner create error:', e.message);
    }
  } else {
    inMemoryPartners.push({ id, name, api_key_prefix: prefix, sandbox, jurisdiction, created_at: new Date().toISOString() });
    inMemoryKeys.set(hash, { id, name, sandbox, jurisdiction });
  }

  return { id, name, api_key: apiKey, api_key_prefix: prefix, sandbox, jurisdiction };
}

function validateApiKey(key) {
  if (!key) return null;
  const hash = hashKey(key);
  const d = db && db.getDb ? db.getDb() : null;
  if (d) {
    try {
      const row = d.prepare('SELECT * FROM partners WHERE api_key_hash = ?').get(hash);
      return row ? { id: row.id, name: row.name, sandbox: !!row.sandbox, jurisdiction: row.jurisdiction } : null;
    } catch (e) {
      return null;
    }
  }
  return inMemoryKeys.get(hash) || null;
}

function getPartner(id) {
  const d = db && db.getDb ? db.getDb() : null;
  if (d) {
    try {
      const row = d.prepare('SELECT * FROM partners WHERE id = ?').get(id);
      return row ? { id: row.id, name: row.name, sandbox: !!row.sandbox, jurisdiction: row.jurisdiction, created_at: row.created_at } : null;
    } catch (e) {
      return null;
    }
  }
  return inMemoryPartners.find((p) => p.id === id) || null;
}

function listPartners() {
  const d = db && db.getDb ? db.getDb() : null;
  if (d) {
    try {
      const rows = d.prepare('SELECT id, name, api_key_prefix, sandbox, jurisdiction, created_at FROM partners ORDER BY created_at DESC').all();
      return rows.map((r) => ({ id: r.id, name: r.name, api_key_prefix: r.api_key_prefix, sandbox: !!r.sandbox, jurisdiction: r.jurisdiction, created_at: r.created_at }));
    } catch (e) {
      return [];
    }
  }
  return inMemoryPartners.map((p) => ({ id: p.id, name: p.name, api_key_prefix: p.api_key_prefix, sandbox: p.sandbox, jurisdiction: p.jurisdiction, created_at: p.created_at }));
}

module.exports = { createPartner, validateApiKey, getPartner, listPartners, generateApiKey };
