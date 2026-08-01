# SafeCover Recommendations Backlog

Source: four-agent critical review (technical architecture, security/privacy,
product/commercial, QA) conducted 2026-08-01, read-only. Critical-tier items
from that review were implemented the same day (see commits `b9b104f`,
`5ec541a`, `53b268c`). This document tracks what's **done** and what remains,
sequenced High → Medium → Low, so the backlog survives past this session.

Status legend: ✅ Done · 🔶 Partially addressed · ⬜ Not started

---

## Done (2026-08-01)

- ✅ `POST /api/partners` now requires an admin credential in strict mode and
  always forces `sandbox:true` outside it (was fully open, allowed self-minting
  live keys).
- ✅ `req.isAdmin` now derives only from a verified `ADMIN_API_KEY`, never from
  the client-supplied `X-Partner-Id` header (closed the admin-impersonation
  path into `GET`/`PATCH /api/claim/:id`).
- ✅ `GET /api/policy/:id` ownership check added (previously any authenticated
  caller could fetch any partner's policy).
- ✅ `GET /api/claims` now scoped to the caller's partner by default.
- ✅ Policy/claim/quote/partner IDs are no longer sequential/guessable
  (`Date.now()` → `Date.now()_<random hex>`).
- ✅ Fixed hardcoded `currency: 'NGN'` bug in `/api/coverage/recommendations`.
- ✅ `db.js`'s native audit trail now hashes customer email before writing to
  SQLite, matching `services/auditLog.js`'s redaction (was writing plaintext
  PII into `audit_log` on every policy/claim create/update).
- ✅ Fixed a same-day regression: `validateBindBody` was silently stripping
  `customer.address` and top-level `billing`, breaking bind-time
  address/cardholder-name validation for every real request.
- ✅ Minimal CI pipeline added (`test` + advisory `npm audit` + boot check) —
  previously zero CI existed.
- ✅ `docs/REGULATORY_APPLICATION_SAFECOVER.md` flagged as aspirational, not
  current capability, with specific gaps enumerated.

**Not done, and deliberately not attempted in this pass** — these need a
Board/product decision, not just code:
- The fate of `packages/api-gateway` (the orphaned NestJS/Prisma/Redis stack
  that `docs/openapi-v1.yaml` actually describes, vs. the live Express app).
  Options: adopt it as the real target and migrate, formally park it with an
  ADR, or delete it. Whichever is chosen, `docs/openapi-v1.yaml` needs a
  banner or removal so it stops describing a non-existent live API.
- Whether real (non-synthetic) customer PII has ever flowed through any
  deployed instance — if so, the PII-encryption and DPIA items below become
  immediate, not "before pilot."

---

## High priority

1. **Move rate limiting to a shared store (Redis) before any multi-instance
   deployment.** Current `backend/middleware/rateLimit.js` is an in-process
   `Map` — resets on restart, doesn't work across horizontally-scaled
   instances. `packages/api-gateway` already has `ioredis` as a dependency if
   that stack is adopted.
2. **Add field-level encryption or tokenization for stored customer PII**
   (`policies.json`/`claims.json`/`quotes.json` and the SQLite `customer`
   column) — currently plaintext with no retention schedule. Needs a
   KMS/key-management decision first.
3. **Commission a DPIA (privacy-impact screening)** before any real (non-synthetic)
   customer PII is processed. Block real-data processing until it's done.
4. **Add integration tests** (`supertest` or similar) for `/api/policy/bind`
   and `/api/policy/confirm`: happy path, fraud-BLOCK 403, quote-mismatch
   rejection, bind idempotency replay, and the concurrent-bind race in
   `services/store.js`'s JSON fallback (two simultaneous binds can lose a
   write — no locking on the read-modify-write cycle). Also add first-pass
   tests for the security middleware added this morning (`auth.js`,
   `corsAndSecurity.js`, `rateLimit.js`, `inputValidation.js`) — none of it
   has dedicated tests, and today's regression (address/billing stripped from
   bind requests) would have been caught immediately by one.
5. **Add a durable outbox / dead-letter handling for `insurer.forwardToInsurer`**
   — currently fire-and-forget; a failed forward to the actual carrier on a
   *bound* policy is silently dropped to stdout with no retry queue or alert.
6. **Build minimal commission reconciliation** (policies bound → premium →
   commission owed → provider net) — a settlement formula exists in
   `docs/BLUEPRINT_PREMIUMS_REINSURANCE_MONETIZATION_VIABILITY.md` but no
   ledger, payout run, or reconciliation report exists in code.
7. **Add cancellation / refund / chargeback handling** to the policy lifecycle
   state machine — currently the lifecycle stops at
   Quote → Bind → Confirm → Claim, with no Cancel/Void/Refund state at all.
8. **Resolve the UK-vs-Nigeria data mismatch.** `backend/providers.js` is
   entirely UK/FCA-flavored (fake FCA numbers, `.example` domains, London/
   Manchester/Edinburgh addresses) while the regulatory doc and partner pitch
   target Nigeria/NAICOM. Decide the actual first-pilot market and make the
   provider/currency/regulatory dataset match it before any real partner
   conversation.
9. **Stand up structured logging + basic error tracking** (e.g. `pino` +
   a free-tier Sentry). Currently `console.log`/`console.error` only, no
   levels, no aggregation — an incident is only visible via manual log-tailing.

## Medium priority

10. Add an idempotency/dedupe key to `POST /api/claim/trigger` — a retried
    call can currently double-approve a payout.
11. Make `POST /api/webhook` actually parse and route known event types
    (e.g. payment-success → auto-confirm) instead of log-and-200.
12. Add retention/cleanup for the SQLite `audit_log`/`quotes` tables (the
    JSON fallback already caps these); document a retention policy per data
    class.
13. Wire `docs/openapi-v1.yaml` into a contract test (or resolve it per the
    `packages/api-gateway` decision above) so the spec can't silently drift
    from the live API.
14. Add coverage tooling (`node --test --experimental-test-coverage` or
    `c8`) with a stated threshold in CI.
15. Add ESLint (ideally with `eslint-plugin-security`) — no lint config
    exists anywhere in the repo.
16. Source or clearly caveat the actuarial base rates (`backend/services/actuarial.js`'s
    `BASE_FREQUENCY`) as illustrative-only in every external artefact — they're
    labeled "industry benchmarks" with no citation, and the backtest validates
    against the model's own synthetic output, not real claims experience.
17. Either wire a real oracle behind the parametric trigger (e.g. a public
    weather API for one scenario) or strip "auto-payout" language from
    `scenarios.js`/marketing copy until it's true — flagged by the product
    review as the platform's most-marketed, least-real capability.
18. Add a KYC/sanctions-screening gate (even a stub) ahead of higher-value
    binds.
19. Move `BLOCKCHAIN_PRIVATE_KEY` to a secrets manager before reusing that
    pattern beyond the Sepolia testnet demo.
20. Add renewal/lapse handling once initial-term flows are stable.

## Low priority

21. Untrack `packages/api-gateway/prisma/dev.db` from git (a binary SQLite
    artefact — low risk today, wrong pattern to carry forward).
22. Port the `AuditEvent.prevHash/eventHash` hash-chain design that already
    exists (unused) in `packages/api-gateway/prisma/schema.prisma` into
    whichever audit trail ends up live.
23. Reconcile `docs/WHITEPAPER-CODEBASE-MAP.md` with current code — it
    currently understates what's implemented (says insurer forwarding is
    "Not implemented"; it is) and has stale line-number references.
24. Add E2E smoke tests (Playwright) for at least one of the 10 scenario
    demo pages, end to end (quote → bind → confirm).
25. Address the project's own previously self-identified, still-open items in
    `docs/SCENARIOS_REVIEW_FINDINGS_RECOMMENDATIONS.md` (parametric trigger UI
    not wired to the API, generic bind-failure UI, shared demo data across
    scenario ports).
26. Introduce a `CarrierAdapter` interface in place of static `providers.js`
    config, as a stepping stone toward real multi-carrier integration.

---

## What the Board/product owner needs to decide (not implementable as code)

- `packages/api-gateway`: adopt, park (with an ADR), or delete.
- Whether `docs/REGULATORY_APPLICATION_SAFECOVER.md` (now banner-flagged) is
  still used externally in any form, and if so, who signs off on the
  distinction between roadmap and current capability each time.
- First-pilot target market (resolves the UK/Nigeria data mismatch).
- Timeline/budget for a DPIA and for a real carrier/MGA relationship — neither
  is something this backlog can close through engineering work alone.
