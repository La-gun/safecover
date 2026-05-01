# SafeCover production deployment

This document describes **security, compliance, and insurer-core** controls implemented in the API and how to operate them next to a **licensed carrier** (regulated insurer core).

## Operating modes

| Mode | How | Behavior |
|------|-----|----------|
| Demo / local | Default `NODE_ENV` not `production`, no `SAFECOVER_STRICT` | Anonymous API traffic allowed; CORS permissive; quote signing uses a dev secret if `QUOTE_SIGNING_SECRET` unset; unknown `quote_id` at bind is tolerated. |
| Strict / production | `NODE_ENV=production` or `SAFECOVER_STRICT=true` | **API key required** (`API_KEY`); **quote signing secret required** (`QUOTE_SIGNING_SECRET`); **registered quotes mandatory** at bind; bind should include **`items`** for cart fingerprint verification; configure **`ALLOWED_ORIGINS`** for browser clients. |

**POS:** `POST /api/pos/enhanced` uses the same auth, quote ledger, strict bind rules, and idempotency as `/api/policy/bind`. Prefer **server-to-server** calls from your gateway or POS cloud (not browser keys on a public origin). See [INTEGRATION-POS.md](INTEGRATION-POS.md).

Optional: set `SAFECOVER_FAIL_ON_CONFIG=1` to exit the process when strict mode detects missing critical env vars (after `validateStartupConfig`).

## Required environment variables (strict / production)

| Variable | Purpose |
|----------|---------|
| `API_KEY` | Server-side API key accepted via `X-API-Key` or `Authorization: Bearer …`. |
| `QUOTE_SIGNING_SECRET` | HMAC key for quote ledger integrity; binds fail closed if quotes are tampered with. |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed `Origin` values for CORS (e.g. `https://checkout.merchant.com,https://app.merchant.com`). |
| `WEBHOOK_SECRET` | If `WEBHOOK_REQUIRE_SIGNATURE=true` **or** strict mode with this set, `POST /api/webhook` requires header `X-SafeCover-Signature` equal to **hex HMAC-SHA256** of the **raw** JSON body. |

## Regulated insurer core (metadata)

Set these to align policies with your **licensed entity and approved product** (PAS / carrier integration typically consumes these fields):

| Variable | Purpose |
|----------|---------|
| `CARRIER_ENTITY_ID` | Legal entity identifier for the risk carrier. |
| `CARRIER_LICENSE_REFERENCE` | Insurance license or registration reference. |
| `PRODUCT_FILING_CODE` | Approved product / rate filing code. |
| `POLICY_WORDING_VERSION` | Version of policy terms and IPID/pre-contractual pack. |
| `SAFECOVER_SANDBOX` | `true` if traffic is non-production (disclosures and partner onboarding). |

Policies store a `regulatory_snapshot` object at bind (see `GET /api/policy/:id`).

## Policy lifecycle

1. **Quote** — `POST /api/quote`, `/api/quote/compare`, `/api/quote/rate`, or **`POST /api/pos/enhanced`** with `operation: "quote"` registers server-side quote rows (TTL default **30 minutes**, override with `QUOTE_TTL_MINUTES`).
2. **Bind** — `POST /api/policy/bind` or **`POST /api/pos/enhanced`** with `operation: "bind"` creates a policy in **`PENDING_PAYMENT`**. Strict mode requires a valid quote, matching premium (±0.5% or $0.01), provider/plan, scenario, partner, and **items** fingerprint. POS binds persist **`pos_context`** (store, register, ticket, etc.) on the policy.
3. **Confirm** — `POST /api/policy/confirm` or **`POST /api/pos/enhanced`** with `operation: "confirm"` after successful payment sets status **`ACTIVE`** and persists `payment_reference` and `confirmed_at`. Idempotent if already active.
4. **POS sale** — **`POST /api/pos/enhanced`** with `operation: "sale"` and `payment_captured: true` performs bind then confirm in one request (use when tender is already complete at the register).
5. **Claims** — `POST /api/claim` and `/api/claim/trigger` require **`ACTIVE`** policies.

**Bind idempotency:** send `X-Bind-Idempotency-Key` (or body `bind_idempotency_key`) to safely retry binds; the same key returns the original policy. On POS, a deterministic default idempotency key is derived from partner + terminal + `ticket_id` when you omit an explicit key.

## Webhooks

- Route: `POST /api/webhook`
- Body: raw JSON (max 64 KB)
- When signatures are enforced, compute:

```text
X-SafeCover-Signature = HMAC_SHA256_hex( WEBHOOK_SECRET, raw_request_body_bytes )
```

## Escape hatches (development only — never in production)

| Variable | Effect |
|----------|--------|
| `API_AUTH_DISABLED=true` | Skips API key checks. |
| `SAFECOVER_INSECURE_AUTH=true` | Allows anonymous traffic even in strict mode. |

## Licensing and compliance

This codebase **does not** replace actuarial sign-off, product filing, broker licensing, or jurisdictional legal review. Use `compliance` + `insurerCore.validateOffering` as **gates** only; extend with your compliance team’s rules and connect to a real PAS / billing / claims stack.

## Next integration steps (carrier)

1. Point `INSURER_WEBHOOK_URL` at your policy administration system for `policy.bound` events.
2. Emit `policy.confirmed` from your payment orchestration into the same or a dedicated endpoint.
3. Replace JSON / SQLite persistence with your SOC2-grade datastore and outbox for insurer forwarding.
