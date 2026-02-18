# SafeCover Platform Blueprint
## Premium Collection • Reinsurance • Monetization • Viability

---

## Executive Summary

**SafeCover** is an embedded microinsurance platform that enables e-commerce merchants, marketplaces, and partners to offer point-of-sale insurance (goods-in-transit, trip protection, device protection, etc.) via API. The platform operates as a **B2B2C insurance marketplace** connecting partners (merchants) with multiple insurance providers (SafeCover, ShieldPro, CoverMax, AssureX).

This blueprint outlines the collection of premiums, reinsurance strategy, monetization model, and commercial viability.

---

## 1. Collection of Premiums

### 1.1 Current Flow (As Implemented)

```
Customer → Merchant Checkout → SafeCover API (quote/bind) → Policy Recorded
                ↓
         Premium collected at checkout (bundled with order)
```

**Key characteristics:**
- Premiums are **bundled** with the merchant transaction (cart total + premium)
- The platform does **not** collect premiums directly from end customers
- `premium_paid` is passed at bind time; the **merchant/partner** is responsible for payment processing
- Policy binding requires `transaction_id` — implying the merchant has already processed payment

### 1.2 Premium Collection Architecture (Recommended)

| Layer | Responsibility | Implementation |
|-------|----------------|----------------|
| **Merchant/Partner** | Collects premium + product price at checkout | Stripe, PayPal, merchant's PSP |
| **SafeCover** | Validates premium matches quote; records policy | `POST /api/policy/bind` with `premium_paid` |
| **Provider** | Receives premium (net of commission) | Webhook `policy.bound` to `INSURER_WEBHOOK_URL` |

### 1.3 Collection Models

#### Model A: Merchant-Collect (Current)
- Merchant adds premium to cart; collects via own payment gateway
- Merchant settles with SafeCover/insurers on agreed terms (e.g. net-30)
- **Pros:** Simple, no PCI scope for SafeCover  
- **Cons:** Settlement risk, reconciliation complexity

#### Model B: SafeCover as Payment Facilitator
- SafeCover holds a payment gateway (Stripe Connect, etc.)
- Premium flows: Customer → SafeCover escrow → Provider (minus commission)
- **Pros:** Control, faster settlement, reduced merchant default risk  
- **Cons:** Regulatory (money transmitter), PCI, operational overhead

#### Model C: Hybrid – Premium Pass-Through
- Merchant collects; real-time webhook confirms payment
- SafeCover records policy only after payment confirmation webhook
- Reduces bind-without-payment risk

### 1.4 Reconciliation & Settlement

| Metric | Source | Use |
|--------|--------|-----|
| `premium` | Policy record | Total premium collected |
| `commission` | `premium × commission_rate` | Platform revenue |
| `provider_id` | Policy | Routing to correct insurer |
| `transaction_id` | Bind request | Link to merchant payment |

**Settlement formula:**
```
Net to Provider = Premium - Commission - (any fees)
Commission to SafeCover = Premium × commission_rate  (12–18% per provider)
```

---

## 2. Reinsurance Strategy

### 2.1 Current State

The codebase has **no reinsurance logic**. Policies are forwarded to insurers via `insurer.forwardToInsurer(policy)`; the insurer bears 100% of risk.

### 2.2 Why Reinsurance Matters for Microinsurance

- **Peak risk:** High-frequency, low-severity claims (e.g. logistics, food delivery) can spike
- **Capital relief:** Insurers can cede risk to reinsurers to free capacity
- **Catastrophe protection:** Parametric/event triggers can create correlated losses
- **Regulatory:** Solvency II, NAIC require adequate capital; reinsurance reduces required capital

### 2.3 Reinsurance Architecture (Proposed)

```
                    ┌─────────────────┐
                    │   Reinsurer(s)  │
                    │  (Quota Share /  │
                    │   Excess of Loss)│
                    └────────▲────────┘
                             │ Ceded premium / claims
                    ┌────────┴────────┐
                    │  Primary       │
                    │  Insurer       │  ← SafeCover providers (SafeCover, ShieldPro, etc.)
                    │  (Ceding Co.)  │
                    └────────▲────────┘
                             │ 100% gross premium
                    ┌────────┴────────┐
                    │  SafeCover      │
                    │  Platform       │
                    └────────▲────────┘
                             │
                    ┌────────┴────────┐
                    │  Partners /     │
                    │  Merchants      │
                    └─────────────────┘
```

### 2.4 Reinsurance Structures

| Type | Use Case | Example |
|------|----------|---------|
| **Quota share** | Cede fixed % of all policies | 50% ceded → reinsurer pays 50% of claims |
| **Excess of loss (XoL)** | Protect against large single claims | Reinsurer pays claims above $500 per policy |
| **Stop-loss** | Protect against bad loss ratio | Reinsurer pays when loss ratio > 80% |
| **Parametric** | For parametric products | Reinsurer pays on weather/event triggers |

### 2.5 Implementation Roadmap

1. **Phase 1 – Data layer:** Add `reinsurance_ceded`, `reinsurance_premium`, `reinsurer_id` to policy/analytics schema
2. **Phase 2 – API:** Expose reinsurance allocation in `policy.bound` webhook for insurer systems
3. **Phase 3 – Platform logic:** Optional quota-share calculator (e.g. 30% ceded on policies > $X coverage)
4. **Phase 4 – Partner reporting:** Dashboard showing gross/ceded premium, net retention

### 2.6 Reinsurance Economics (Illustrative)

| Item | Value |
|------|-------|
| Gross premium | $0.34 (example) |
| Cession rate | 40% |
| Ceded premium | $0.136 |
| Net retained | $0.204 |
| Commission (15%) | $0.051 (to SafeCover) |
| Net to insurer | $0.153 |

---

## 3. Monetization Strategy

### 3.1 Revenue Streams

| Stream | Description | Current State |
|--------|-------------|---------------|
| **Commission on premium** | % of each bound policy | ✅ Implemented (12–18% per provider) |
| **Partner API fees** | Subscription or per-API-call | ⚠️ Auth exists; no billing |
| **Provider listing fees** | Insurers pay to be on marketplace | ❌ Not implemented |
| **Data/analytics** | Aggregated risk insights (anonymised) | ❌ Not implemented |
| **White-label / enterprise** | Custom branding, SLA | ❌ Not implemented |

### 3.2 Commission Model (Primary)

```
Revenue = Σ (premium × commission_rate) per policy
```

**Provider commission rates (from `providers.js`):**

| Provider | Commission Rate |
|----------|-----------------|
| SafeCover | 15% |
| ShieldPro | 12% |
| CoverMax | 18% |
| AssureX | 14% |

**Unit economics (example):**
- Cart value: $300
- Premium: $0.34 (Standard plan)
- Commission (15%): $0.051 per policy
- At 10,000 policies/month → **$510/month** commission revenue

### 3.3 Partner Monetization Options

| Model | Price | Target |
|-------|-------|--------|
| **Free tier** | 0–1,000 quotes/month | SMB, trials |
| **Growth** | $99–299/mo + % of GWP | Mid-market |
| **Enterprise** | Custom | Large retailers, marketplaces |
| **Revenue share** | 2–5% of commission | Alternative to fixed fee |

### 3.4 Growth Levers

1. **Volume:** More partners → more quotes → more binds
2. **Conversion:** Improve quote-to-bind (checkout UX, recommended plan)
3. **Mix:** Higher-premium scenarios (hospitality, gadgets) yield more commission per policy
4. **Provider expansion:** More insurers → more choice → better conversion

---

## 4. Viability of the Platform

### 4.1 Market Opportunity

- **Embedded insurance** is a fast-growing segment (CAGR ~25%+)
- **Microinsurance** (low-premium, short-term) fits e-commerce, gig economy, travel
- **Goods-in-transit** alone: large TAM from e-commerce shipping volumes
- **Multi-scenario** (retail, logistics, gadgets, hospitality, food, events, mobility, parametric) expands addressable market

### 4.2 Strengths

| Strength | Evidence |
|----------|----------|
| **Multi-provider marketplace** | 4 providers, 12 plans → competitive pricing |
| **Actuarial rigor** | Pure premium, loss ratio, scenario-based pricing |
| **Compliance-ready** | Jurisdiction checks, disclosures (US, UK, EU, CA, AU, SG, NG) |
| **Blockchain option** | Policy recording (Sepolia); audit trail |
| **Partner API** | API keys, sandbox, partner_id tracking |
| **Parametric support** | Claim triggers for event-based payouts |

### 4.3 Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **Low premium = thin margins** | Volume, automation, higher-premium scenarios |
| **Regulatory** | Compliance service; partner responsibility for distribution |
| **Claims volatility** | Reinsurance; actuarial backtesting |
| **Provider dependency** | Multi-provider reduces single-point failure |
| **Merchant default** | Escrow, payment confirmation before bind |

### 4.4 Unit Economics (Illustrative)

| Metric | Conservative | Base | Optimistic |
|--------|--------------|------|------------|
| Policies/month | 5,000 | 20,000 | 100,000 |
| Avg premium | $0.35 | $0.40 | $0.45 |
| Avg commission rate | 14% | 15% | 16% |
| **Commission revenue** | $245 | $1,200 | $7,200 |
| Partner API revenue | $0 | $500 | $3,000 |
| **Total revenue** | $245 | $1,700 | $10,200 |

### 4.5 Break-Even & Path to Profitability

- **Fixed costs:** Hosting, compliance, engineering, support
- **Variable costs:** Payment processing, reinsurance (if platform participates), fraud
- **Break-even:** Depends on cost structure; at ~$2K/mo fixed, ~15K policies at 15% commission ≈ break-even
- **Scale:** 50K+ policies/month with partner fees → sustainable profitability

### 4.6 Competitive Positioning

- **vs. Single-insurer embedded:** More choice, better conversion
- **vs. Traditional brokers:** API-first, instant quotes, no manual process
- **vs. In-house:** Faster time-to-market for merchants

---

## 5. Implementation Priorities

| Priority | Action | Impact |
|----------|--------|--------|
| **P0** | Payment confirmation webhook before bind | Reduces bad debt |
| **P1** | Partner billing (usage-based) | New revenue stream |
| **P2** | Reinsurance data layer + insurer webhook fields | Enables reinsurance |
| **P3** | Analytics dashboard (GWP, commission, loss ratio) | Operational visibility |
| **P4** | Escrow / payment facilitation | Control, trust |

---

## 6. Summary

| Dimension | Status | Recommendation |
|-----------|--------|----------------|
| **Premium collection** | Merchant-collect; platform validates | Add payment confirmation; consider escrow at scale |
| **Reinsurance** | Not implemented | Add data model; let insurers drive cession |
| **Monetization** | Commission only | Add partner API fees; explore provider fees |
| **Viability** | Strong product; needs volume | Focus on partner acquisition, conversion, higher-premium scenarios |

---

*Document version: 1.0 | Based on SafeCover codebase analysis | Feb 2026*
