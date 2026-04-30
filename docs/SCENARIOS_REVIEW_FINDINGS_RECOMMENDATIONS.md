# SafeCover 10-Industry Scenarios – Review, Findings & Recommendations

**Document version:** 1.0  
**Date:** February 19, 2026  
**Scope:** 10 industry-specific scenarios on ports 3001–3010

---

## 1. Executive Summary

Ten industry-specific microinsurance checkout scenarios were implemented, each running on a dedicated port with complex transactions, industry-specific UI, and full Quote → Bind → Policy flows. This document summarizes the implementation, findings from the review process, and recommendations for improvement.

---

## 2. Implementation Overview

### 2.1 Architecture

| Component | Description |
|-----------|-------------|
| **Launcher** | `scripts/launch-all-scenarios.js` – spawns 10 Node.js processes, each with `PORT` and `SCENARIO` env vars |
| **Server** | Modified `backend/server.js` – redirects `/` to `/scenarios/scenario-{SCENARIO}.html` when `SCENARIO` is set |
| **Scenarios** | 10 HTML files in `frontend/scenarios/` – standalone checkout demos per industry |

### 2.2 Port & Scenario Mapping

| Port | Scenario | Industry | Coverage Type | Max Value |
|------|----------|----------|---------------|-----------|
| 3001 | retail | Retail & E-commerce | goods-in-transit | $1,000 |
| 3002 | logistics | Logistics & Shipping | goods-in-transit | $5,000 |
| 3003 | healthcare | Healthcare | appointment-protection | $500 |
| 3004 | hospitality | Hospitality & Travel | trip-cancellation | $2,000 |
| 3005 | food | Food & Delivery | delivery-guarantee | $200 |
| 3006 | cyber | Cyber & Digital | data-breach-protection | $1,000 |
| 3007 | mobility | Mobility & Gig Economy | per-trip-accident | $1,000 |
| 3008 | parametric | Parametric (Climate/Events) | parametric-trigger | $500 |
| 3009 | gadgets | Gadgets & Electronics | device-protection | $1,500 |
| 3010 | events | Events & Ticketing | ticket-protection | $300 |

### 2.3 Transaction Complexity by Scenario

| Scenario | Cart Items | Add-ons / Fees | Transaction ID Prefix |
|----------|------------|----------------|----------------------|
| Retail | 6 items (headphones, cables, stand, keyboard, mouse, cleaning kit) | Shipping options | ORD_ |
| Logistics | 5 items (electronics shipment, fragile fee, white-glove, customs) | Fuel surcharge $45 | FRT_ |
| Healthcare | 5 items (consultation, blood panel, ECG, urinalysis, admin fee) | — | APT_ |
| Hospitality | 6 items (suite, flight, transfer, spa, resort fee) | Taxes $198 | TRP_ |
| Food | 5 items (burger combo, fries, salad, beer, brownie) | Delivery $5.99, service $3.50 | FOD_ |
| Cyber | 5 items (VPN, family plan, dark web, password manager, backup) | — | CBR_ |
| Mobility | 5 items (base fare, distance, time, airport surcharge, priority) | — | RID_ |
| Parametric | 4 items (tickets, VIP upgrade, parking, merch) | Weather trigger $75 payout | PRM_ |
| Gadgets | 6 items (iPhone, Watch, AirPods, charger, protector, case) | Shipping $15.99 | GDT_ |
| Events | 4 items (VIP tickets, meet & greet, parking, merch) | Processing fee $18.50 | EVT_ |

---

## 3. Findings

### 3.1 Strengths

1. **Industry-specific design**
   - Each scenario has distinct color schemes, typography, and layout aligned with the industry (e.g., healthcare green, hospitality red, cyber purple).
   - Port badges and headers clearly identify the scenario.

2. **Complex transactions**
   - Carts include 4–6+ line items with varied prices.
   - Add-ons (fuel surcharge, taxes, delivery, processing fees) reflect real-world complexity.
   - Transaction IDs use industry-specific prefixes (ORD_, FRT_, APT_, TRP_, etc.).

3. **Images**
   - Product images use Unsplash URLs with appropriate `w`, `h`, and `fit=crop` parameters.
   - Fallback via `onerror="this.style.display='none'"` for failed loads.
   - Hospitality and events use hero images for venue/event context.

4. **API integration**
   - All scenarios call `/api/quote/rate` for competitive quotes.
   - Policy binding uses `/api/policy/bind` with correct `provider_id`, `plan_id`, `scenario`, and `jurisdiction`.
   - Fallback premiums when API is unavailable.

5. **UX flow**
   - Checkbox to add protection.
   - Dynamic total updates.
   - Success banner with policy ID on completion.
   - Disabled pay button during processing.

### 3.2 Gaps & Issues

1. **Shared backend state**
   - All 10 instances use the same backend logic but different ports. Each port runs its own server process, so policies/claims are isolated per port. Data is stored in `data/` (SQLite/JSON) – each process has its own DB file if using separate working directories. **Finding:** With `cwd: backendDir` for all children, they share the same `data/` directory. Policies from different ports will mix in one store. This may be acceptable for demos but not for production isolation.

2. **Auth**
   - All requests use `X-API-Key: demo`. No partner-specific keys or sandbox vs production separation in the scenario demos.

3. **Terms & conditions**
   - No explicit terms acceptance checkbox before binding in the scenario pages (unlike the main checkout-ux-demo). Consider adding for compliance.

4. **Error handling**
   - On bind failure, the UI still shows “Order complete” with a generic message. No retry or clear error state.

5. **Mobile responsiveness**
   - Layouts are desktop-first. Sidebar stacks on smaller screens via flex, but no dedicated mobile viewport toggle like in checkout-ux-demo.

6. **Image dependencies**
   - All images are external (Unsplash). Offline or blocked requests result in empty image placeholders.

7. **Parametric scenario**
   - Parametric trigger (rainfall > 5mm) is described in UI but not wired to `/api/claim/trigger`. The bind flow is standard; parametric payout would require a separate trigger step.

---

## 4. Recommendations

### 4.1 High Priority

| # | Recommendation | Rationale |
|---|----------------|------------|
| 1 | **Add terms acceptance** | Add a checkbox for “I agree to the Terms & Conditions” before binding, matching checkout-ux-demo and compliance expectations. |
| 2 | **Improve error handling** | On bind failure, show a clear error message and allow retry instead of a generic success state. |
| 3 | **Isolate data per scenario (optional)** | If demos must not mix data, use `data/scenario-{id}/` or a DB per port. For most demos, shared data is acceptable. |

### 4.2 Medium Priority

| # | Recommendation | Rationale |
|---|----------------|------------|
| 4 | **Add mobile viewport toggle** | Reuse the Desktop/Mobile toggle from checkout-ux-demo for consistent testing across devices. |
| 5 | **Parametric trigger demo** | Add a “Simulate trigger” button that calls `POST /api/claim/trigger` to demonstrate parametric payout flow. |
| 6 | **Local image fallbacks** | Add placeholder SVGs or local images for when Unsplash is unavailable. |
| 7 | **Document launch process** | Add a short README section: “Run `npm run scenarios` from backend/ to start all 10 scenarios.” |

### 4.3 Lower Priority

| # | Recommendation | Rationale |
|---|----------------|------------|
| 8 | **Multi-provider selection** | Extend scenarios to show multiple provider options (like checkout-ux-demo) instead of a single recommended plan. |
| 9 | **Policy confirmation** | Call `POST /api/policy/confirm` after bind to complete the full flow. |
| 10 | **Analytics per scenario** | Track quote/bind counts per scenario in analytics for conversion analysis. |

---

## 5. How to Run

### Start all 10 scenarios

```bash
cd backend
npm run scenarios
```

Or directly:

```bash
node scripts/launch-all-scenarios.js
```

### Access each scenario

| Scenario | URL |
|----------|-----|
| Retail | http://localhost:3001 |
| Logistics | http://localhost:3002 |
| Healthcare | http://localhost:3003 |
| Hospitality | http://localhost:3004 |
| Food | http://localhost:3005 |
| Cyber | http://localhost:3006 |
| Mobility | http://localhost:3007 |
| Parametric | http://localhost:3008 |
| Gadgets | http://localhost:3009 |
| Events | http://localhost:3010 |

### Stop all

Press `Ctrl+C` in the terminal running the launcher.

---

## 6. Summary

The 10 industry scenarios provide a solid demo foundation with complex transactions, industry-specific UI, and full API integration. Main improvements to consider are terms acceptance, clearer error handling, and optional parametric trigger demonstration. The implementation is suitable for demos, partner showcases, and integration testing across industries.

---

*Document version: 1.0 | Based on SafeCover 10-scenario implementation review | Feb 2026*
