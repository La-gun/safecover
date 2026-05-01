# SafeCover API Reference

Base URL: `https://api.yourinsurance.com`

## Flow Overview

E-commerce and **POS** share the same lifecycle (quote → bind → confirm). **Retail POS** may use `POST /api/pos/enhanced` for terminal-aware payloads and optional **bind + confirm in one call** (`operation: "sale"`). See [INTEGRATION-POS.md](INTEGRATION-POS.md).

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   QUOTE     │────▶│    BIND     │────▶│   CONFIRM   │     │   WEBHOOK   │
│  Get price  │     │ Reserve at  │     │ Activate on │     │  Events from│
│             │     │  checkout   │     │   payment   │     │  payment    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                     │                    │                  │
       │                     │                    │                  │
   Cart loaded          Customer checks       Payment success    Order status
   at checkout          "Add insurance"       (optional)         changes
```

---

## 1. Quote

Get insurance premium for cart items.

**Endpoint:** `POST /api/quote`

**Request:**
```json
{
  "items": [
    { "value": 49.99 },
    { "value": 120.00 }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| items | array | Yes | Line items with `value` (price × quantity) |
| items[].value | number | Yes | Item subtotal |

**Response:** `200 OK`
```json
{
  "quote_id": "QTY1739800000000",
  "premium": 0.51,
  "coverage": {
    "type": "goods-in-transit",
    "max_value": 1000,
    "duration": "7 days"
  }
}
```

**Error:** `400`
```json
{ "error": "items must be a non-empty array", "code": "INVALID_ITEMS" }
```

---

## 2. Bind

Reserve a policy when customer opts in at checkout.

**Endpoint:** `POST /api/policy/bind`

**Request:**
```json
{
  "quote_id": "QTY1739800000000",
  "transaction_id": "ORD-12345",
  "customer": {
    "email": "customer@example.com",
    "name": "Jane Doe"
  },
  "items": [{ "value": 169.99 }],
  "premium_paid": 0.51
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| quote_id | string | Yes | From quote response |
| transaction_id | string | Yes | Order/checkout ID |
| customer | object | Yes | Customer info |
| customer.email | string | Yes | Valid email |
| customer.name | string | No | Full name |
| items | array | See note | Line items with `value`; **required in production/strict mode** to verify cart fingerprint matches the quote |
| premium_paid | number | Yes | Premium amount (must match quoted premium within tolerance) |
| provider_id / plan_id | string | Recommended | Must match the quoted option when applicable |
| scenario | string | No | Must match quote scenario |
| bind_idempotency_key | string | No | Safe retries: same key returns the same policy (or use header `X-Bind-Idempotency-Key`) |

Production behaviour is summarized in [PRODUCTION.md](PRODUCTION.md). After bind, policy `status` is `PENDING_PAYMENT` until **Confirm** succeeds (`ACTIVE`).

**Response:** `200 OK`
```json
{
  "policy_id": "POL_1739800000000",
  "smart_contract_url": "https://blockchain-viewer.com/tx/0xABC123",
  "coverage_details": {
    "type": "goods-in-transit",
    "max_value": 1000,
    "duration": "7 days"
  }
}
```

---

## 3. Confirm

Activate policy when payment succeeds. Call after order is paid.

**Endpoint:** `POST /api/policy/confirm`

**Request:**
```json
{
  "policy_id": "POL_1739800000000",
  "transaction_id": "ORD-12345",
  "payment_reference": "pay_abc123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| policy_id | string | Yes | From bind response |
| transaction_id | string | Yes | Order ID |
| payment_reference | string | No | Payment gateway reference |

**Response:** `200 OK`
```json
{
  "policy_id": "POL_1739800000000",
  "status": "ACTIVE",
  "confirmed_at": "2025-02-17T12:00:00.000Z",
  "payment_reference": "pay_abc123"
}
```

Repeat confirm with the same paid policy returns `idempotent: true` and the existing `confirmed_at`.

---

## 4. Webhook

Receive events (order paid, shipped, etc.). Configure URL in dashboard.

**Endpoint:** `POST /api/webhook`

**Headers:** `Content-Type: application/json`. When webhook signing is enabled, send **`X-SafeCover-Signature`**: hex-encoded **HMAC-SHA256** of the **raw** request body using `WEBHOOK_SECRET` (see [PRODUCTION.md](PRODUCTION.md)).

**Example payload (order.paid):**
```json
{
  "event": "order.paid",
  "transaction_id": "ORD-12345",
  "policy_id": "POL_1739800000000",
  "timestamp": "2025-02-17T12:00:00.000Z"
}
```

**Response:** `200 OK` (must respond quickly to acknowledge receipt)

---

## 5. POS Enhanced

Unified **point-of-sale** endpoint: terminal metadata, POS-friendly line items, and operations **`quote`**, **`bind`**, **`confirm`**, or **`sale`** (bind then confirm when payment is already captured).

**Endpoint:** `POST /api/pos/enhanced`

**Authentication:** Same as other protected routes — `X-Api-Key` or `Authorization: Bearer …`. Optional `X-Partner-Id`.

**Body size:** Up to **128 KB** JSON (large baskets). Other `POST /api/*` JSON routes use a smaller default limit.

**Rate limit:** Separate bucket from generic quote/bind (see server `rateLimitPos`).

### 5.1 Common fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| operation | string | Yes | `quote`, `bind`, `confirm`, or `sale` |
| terminal | object | Yes | `store_id`, `register_id` (required); `lane`, `operator_id` (optional) |
| ticket_id | string | See below | Receipt or ticket number; used to build `transaction_id` when not sent explicitly |
| scenario | string | No | Same as `/api/quote` |
| jurisdiction | string | No | Same as `/api/quote` |

**Transaction id:** If you omit `transaction_id` on bind/confirm/sale, the server uses:

`POS:{store_id}:{register_id}:{ticket_id}`

You must supply **`ticket_id`** or **`transaction_id`** for `bind`, `confirm`, and `sale` (unless `transaction_id` alone is provided).

### 5.2 Line items (all operations that send `items`)

Each element may use **`value`** (subtotal), **`line_total`**, or **`unit_price`** + **`quantity`**. Optional `name`, `description`, or `sku` (used in fingerprint text).

### 5.3 operation: `quote`

Registers a quote (same ledger rules as `POST /api/quote`). Includes marketplace fields when applicable (`provider_id`, `plan_id` on the chosen best quote).

**Request example:**

```json
{
  "operation": "quote",
  "terminal": { "store_id": "S001", "register_id": "R12", "operator_id": "OP-7" },
  "ticket_id": "TCK-1001",
  "items": [{ "sku": "ABC", "unit_price": 49.99, "quantity": 2 }],
  "scenario": "retail",
  "jurisdiction": "US"
}
```

**Response (excerpt):** `quote_id`, `premium`, `coverage`, `scenario`, `jurisdiction`, `disclosures`, `pos`, and when `ticket_id` is set: `suggested_transaction_id`, `suggested_bind_idempotency_key`.

### 5.4 operation: `bind`

Same validation as `POST /api/policy/bind` (quote, premium, customer, items fingerprint in strict mode). Persists **`pos_context`** on the policy.

**Request example:**

```json
{
  "operation": "bind",
  "terminal": { "store_id": "S001", "register_id": "R12" },
  "ticket_id": "TCK-1001",
  "quote_id": "QTY1739800000000",
  "customer": { "email": "buyer@example.com", "name": "Jane Doe" },
  "items": [{ "value": 99.98 }],
  "premium_paid": 0.51,
  "provider_id": "safecover",
  "plan_id": "standard"
}
```

**Idempotency:** `X-Bind-Idempotency-Key`, body `bind_idempotency_key`, or a deterministic default from partner + terminal + `ticket_id`.

**Response:** `operation: "bind"` plus the same policy fields as `/api/policy/bind`, including `transaction_id` and `pos`.

### 5.5 operation: `confirm`

Same rules as `POST /api/policy/confirm`. You may send `ticket_id` + `terminal` instead of repeating `transaction_id` if it matches the policy’s `transaction_id`.

### 5.6 operation: `sale`

**Bind** then **confirm** in one response when tender is already complete at the register.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| payment_captured | boolean | Yes | Must be `true` or the call fails with `PAYMENT_NOT_CAPTURED` |
| payment_reference | string | No | Card batch id, auth code, or tender reference |
| (plus bind fields) | | Yes | `quote_id`, `customer`, `items`, `premium_paid`, etc. |

**Response:**

```json
{
  "operation": "sale",
  "bind": { "policy_id": "POL_…", "status": "PENDING_PAYMENT", "…": "…" },
  "confirm": { "policy_id": "POL_…", "status": "ACTIVE", "confirmed_at": "…", "…": "…" }
}
```

On bind idempotency replay, `bind` may include `bind_idempotent: true`; confirm still runs for an idempotent **active** policy as today.

---

## Error Format

All errors return:
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

| Code | HTTP | Description |
|------|------|-------------|
| INVALID_JSON | 400 | Malformed request body |
| INVALID_ITEMS | 400 | items missing or invalid |
| INVALID_QUOTE_ID | 400 | quote_id required |
| INVALID_EMAIL | 400 | Invalid customer email |
| INVALID_PREMIUM | 400 | premium_paid invalid |
| INVALID_OPERATION | 400 | POS: `operation` must be `quote`, `bind`, `confirm`, or `sale` |
| INVALID_TERMINAL | 400 | POS: `terminal.store_id` / `terminal.register_id` missing |
| INVALID_TRANSACTION_ID | 400 | POS: `ticket_id` or `transaction_id` missing where required |
| PAYMENT_NOT_CAPTURED | 400 | POS `sale`: `payment_captured` must be `true` |
| COMPLIANCE_ERROR | 400 | Offering not permitted for jurisdiction/scenario |
| NO_QUOTES | 503 | No actuarial quotes available |
| RATE_LIMIT | 429 | Too many requests in the current window |
| INTERNAL_ERROR | 500 | Server error |
| NOT_FOUND | 404 | Unknown route |

POS routes reuse bind/confirm quote and policy codes where applicable (for example `QUOTE_CONSUMED`, `PREMIUM_MISMATCH`, `POLICY_NOT_FOUND`, `TRANSACTION_MISMATCH`, `FRAUD_BLOCK`). See response `code` field.
