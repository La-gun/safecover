# SafeCover Integration Guide: Point of Sale (POS)

## Overview

Retail POS systems can integrate **server-to-server** with the same quote, bind, and confirm lifecycle as e-commerce, using a single enhanced endpoint that understands **terminal context**, **ticket/receipt IDs**, and **POS-shaped line items** (SKU, unit price, quantity).

**Primary endpoint:** `POST /api/pos/enhanced`

Full request and response shapes are in [API.md](API.md) (section **POS Enhanced**). This guide covers recommended flow, headers, and operational notes.

---

## Authentication

Use the same API key as other protected routes:

- Header **`X-Api-Key`**: your key, or  
- Header **`Authorization`**: `Bearer <token>`

Optional header **`X-Partner-Id`**: your partner identifier (propagates to analytics and quote ownership).

In **strict / production** mode, a valid key is required. See [PRODUCTION.md](PRODUCTION.md).

---

## Recommended flow

### Option A — Three calls (matches e-commerce mental model)

1. **`operation: "quote"`** — When the basket is stable (or when the cashier enables “add protection”). Returns `quote_id`, `premium`, `provider_id`, `plan_id`, and optional `suggested_transaction_id` / `suggested_bind_idempotency_key` when `ticket_id` is supplied.
2. **`operation: "bind"`** — After the customer opts in and before or after tender (your choice). Policy status is **`PENDING_PAYMENT`** until confirm.
3. **`operation: "confirm"`** — After payment succeeds (card, cash, or store credit), using the same logical sale ID as bind.

### Option B — Single call after payment (in-store “paid” path)

1. **`operation: "quote"`** — As above.  
2. **`operation: "sale"`** — When **`payment_captured`** is already true at the register: the API **binds** then **confirms** in one response. Requires `payment_captured: true` and the same fields as bind plus `payment_reference` if you have one.

Retries: send **`X-Bind-Idempotency-Key`** or use the **`suggested_bind_idempotency_key`** from the quote response so duplicate posts do not create duplicate policies.

---

## Terminal and transaction identity

Every POS request must include **`terminal`**:

| Field | Required | Description |
|--------|----------|-------------|
| `store_id` | Yes | Store or site identifier |
| `register_id` | Yes | Lane or register identifier |
| `lane` | No | Display or sub-lane |
| `operator_id` | No | Cashier or device user |

Provide a stable **`ticket_id`** (or receipt number) per sale. The API derives a canonical transaction id when you omit `transaction_id`:

```text
POS:{store_id}:{register_id}:{ticket_id}
```

Use the same `ticket_id` (or explicitly the same `transaction_id`) across bind and confirm for that sale.

---

## Line items

Each line may use one of:

| Shape | Example |
|--------|---------|
| Precomputed subtotal | `{ "value": 99.98, "name": "Widget" }` |
| POS line total | `{ "line_total": 49.99, "sku": "SKU-1" }` |
| Unit × quantity | `{ "unit_price": 24.99, "quantity": 2, "name": "Pair" }` |

`name`, `description`, or `sku` feed fingerprinting and analytics; in **strict** mode, **bind** must send **`items`** that match the quoted fingerprint (same as `POST /api/policy/bind`).

---

## Payload size

`POST /api/pos/enhanced` accepts JSON bodies up to **128 KB** (large baskets). Other JSON API routes remain limited to **10 KB** unless you proxy through your own gateway.

---

## CORS and networking

POS integrations should call the API from a **backend or gateway** (payment hub, middleware, or the POS vendor’s cloud), not from an in-browser script on an untrusted origin. Server-to-server avoids browser CORS and keeps keys off terminals where possible.

---

## Policy record

Successful binds store **`pos_context`** on the policy (channel `pos`, store, register, lane, operator, ticket). Retrieve with `GET /api/policy/:id` (authenticated).

---

## Related documentation

| Doc | Topic |
|-----|--------|
| [API.md](API.md) | POS Enhanced request/response reference |
| [PRODUCTION.md](PRODUCTION.md) | Strict mode, quote signing, idempotency |
| [README.md](../README.md) | Quick start and endpoint list |
