# Multi-Provider Insurance Marketplace

SafeCover supports multiple insurance providers on the same checkout page. Customers can compare and choose coverage from different insurers and plans.

## Providers

| Provider | Plans | Coverage Range |
|----------|-------|----------------|
| **SafeCover** | Basic, Standard, Premium | $500 – $2,500 |
| **ShieldPro** | Essential, Plus, Max | $750 – $5,000 |
| **CoverMax** | Starter, Pro, Elite | $300 – $3,000 |
| **AssureX** | Lite, Core, Ultimate | $400 – $4,000 |

## API

### Get all providers
```
GET /api/providers
```

Returns provider list with plans, premium rates, and benefits.

### Compare quotes (multi-provider)
```
POST /api/quote/compare
{
  "items": [{ "value": 89 }, { "value": 24 }]
}
```

**Response:**
```json
{
  "cart_value": 113,
  "options": [
    {
      "provider_id": "safecover",
      "provider_name": "SafeCover",
      "plan_id": "basic",
      "plan_name": "Basic",
      "premium": 0.23,
      "coverage": 500,
      "benefits": ["Loss & damage", "7 days"],
      "quote_id": "QTY_safecover_basic_..."
    },
    ...
  ]
}
```

### Bind policy (with provider)
```
POST /api/policy/bind
{
  "quote_id": "QTY_safecover_standard_...",
  "transaction_id": "ORD_123",
  "customer": { "email": "user@example.com", "name": "Jane" },
  "premium_paid": 0.34,
  "provider_id": "safecover",
  "plan_id": "standard"
}
```

## Demo

Open **http://localhost:3000/providers-demo.html** to see the multi-provider comparison at checkout.

## Adding providers

Edit `backend/providers.js` to add insurers and plans. Each plan needs:
- `id`, `name`, `coverage`, `premium_rate`, `benefits`
