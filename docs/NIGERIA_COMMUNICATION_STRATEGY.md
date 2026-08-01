# SafeCover — Nigeria Communication & Outreach Strategy

**Status**: Draft, 2026-08-01. Companion to
[`NIGERIA_MARKET_AND_PROJECT_BRIEFING.md`](./NIGERIA_MARKET_AND_PROJECT_BRIEFING.md).
Mirrors the stakeholder-engagement pattern used on the SafeguardLens AI / GMSTP
partnership work — sequenced, honestly-framed outreach rather than a mass contact blast.

**This document is prep, not a green light.** Nothing here should be sent until the
gating conditions in Section 0 are explicitly re-confirmed.

---

## 0. Gating status — read this before sending anything

The user's brief for this document was explicit: build the strategy and contact
shortlist now, but gate *actual outreach* on the Critical security fixes landing.

**Done as of 2026-08-01** (see `RECOMMENDATIONS_BACKLOG.md` for detail):
- The two live cross-tenant authorization bugs (open partner-key minting, admin
  impersonation via a spoofable header) are closed.
- Policy/claim ID enumeration fixed, PII redacted in both audit paths, a same-day
  validation regression fixed, minimal CI stood up, and the regulatory doc flagged as
  aspirational rather than current-state.

**Still open, and these gate outreach just as much as the security bugs did** — they're
about not misrepresenting the product to a real business, which is the same risk class:
- No real insurance carrier or MGA is behind any quote yet (Part 2 of the briefing doc).
- The provider dataset is UK-flavored, not Nigeria-flavored — fix before any
  Nigeria-specific pitch names real providers.
- The parametric "auto-payout" feature — likely to be the most attractive line for
  logistics/travel/events partners — doesn't work end-to-end.
- No DPIA has been done, and no real customer PII should flow through any conversation
  or pilot until one has.

**Practical read**: it is fine to *start* the sequence below — because Phase 1 (carrier/MGA
search) doesn't require the product to be pilot-ready, it requires SafeCover to be a
credible technology/orchestration partner, which it already is. It is **not** fine to
start Phase 2 (merchant/airline/hospital design-partner conversations) using the language
in Section 2 until at minimum: a real carrier conversation is underway, and the
Nigeria-specific provider/regulatory data mismatch is resolved. Re-check this section
before any message goes out.

---

## 1. Sequencing: carrier first, merchants second

The contact research below covers e-commerce, retail, hospitality, logistics, airlines,
rail, bus, ferry, ticketing, cinema, and healthcare — i.e. potential *distribution*
partners. But SafeCover's own `docs/PRODUCTION.md` and the partner deck narrative
correctly describe the target model as an **orchestration layer sitting in front of a
licensed carrier's paper** (the bolttech/bsurance pattern) — not an insurer itself.

That means the logical first conversation isn't with Jumia or Air Peace — it's with a
**licensed Nigerian insurer or MGA** willing to provide underwriting capacity behind a
pilot product. Approaching a major retailer or airline before that exists risks exactly
the credibility problem the product review flagged: promising a "marketplace" that isn't
real. Recommended order:

1. **Phase 1 — Carrier/MGA conversations** (not covered in this contact list; a separate,
   smaller, higher-touch search — likely candidates include NAICOM-licensed general
   insurers already active in digital/bancassurance distribution, or an existing MGA).
   Goal: one committed pilot-capacity relationship, even informal/non-exclusive.
2. **Phase 2 — Design-partner conversations with 1-2 merchants**, once Phase 1 has a
   credible answer, framed as co-design rather than a finished product pitch.
3. **Phase 3 — Broader sector outreach**, only once Phase 2 has produced a working,
   named pilot to point to.

This document's contact shortlist (Section 3) is Phase 2/3 material — hold it until
Phase 1 lands.

---

## 2. Messaging framework (per phase)

### Phase 1 — carrier/MGA (co-build framing)
> "We've built the checkout-integration and policy-lifecycle plumbing for embedded
> insurance — quote, bind, confirm, claims, widget integrations across major e-commerce
> platforms. We're looking for a licensed partner to provide underwriting capacity for a
> pilot. We're not asking you to trust a finished product — we want to co-design the
> pilot scope with you from here."

### Phase 2/3 — merchant/distribution partner (honest early-stage framing)
> "SafeCover is building embedded micro-insurance for checkout — the kind of instant,
> low-cost protection you see in more mature e-commerce markets. We have working
> integration technology and are in conversation with [carrier/MGA] for underwriting
> capacity. We'd like to explore whether [Company]'s checkout/booking flow would be a
> good fit for an early pilot — no commitment, just a conversation about the shape of the
> product from your side."

**Do not use, until true**: "marketplace," "multiple insurers," "instant automatic
payout," "production-ready," "AI-powered fraud detection" (current fraud logic is
rule-based, not AI) — all flagged as overclaiming risks in the product review.

### Sector-specific angles (for Phase 2/3, once unblocked)

| Sector | Natural insurance angle | Notes |
|---|---|---|
| E-commerce / marketplaces (Jumia, Konga, Jiji) | Shipping/goods-in-transit, purchase protection | Closest match to `providers.js`'s current "retail"/"logistics" scenario data |
| Electronics retail (Slot, Samsung, LG) | Gadget damage/theft cover at point of sale | Matches the existing "gadgets" scenario |
| Hospitality (hotels, booking platforms) | Trip cancellation, stay protection | Matches "hospitality" scenario |
| Logistics/delivery (GIG Logistics, Kwik, MAX) | Goods-in-transit, courier liability | Direct product-market fit with current scenario set |
| Airlines (Air Peace, Ibom Air, Arik Air) | Flight delay/cancellation — genuinely parametric-shaped | **Do not lead with this** until the parametric trigger is real — this is the sector most likely to ask "how does the payout actually trigger?" |
| Rail / bus / ferry | Trip/journey protection | Lower average transaction value — useful for proving micro-premium economics |
| Ticketing / cinema | Event cancellation, "can't attend" refund cover | Well-suited to short-duration/low-value micro-policies |
| Healthcare (HMOs) | Complementary/gap cover, not a competitor pitch | Position as complementary to HMO cover, not replacing it — approach as a distribution/technology partner, not a rival insurer |

---

## 3. Contact shortlist (Phase 2/3 — hold until Phase 1 lands)

Compiled via web research 2026-08-01, general-purpose agent, read-only. **Every entry
below reflects only what was actually found on a public page or in a search result — no
email address was pattern-guessed.** "Partial" means a company/contact page was found but
no direct email/contact point was confirmed; "Not found" means neither was located.
Re-verify before use — contact details and operational status (see the Dana Air flag)
can change.

| Sector | Company | What was found | Source | Confidence |
|---|---|---|---|---|
| E-commerce | Jumia Nigeria | Customer-care contact form | [jumia.com.ng/sp-contact](https://www.jumia.com.ng/sp-contact/) | Partial |
| E-commerce | Jumia Group | Press contact: `press@jumia.com` | [jumia-blog.com/contacts](https://www.jumia-blog.com/contacts) | Verified (press, not BD) |
| E-commerce | Konga | Partner-application form (Konga Partner Network) | [kpn.konga.com](https://kpn.konga.com/) | Verified (form) |
| E-commerce | Konga | `partnerships@konga.com` — only on a third-party directory, not Konga's own site | [nigerianfinder.com](https://nigerianfinder.com/konga-nigeria-contact-address/) | Partial — unverified |
| E-commerce | Jiji Nigeria | No contact/partnerships info located | — | Not found |
| Electronics | Slot Systems Ltd | Store phone/address (Computer Village, Lagos); no partnerships page found | [businesslist.com.ng](https://www.businesslist.com.ng/company/99523/slot-systems) | Partial |
| Electronics | Samsung Business Africa | Dedicated business "Contact Us" / sales-expert form | [samsung.com/africa_en/business/contact-us](https://www.samsung.com/africa_en/business/contact-us/) | Verified (form) |
| Electronics | LG Nigeria | Toll-free 0800 9811 5454; WhatsApp +234 805 889 9908 (general support) | [lg.com/africa/support/telephone](https://www.lg.com/africa/support/telephone) | Partial |
| Hospitality | Transcorp Hotels Plc | Corporate site exists; no direct BD contact found | [transcorphotels.com](https://www.transcorphotels.com/) | Not found |
| Hospitality | Eko Hotels & Suites | Contact page exists; Director of Sales & Marketing named (Iyadunni Gbadebo), no confirmed direct email | [ekohotels.com/contact.php](https://www.ekohotels.com/contact.php) | Partial |
| Logistics | GIG Logistics (GIGL) | Official Partnership page exists (blocked on fetch — visit manually); contact-us page confirmed | [giglogistics.com/partnership](https://giglogistics.com/partnership/) | Partial |
| Logistics | Kwik Delivery | Partnership page + contact form | [kwik.delivery/partnership](https://kwik.delivery/partnership/) | Partial |
| Logistics | MAX (maxdrive.ai) | General `support@maxdrive.ai` / `info@maxdrive.ai` | via search aggregator | Partial (general, not BD) |
| Airlines | Air Peace | `info@flyairpeace.com`, `callcentre@flyairpeace.com` | [flyairpeace.com/help-and-contact](https://flyairpeace.com/help-and-contact/) | Verified (general) |
| Airlines | Ibom Air | `info@ibomair.com`, `reservations@ibomair.com` | [ibomair.com/contact-us](https://www.ibomair.com/contact-us/) | Verified (general) |
| Airlines | Arik Air | `talktous@arikair.com`, `callcentre@arikair.com` | cross-checked via aggregator | Partial |
| Airlines | Dana Air | **⚠ Flag: AOC reportedly suspended by NCAA since April 2024, no confirmed resumption found — verify operational status before any outreach** | [Wikipedia](https://en.wikipedia.org/wiki/Dana_Air) | Not found / unverified status |
| Rail | Nigerian Railway Corporation (NRC) | `helpdesk@nrc-fane.ng`, WhatsApp 0813 463 7664 | [nrc.gov.ng](https://nrc.gov.ng/) | Verified (general) |
| Bus | ABC Transport Plc | `contact@abctransport.com`, `info@abctransport.com`, contact form | [abctransport.com/contact.html](https://www.abctransport.com/contact.html) | Verified |
| Bus | God is Good Motors (GIGM) | Email referenced only in obscured form, not independently confirmed | — | Not found |
| Bus | Peace Mass Transit | Phone numbers only, no email found | [businesslist.com.ng](https://www.businesslist.com.ng/company/204566/peace-mass-transit-limited) | Partial |
| Ferry | Lagos State Ferry Services Corp (LAGFERRY) | `sailsafe@lagferry.gov.ng` | [lagferry.gov.ng/contact-us](https://lagferry.gov.ng/contact-us/) | Verified |
| Ferry | Texas Connection Ferries Ltd | Address only; official site's certificate expired, contact unverifiable | [businesslist.com.ng](https://www.businesslist.com.ng/company/127925/texas-connection-ferries-ltd) | Partial |
| Ferry (regulator) | Lagos State Waterways Authority (LASWA) | Licenses all operators; site exists, no specific contact fetched | [laswa.lagosstate.gov.ng](https://laswa.lagosstate.gov.ng/) | Partial |
| Ticketing | Quickteller Events (Interswitch) | Business sales contact via business.quickteller.com | [business.quickteller.com](https://business.quickteller.com/) | Partial |
| Ticketing | Nairabox (now part of Wakanow Group) | `support@nairabox.com`; Head of Sales & Partnerships named, no confirmed email | via aggregator | Partial |
| Ticketing | TIXVNT | Contact form only | [tixvnt.com/about](https://tixvnt.com/about) | Partial |
| Cinema | Filmhouse Cinemas | `sales@filmhouseng.com` (advertising/marketing) | [filmhouseng.com/contact-us](https://www.filmhouseng.com/contact-us) | Verified |
| Cinema | Genesis Pictures (distribution arm) | `admin@genesispicturesng.com`, `head.distributions@genesispicturesng.com` | [genesispicturesng.com/contact](https://genesispicturesng.com/contact) | Verified |
| Cinema | Silverbird Cinemas | Marketing phone numbers only; contact page blocked on fetch | [silverbirdcinemas.com/contact](https://silverbirdcinemas.com/contact/) | Partial |
| Healthcare | Reliance HMO | `hellonigeria@getreliancehealth.com` | [getreliancehealth.com/nigeria/contact](https://getreliancehealth.com/nigeria/contact/) | Verified |
| Healthcare | AXA Mansard Health | `healthcare@axamansard.com`; Exec Director of BD named (Adeola Adebanjo) | [corporate.axamansard.com](https://corporate.axamansard.com/subsidiaries/axa-health/) | Verified (general) |
| Healthcare | Hygeia HMO | `hycare@hygeiahmo.com`; Head of Partnerships named (Bolaji Ajibola), email not confirmed | [hygeiahmo.com/contact-us](https://hygeiahmo.com/contact-us/) | Verified (general) |

**Gaps to close before Phase 2/3 outreach**: no verified direct BD contact for Jiji,
Transcorp Hotels, GIGM, GIG Logistics (page blocked — visit manually), Peace Mass Transit,
Quickteller Events, TIXVNT, or Silverbird Cinemas. A few official pages returned
HTTP errors on automated fetch (GIG Logistics partnership page, Silverbird Cinemas,
Texas Connection Ferries) — check these manually in a browser rather than assuming
"not found" is final.

---

## 4. Before any message goes out — checklist

- [ ] Phase 1 (carrier/MGA) has at least one credible, named conversation underway
- [ ] Provider/regulatory dataset reflects Nigeria, not the current UK/FCA placeholder data
- [ ] Whoever sends outreach uses the Phase 2/3 message template in Section 2, not
      draft pitch-deck language from `docs/partner/`
- [ ] No claim is made about parametric auto-payout, "marketplace," or "AI fraud
      detection" unless it has become true by then
- [ ] Recipient list re-checked against this table's "confidence" column — don't email a
      guessed address
