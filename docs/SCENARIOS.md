# SafeCover Multi-Industry Scenarios

SafeCover supports embedded microinsurance across different verticals. Each scenario has configurable coverage, premium rates, and messaging.

## Supported Scenarios

| Industry | Coverage Type | Use Case | Max Coverage |
|----------|---------------|----------|--------------|
| **Logistics** | goods-in-transit | Shipping, freight, parcels | $5,000 |
| **Healthcare** | appointment-protection | Doctor visits, telemedicine | $500 |
| **Hospitality** | trip-cancellation | Hotels, flights, bookings | $2,000 |
| **Food** | delivery-guarantee | Restaurant delivery, meal kits | $200 |
| **Cyber** | data-breach-protection | VPN, subscriptions, software | $1,000 |
| **Retail** | goods-in-transit | E-commerce, general checkout | $1,000 |

## API Usage

**Quote with scenario:**
```json
POST /api/quote
{
  "items": [{ "value": 120 }],
  "scenario": "healthcare"
}
```

**Bind with scenario:**
```json
POST /api/policy/bind
{
  "quote_id": "QTY123",
  "transaction_id": "ORD_456",
  "customer": { "email": "user@example.com", "name": "Jane" },
  "premium_paid": 2.40,
  "scenario": "healthcare"
}
```

## Scenario Config

Each scenario in `backend/scenarios.js` defines:

- `coverage_type` – Type of protection
- `max_value` – Max coverage amount
- `duration` – Policy duration
- `premium_rate` – Rate applied to cart value (e.g. 0.003 = 0.3%)
- `benefits` – Bullet points for the widget
- `label` – Checkbox label (e.g. "Add appointment protection")
- `cart_label` – Label in order summary

## Demo

Open **http://localhost:3000/scenarios-demo.html** to switch between industries and see industry-specific checkouts.
