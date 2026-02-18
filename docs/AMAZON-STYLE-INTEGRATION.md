# SafeCover: Amazon-Style Marketplace Integration

Design document for integrating embedded microinsurance into large e-commerce marketplaces (Amazon, Walmart, etc.).

---

## 1. Coverage Models

### 1.1 Whole Cart (Current)

**How it works:** One policy covers the entire order. Premium based on total cart value.

| Cart | Premium (approx) | Coverage |
|------|------------------|----------|
| $100 | $0.15–$0.30 | Up to $1,000 |
| $500 | $0.75–$1.50 | Up to $1,000–$2,500 |
| $1,000 | $1.50–$3.00 | Up to $2,500–$5,000 |

**Pros:** Simple, fast, minimal friction  
**Cons:** May over-cover low-value items (e.g. $5 cable)

---

### 1.2 Selected Items

**How it works:** User selects which items to protect. Premium based on selected value only.

**API:** Same `POST /api/quote/compare` – pass only selected items:

```json
{
  "items": [
    { "value": 89 },
    { "value": 899 }
  ],
  "scenario": "retail"
}
```

**Pros:** Lower premium, user control  
**Cons:** Extra step at checkout

---

### 1.3 Auto-Threshold (Recommended for Scale)

**How it works:** Automatically include items above $X (e.g. $50). No user selection.

**Logic:**
```
covered_items = cart.filter(item => item.value >= THRESHOLD)
quote_value = sum(covered_items)
```

**Pros:** Balance of simplicity and savings  
**Cons:** Requires configurable threshold per merchant

---

### 1.4 Category-Based

**How it works:** Different rules per category (electronics, clothing, perishables).

| Category | Include? | Notes |
|----------|----------|-------|
| Electronics | Yes | High claim frequency |
| Clothing | Optional | Lower risk |
| Perishables | No | Not insurable |
| Jewelry | Yes | High value, special limits |

---

## 2. Amazon Checkout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  AMAZON CART                                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Wireless Earbuds     $89    [ ] Add protection               │ │
│  │ USB Cable            $12    [ ] Add protection (skip <$50)   │ │
│  │ Laptop               $899   [✓] Add protection               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Subtotal: $1,000                                                 │
│  Protection: $1.20 (SafeCover – covers $988)    [Change]          │
│  Total: $1,001.20                                                │
│                                                                   │
│  [Place order]                                                    │
└─────────────────────────────────────────────────────────────────┘
```

### Integration Points

| Step | Amazon Action | SafeCover API |
|------|---------------|---------------|
| Cart load | Send cart items to SafeCover | `POST /api/quote/compare` |
| Display | Show premium + coverage | Response: `options[]` |
| User toggles item | Re-quote with new selection | `POST /api/quote/compare` |
| Place order | Bind on payment confirmation | `POST /api/policy/bind` |
| Post-purchase | Send policy to customer | `GET /api/policy/:id` |

---

## 3. API Integration (Amazon Example)

### 3.1 Quote at Cart

```javascript
// Amazon calls SafeCover when cart is ready
const response = await fetch('https://api.safecover.com/api/quote/compare', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': AMAZON_PARTNER_KEY,
    'X-Partner-Id': 'amazon',
  },
  body: JSON.stringify({
    items: cartItems.map(i => ({ value: i.price * i.quantity })),
    scenario: 'retail',
    jurisdiction: 'US',
  }),
});
const { options, disclosures } = await response.json();
// Show cheapest: options[0].premium
```

### 3.2 Bind on Payment

```javascript
// After payment succeeds
await fetch('https://api.safecover.com/api/policy/bind', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': AMAZON_PARTNER_KEY,
  },
  body: JSON.stringify({
    quote_id: selectedQuote.quote_id,
    transaction_id: amazonOrderId,
    customer: { email, name },
    premium_paid: selectedQuote.premium,
    provider_id: selectedQuote.provider_id,
    plan_id: selectedQuote.plan_id,
    jurisdiction: 'US',
  }),
});
```

---

## 4. Scaling for High Volume

### 4.1 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Quote latency | <200ms p99 | Cache by cart fingerprint |
| Bind latency | <500ms p99 | Async policy issuance |
| Throughput | 10k+ req/s | Horizontal scaling |
| Availability | 99.9% | Multi-region |

### 4.2 Scaling Strategies

| Area | Strategy |
|------|----------|
| **Quote caching** | Hash(cart_items) → cache premium for 5 min |
| **Rate limiting** | Per-partner limits; burst allowance |
| **Async bind** | Return policy_id immediately; full doc via webhook |
| **Batch quotes** | For cart preview, batch multiple carts |
| **DB** | Read replicas; shard by partner_id |
| **CDN** | Static assets; widget JS |

### 4.3 Large Cart Handling

| Cart size | Approach |
|-----------|----------|
| 1–20 items | Full quote, all items |
| 20–100 items | Group by category; cap at top N by value |
| 100+ items | Sample or aggregate; "Cover top $X by value" |

---

## 5. UX Recommendations

### 5.1 Minimal Friction

- **Default:** Pre-select "Add protection" with cheapest plan
- **One-click:** Single checkbox or toggle
- **Mobile:** Collapsible section; sticky CTA

### 5.2 Transparency

- Show: "Protection: $X.XX – covers loss, damage, theft up to $Y"
- Link to full terms
- Display insurer name (e.g. "Powered by SafeCover")

### 5.3 Post-Purchase

- Email policy document
- Link to claims portal
- Order history: "View protection" → policy details

---

## 6. Demo

**Coverage comparison demo:** `/coverage-demo.html`

- Side-by-side: Whole cart vs Selected items
- Toggle items to see premium change
- Comparison table: savings when selecting fewer items

---

## 7. Roadmap

| Phase | Feature | Effort |
|-------|---------|--------|
| 1 | Whole cart (current) | Done |
| 2 | Selected items (API supports today) | Done |
| 3 | Auto-threshold config | 2–3 days |
| 4 | Quote caching | 1–2 days |
| 5 | Category rules | 3–5 days |
| 6 | Batch quote API | 2–3 days |
