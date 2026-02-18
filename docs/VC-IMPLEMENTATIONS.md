# VC Recommendations – Implementations

Summary of implementations for points 2–7 from the VC consultant analysis.

---

## 2. Replace JSON store with database + audit trail

**Implemented:**
- `backend/services/db.js` – SQLite via `better-sqlite3` (optional; falls back to JSON if not installed)
- Schema: `policies`, `claims`, `analytics`, `audit_log`, `partners`
- `store.getAuditLog(entityType, entityId)` – fetch audit trail
- `GET /api/audit/:entityType/:entityId` – audit log API

**Note:** On Windows without Visual Studio build tools, `better-sqlite3` may not install. The app falls back to JSON files. For production, use a server with `better-sqlite3` or switch to PostgreSQL.

---

## 3. Deploy smart contract on testnet

**Implemented:**
- `backend/services/blockchain.js` – ethers.js deployment when configured
- Env vars: `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_PRIVATE_KEY` (e.g. Sepolia)
- Compiles `MicroInsurancePolicy.sol` with solc and deploys
- Without env vars: simulated deployment (unchanged behavior)

**To deploy for real:**
```bash
export BLOCKCHAIN_RPC_URL=https://rpc.sepolia.org
export BLOCKCHAIN_PRIVATE_KEY=your_wallet_private_key
```

---

## 4. Implement claims UX

**Implemented:**
- `frontend/claims.html` – claims flow
- Flow: load policies by email → submit claim → view status
- `GET /api/claims` – list claims (by policy_id or email)
- `GET /api/claim/:id` – claim detail with policy
- `PATCH /api/claim/:id` – update status (e.g. approved, paid)

---

## 5. Jurisdiction / compliance

**Implemented:**
- `backend/services/compliance.js` – jurisdiction checks
- Supported: US, UK, EU, CA, AU, SG, NG
- Scenario restrictions (e.g. cyber restricted in UK, NG)
- Disclosures per jurisdiction
- `complianceCheck()` used in quote and bind
- `GET /api/compliance/jurisdictions` – list supported jurisdictions
- Quote/bind responses include `jurisdiction` and `disclosures`

---

## 6. Partner dashboard

**Implemented:**
- `frontend/partner-dashboard.html` – self-serve partner portal
- Create API keys (sandbox)
- Test API key
- API docs for Quote and Bind
- `POST /api/partners` – create partner + API key
- `GET /api/partners` – list partners (auth required)
- Partners stored in DB or in-memory when DB is unavailable

---

## 7. Actuarial model validation

**Implemented:**
- `backend/scripts/actuarial-backtest.js` – backtest script
- Simulates 1000 policies, synthetic claims, loss ratios
- `npm run backtest` or `node scripts/actuarial-backtest.js`
- `GET /api/actuarial/backtest` – run backtest via API
- Actuarial demo page: “Run backtest” button

---

## New URLs

| Page | URL |
|------|-----|
| Claims | /claims.html |
| Partner Dashboard | /partner-dashboard.html |
| Actuarial (with backtest) | /actuarial-demo.html |

---

## Dependencies added

- `ethers` – blockchain deployment
- `solc` – Solidity compilation
- `better-sqlite3` – SQLite (optional; may need build tools)
