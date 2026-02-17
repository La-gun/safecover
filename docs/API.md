# SafeCover API Reference

Base URL: `https://api.yourinsurance.com`

## Flow Overview

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
| items | array | No | Cart items (for records) |
| premium_paid | number | Yes | Premium amount |

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
  "status": "confirmed",
  "confirmed_at": "2025-02-17T12:00:00.000Z"
}
```

---

## 4. Webhook

Receive events (order paid, shipped, etc.). Configure URL in dashboard.

**Endpoint:** `POST /api/webhook`

**Headers:** `Content-Type: application/json`

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

## Error Format

All errors return:
```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

| Code | HTTP | Description |
|------|------|--------------|
| INVALID_JSON | 400 | Malformed request body |
| INVALID_ITEMS | 400 | items missing or invalid |
| INVALID_QUOTE_ID | 400 | quote_id required |
| INVALID_EMAIL | 400 | Invalid customer email |
| INVALID_PREMIUM | 400 | premium_paid invalid |
| INTERNAL_ERROR | 500 | Server error |
| NOT_FOUND | 404 | Unknown route |
