# -*- coding: utf-8 -*-
"""Build self-contained partner pitch HTML (run from repo root: python docs/partner/build_partner_pitch_html.py)."""
import base64
import io
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "SafeCover-Insurance-Partner-Pitch.html"


def make_charts_b64():
    """Render matplotlib figures to base64 PNG (requires matplotlib)."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    def fig_to_b64(fig):
        buf = io.BytesIO()
        fig.savefig(
            buf,
            format="png",
            dpi=150,
            bbox_inches="tight",
            facecolor="#0f172a",
            edgecolor="none",
        )
        plt.close(fig)
        return base64.b64encode(buf.getvalue()).decode()

    fig, ax = plt.subplots(figsize=(8, 4), facecolor="#0f172a")
    ax.set_facecolor("#0f172a")
    years = [2024, 2026, 2028, 2030]
    prem = [25, 38, 55, 72]
    ax.plot(years, prem, color="#38bdf8", linewidth=3, marker="o", markersize=10)
    ax.fill_between(years, prem, alpha=0.15, color="#38bdf8")
    ax.set_xlabel("Year", color="#e2e8f0", fontsize=11)
    ax.set_ylabel("Illustrative embedded premium (USD bn)", color="#e2e8f0", fontsize=10)
    ax.set_title(
        "Embedded insurance - indicative growth (discussion only)",
        color="#f8fafc",
        fontsize=12,
        pad=12,
    )
    ax.tick_params(colors="#94a3b8")
    for s in ax.spines.values():
        s.set_color("#334155")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(True, alpha=0.2, color="#64748b")
    c1 = fig_to_b64(fig)

    fig, ax = plt.subplots(figsize=(8, 4), facecolor="#0f172a")
    ax.set_facecolor("#0f172a")
    labels = ["Lower CAC", "Intent at checkout", "API automation", "Risk data"]
    vals = [88, 92, 85, 78]
    colors = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24"]
    ax.barh(labels, vals, color=colors, height=0.55, alpha=0.9)
    ax.set_xlim(0, 100)
    ax.set_xlabel("Qualitative strength index", color="#e2e8f0")
    ax.set_title(
        "Carrier partnership value drivers (workshop index)",
        color="#f8fafc",
        fontsize=12,
    )
    ax.tick_params(colors="#94a3b8")
    for s in ax.spines.values():
        s.set_color("#334155")
    ax.grid(True, axis="x", alpha=0.2, color="#64748b")
    c2 = fig_to_b64(fig)

    fig, ax = plt.subplots(figsize=(8, 3.5), facecolor="#0f172a")
    ax.set_facecolor("#0f172a")
    parts = ["Carrier and capital", "Distributor", "Platform or MGA"]
    w = [60, 25, 15]
    cs = ["#0ea5e9", "#a78bfa", "#f59e0b"]
    cum = 0
    for p, c in zip(w, cs):
        ax.barh(0, p, left=cum, color=c, height=0.5, label=p)
        cum += p
    ax.set_xlim(0, 100)
    ax.set_yticks([])
    ax.legend(
        loc="upper center",
        ncol=3,
        frameon=False,
        labelcolor="#e2e8f0",
        fontsize=9,
    )
    ax.set_title("Illustrative economics split (example only)", color="#f8fafc")
    for s in ax.spines.values():
        s.set_color("#334155")
    c3 = fig_to_b64(fig)

    return c1, c2, c3


def svg_ecosystem():
    return r"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 420" role="img" aria-labelledby="ecoTitle ecoDesc">
  <title id="ecoTitle">SafeCover partner ecosystem</title>
  <desc id="ecoDesc">Merchants and POS connect to SafeCover API, which connects to carrier PAS, claims, and optional ledger.</desc>
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="920" height="420" fill="#0b1220"/>
  <text x="460" y="36" text-anchor="middle" fill="#f8fafc" font-size="20" font-family="Segoe UI, system-ui, sans-serif" font-weight="600">Distribution and insurer-core architecture</text>
  <!-- Merchants -->
  <rect x="40" y="80" width="200" height="260" rx="14" fill="#111827" stroke="#334155" stroke-width="2" filter="url(#shadow)"/>
  <text x="140" y="112" text-anchor="middle" fill="#94a3b8" font-size="13" font-family="Segoe UI, system-ui, sans-serif">Channels</text>
  <text x="140" y="145" text-anchor="middle" fill="#e2e8f0" font-size="14" font-family="Segoe UI, system-ui, sans-serif">E-commerce</text>
  <text x="140" y="168" text-anchor="middle" fill="#cbd5e1" font-size="12" font-family="Segoe UI, system-ui, sans-serif">Shopify, WooCommerce,</text>
  <text x="140" y="186" text-anchor="middle" fill="#cbd5e1" font-size="12" font-family="Segoe UI, system-ui, sans-serif">BigCommerce, Magento</text>
  <text x="140" y="220" text-anchor="middle" fill="#e2e8f0" font-size="14" font-family="Segoe UI, system-ui, sans-serif">Retail POS</text>
  <text x="140" y="242" text-anchor="middle" fill="#cbd5e1" font-size="12" font-family="Segoe UI, system-ui, sans-serif">Server-side terminals,</text>
  <text x="140" y="260" text-anchor="middle" fill="#cbd5e1" font-size="12" font-family="Segoe UI, system-ui, sans-serif">ticket IDs, idempotency</text>
  <text x="140" y="300" text-anchor="middle" fill="#38bdf8" font-size="11" font-family="Segoe UI, system-ui, sans-serif">HTTPS + JSON</text>

  <!-- SafeCover -->
  <rect x="320" y="70" width="280" height="280" rx="16" fill="#0f172a" stroke="url(#g1)" stroke-width="2" filter="url(#shadow)"/>
  <text x="460" y="105" text-anchor="middle" fill="#f8fafc" font-size="17" font-family="Segoe UI, system-ui, sans-serif" font-weight="600">SafeCover platform</text>
  <text x="460" y="132" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="Segoe UI, system-ui, sans-serif">Quote · Bind · Confirm · Webhooks · POS enhanced</text>
  <rect x="350" y="150" width="220" height="36" rx="8" fill="#1e293b"/>
  <text x="460" y="173" text-anchor="middle" fill="#e2e8f0" font-size="12" font-family="Segoe UI, system-ui, sans-serif">API gateway + strict mode (production)</text>
  <rect x="350" y="198" width="220" height="36" rx="8" fill="#1e293b"/>
  <text x="460" y="221" text-anchor="middle" fill="#e2e8f0" font-size="12" font-family="Segoe UI, system-ui, sans-serif">Scenario engine · multi-provider quotes</text>
  <rect x="350" y="246" width="220" height="36" rx="8" fill="#1e293b"/>
  <text x="460" y="269" text-anchor="middle" fill="#e2e8f0" font-size="12" font-family="Segoe UI, system-ui, sans-serif">Policy ledger · HMAC · regulatory snapshot</text>
  <rect x="350" y="294" width="220" height="40" rx="8" fill="#172554"/>
  <text x="460" y="319" text-anchor="middle" fill="#93c5fd" font-size="11" font-family="Segoe UI, system-ui, sans-serif">Widget + adapters (universal embed)</text>

  <!-- Carrier -->
  <rect x="660" y="80" width="220" height="260" rx="14" fill="#111827" stroke="#334155" stroke-width="2" filter="url(#shadow)"/>
  <text x="770" y="112" text-anchor="middle" fill="#94a3b8" font-size="13" font-family="Segoe UI, system-ui, sans-serif">Licensed insurer core</text>
  <text x="770" y="150" text-anchor="middle" fill="#e2e8f0" font-size="13" font-family="Segoe UI, system-ui, sans-serif">PAS / policy admin</text>
  <text x="770" y="188" text-anchor="middle" fill="#e2e8f0" font-size="13" font-family="Segoe UI, system-ui, sans-serif">Billing &amp; premium</text>
  <text x="770" y="226" text-anchor="middle" fill="#e2e8f0" font-size="13" font-family="Segoe UI, system-ui, sans-serif">Claims &amp; TPA</text>
  <text x="770" y="264" text-anchor="middle" fill="#e2e8f0" font-size="13" font-family="Segoe UI, system-ui, sans-serif">Filing · capital · reinsurance</text>
  <text x="770" y="310" text-anchor="middle" fill="#34d399" font-size="11" font-family="Segoe UI, system-ui, sans-serif">Your systems of record</text>

  <!-- Arrows -->
  <path d="M 245 200 L 310 200" stroke="#64748b" stroke-width="3" marker-end="url(#arr)"/>
  <path d="M 605 200 L 650 200" stroke="#64748b" stroke-width="3" marker-end="url(#arr)"/>
  <defs>
    <marker id="arr" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
      <polygon points="0 0, 10 3, 0 6" fill="#64748b"/>
    </marker>
  </defs>
  <text x="460" y="400" text-anchor="middle" fill="#64748b" font-size="11" font-family="Segoe UI, system-ui, sans-serif">Pilot: connect PAS webhooks, replace demo persistence, align product codes with filed tariffs.</text>
</svg>
"""


def svg_lifecycle():
    return r"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 200" role="img" aria-labelledby="lcTitle">
  <title id="lcTitle">Policy lifecycle</title>
  <rect width="900" height="200" fill="#0b1220"/>
  <defs>
    <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee"/><stop offset="100%" stop-color="#a78bfa"/>
    </linearGradient>
  </defs>
  <text x="450" y="32" text-anchor="middle" fill="#f8fafc" font-size="18" font-family="Segoe UI, system-ui, sans-serif" font-weight="600">Quote → bind → confirm (payment-aligned)</text>
  <g font-family="Segoe UI, system-ui, sans-serif">
    <rect x="40" y="70" width="150" height="72" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="115" y="100" text-anchor="middle" fill="#e2e8f0" font-size="13" font-weight="600">Quote</text>
    <text x="115" y="122" text-anchor="middle" fill="#94a3b8" font-size="11">POST /api/quote</text>
    <text x="115" y="138" text-anchor="middle" fill="#94a3b8" font-size="11">POS: quote op</text>
    <path d="M 195 106 L 230 106" stroke="url(#lg)" stroke-width="4" marker-end="url(#m)"/>
    <rect x="235" y="70" width="150" height="72" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="310" y="100" text-anchor="middle" fill="#e2e8f0" font-size="13" font-weight="600">Bind</text>
    <text x="310" y="122" text-anchor="middle" fill="#94a3b8" font-size="11">PENDING_PAYMENT</text>
    <text x="310" y="138" text-anchor="middle" fill="#94a3b8" font-size="11">Idempotency key</text>
    <path d="M 390 106 L 425 106" stroke="url(#lg)" stroke-width="4" marker-end="url(#m)"/>
    <rect x="430" y="70" width="150" height="72" rx="12" fill="#1e293b" stroke="#334155"/>
    <text x="505" y="100" text-anchor="middle" fill="#e2e8f0" font-size="13" font-weight="600">Payment</text>
    <text x="505" y="122" text-anchor="middle" fill="#94a3b8" font-size="11">Merchant PSP</text>
    <text x="505" y="138" text-anchor="middle" fill="#94a3b8" font-size="11">Webhook optional</text>
    <path d="M 585 106 L 620 106" stroke="url(#lg)" stroke-width="4" marker-end="url(#m)"/>
    <rect x="625" y="70" width="150" height="72" rx="12" fill="#14532d" stroke="#22c55e"/>
    <text x="700" y="100" text-anchor="middle" fill="#ecfdf5" font-size="13" font-weight="600">Confirm</text>
    <text x="700" y="122" text-anchor="middle" fill="#bbf7d0" font-size="11">ACTIVE policy</text>
    <text x="700" y="138" text-anchor="middle" fill="#bbf7d0" font-size="11">Regulatory snapshot</text>
    <path d="M 778 106 L 813 106" stroke="url(#lg)" stroke-width="4" marker-end="url(#m)"/>
    <rect x="818" y="70" width="42" height="72" rx="8" fill="#0c4a6e" stroke="#0ea5e9"/>
    <text x="839" y="115" text-anchor="middle" fill="#e0f2fe" font-size="11" font-weight="600">PAS</text>
  </g>
  <defs>
    <marker id="m" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#a78bfa"/>
    </marker>
  </defs>
  <text x="450" y="180" text-anchor="middle" fill="#64748b" font-size="11" font-family="Segoe UI, system-ui, sans-serif">POS one-shot: POST /api/pos/enhanced operation sale when tender is complete.</text>
</svg>
"""


def svg_stakeholder():
    return r"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 300" role="img">
  <rect width="880" height="300" fill="#0b1220"/>
  <text x="440" y="34" text-anchor="middle" fill="#f8fafc" font-size="18" font-family="Segoe UI, system-ui, sans-serif" font-weight="600">Three-sided value (embedded microinsurance)</text>
  <g font-family="Segoe UI, system-ui, sans-serif">
    <circle cx="160" cy="150" r="78" fill="#164e63" stroke="#22d3ee" stroke-width="2"/>
    <text x="160" y="135" text-anchor="middle" fill="#ecfeff" font-size="14" font-weight="600">Consumer</text>
    <text x="160" y="158" text-anchor="middle" fill="#a5f3fc" font-size="11">One-tap cover</text>
    <text x="160" y="176" text-anchor="middle" fill="#a5f3fc" font-size="11">In-context price</text>
    <text x="160" y="194" text-anchor="middle" fill="#a5f3fc" font-size="11">Trust at checkout</text>
    <circle cx="440" cy="150" r="78" fill="#312e81" stroke="#a78bfa" stroke-width="2"/>
    <text x="440" y="135" text-anchor="middle" fill="#eef2ff" font-size="14" font-weight="600">Distributor</text>
    <text x="440" y="158" text-anchor="middle" fill="#c4b5fd" font-size="11">Higher conversion</text>
    <text x="440" y="176" text-anchor="middle" fill="#c4b5fd" font-size="11">Ancillary revenue</text>
    <text x="440" y="194" text-anchor="middle" fill="#c4b5fd" font-size="11">Differentiation</text>
    <circle cx="720" cy="150" r="78" fill="#14532d" stroke="#34d399" stroke-width="2"/>
    <text x="720" y="135" text-anchor="middle" fill="#ecfdf5" font-size="14" font-weight="600">Insurer</text>
    <text x="720" y="158" text-anchor="middle" fill="#bbf7d0" font-size="11">Volume at low CAC</text>
    <text x="720" y="176" text-anchor="middle" fill="#bbf7d0" font-size="11">Digital segments</text>
    <text x="720" y="194" text-anchor="middle" fill="#bbf7d0" font-size="11">Data for pricing</text>
  </g>
  <line x1="238" y1="150" x2="362" y2="150" stroke="#475569" stroke-width="2" stroke-dasharray="6 4"/>
  <line x1="518" y1="150" x2="642" y2="150" stroke="#475569" stroke-width="2" stroke-dasharray="6 4"/>
  <text x="440" y="270" text-anchor="middle" fill="#64748b" font-size="11" font-family="Segoe UI, system-ui, sans-serif">SafeCover orchestrates UX, APIs, and handoff to your licensed core.</text>
</svg>
"""


def main():
    c1, c2, c3 = make_charts_b64()
    eco, life, stake = svg_ecosystem(), svg_lifecycle(), svg_stakeholder()

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>SafeCover — Insurance Partner Pitch</title>
  <style>
    :root {{
      --bg: #070b14;
      --card: #0f172a;
      --border: #1e293b;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent2: #a78bfa;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: linear-gradient(180deg, #070b14 0%, #0b1224 40%);
      color: var(--text);
      line-height: 1.55;
      font-size: 15px;
    }}
    .wrap {{ max-width: 900px; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }}
    header.cover {{
      text-align: center;
      padding: 3rem 1rem 2.5rem;
      border: 1px solid var(--border);
      border-radius: 20px;
      background: radial-gradient(ellipse at 50% 0%, #1e3a5f 0%, transparent 55%), var(--card);
      margin-bottom: 2rem;
    }}
    .badge {{
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      background: #172554;
      color: #93c5fd;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }}
    h1 {{ font-size: clamp(1.75rem, 4vw, 2.35rem); margin: 0.75rem 0 0.5rem; font-weight: 700; }}
    .subtitle {{ color: var(--muted); font-size: 1.05rem; max-width: 36rem; margin: 0 auto; }}
    h2 {{
      font-size: 1.35rem;
      margin-top: 2.25rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--border);
      color: #f8fafc;
    }}
    h3 {{ font-size: 1.05rem; color: var(--accent); margin-top: 1.25rem; }}
    p {{ margin: 0.75rem 0; color: #cbd5e1; }}
    ul {{ margin: 0.5rem 0 0.75rem 1.1rem; color: #cbd5e1; }}
    li {{ margin: 0.35rem 0; }}
    .callout {{
      border-left: 4px solid var(--accent);
      padding: 0.75rem 1rem;
      background: #0c1929;
      border-radius: 0 10px 10px 0;
      margin: 1rem 0;
    }}
    .grid2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin: 1rem 0;
    }}
    @media (max-width: 700px) {{ .grid2 {{ grid-template-columns: 1fr; }} }}
    .card {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1rem 1.15rem;
    }}
    .figure {{
      margin: 1.25rem 0;
      border-radius: 14px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #0b1220;
    }}
    .figure img {{ width: 100%; height: auto; display: block; vertical-align: middle; }}
    .figure svg {{ width: 100%; height: auto; display: block; }}
    .caption {{ font-size: 12px; color: var(--muted); margin-top: 0.35rem; }}
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      margin: 1rem 0;
    }}
    th, td {{ border: 1px solid var(--border); padding: 0.55rem 0.65rem; text-align: left; }}
    th {{ background: #111827; color: #f1f5f9; }}
    .footer {{
      margin-top: 3rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      font-size: 12px;
      color: var(--muted);
    }}
    @media print {{
      body {{ background: #fff; color: #111; }}
      .wrap {{ max-width: 100%; }}
      header.cover, .card, .figure {{ break-inside: avoid; }}
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="cover">
      <span class="badge">Confidential — partner discussion</span>
      <h1>SafeCover</h1>
      <p class="subtitle">Embedded microinsurance for e-commerce and retail POS: business case, architecture, and partnership path for a licensed insurer.</p>
      <p class="subtitle" style="margin-top:1rem;font-size:0.9rem;">Prepared May 2026 · Builds on internal white paper draft (“Embedded MicroInsurance Platform Business Model”) and the SafeCover reference implementation.</p>
    </header>

    <section id="exec">
      <h2>Executive summary</h2>
      <p><strong>SafeCover</strong> is an API-first embedded microinsurance orchestration layer: quotes, bind, payment-aligned confirmation, webhooks, and a unified retail <strong>POS</strong> flow—so merchants can offer contextual protection without sending shoppers to a separate insurance journey.</p>
      <div class="callout">
        <strong>Ask to the carrier:</strong> pilot one filed product (or rider) through SafeCover’s integration surface, connect your PAS and claims rails, and co-sell through one anchor distributor (e-commerce or POS)—proving attach rate, loss behaviour, and operational fit in 90–120 days.
      </div>
    </section>

    <section id="market">
      <h2>Market opportunity (from your draft, tightened)</h2>
      <p>Embedded insurance continues to shift purchase from “go find a policy” to “protect this basket, trip, or ticket <em>now</em>.” Industry commentary commonly cites embedded as a multi‑tens‑of‑billions gross-premium trajectory this decade; exact forecasts vary by scope definition, but the <strong>strategic direction</strong> is consistent: ecosystems win distribution, and carriers win when they meet partners with <strong>APIs, speed, and clear compliance hooks</strong>.</p>
      <p>Microinsurance fits short, well-defined exposures (shipment, device, ticket, cyber add-ons). SafeCover’s codebase is explicitly oriented to <strong>scenario-based</strong> offers and <strong>multi-provider</strong> comparison in demo—useful for workshops, with production paths to a <strong>single approved carrier</strong> per market.</p>
      <div class="figure"><img src="data:image/png;base64,{c1}" alt="Indicative embedded insurance growth chart"/></div>
      <p class="caption">Illustrative curve for discussion only—not a firm market forecast.</p>
    </section>

    <section id="stakeholders">
      <h2>Stakeholder value</h2>
      <div class="figure">{stake}</div>
      <div class="figure"><img src="data:image/png;base64,{c2}" alt="Qualitative carrier partnership drivers"/></div>
      <p class="caption">Index scores are qualitative workshop aids, not scored research.</p>
    </section>

    <section id="safecover">
      <h2>What SafeCover is today (reference stack)</h2>
      <div class="grid2">
        <div class="card">
          <h3>Distribution surface</h3>
          <ul>
            <li>Node.js Express API: quote, bind, confirm, webhook, claims stubs</li>
            <li><code>POST /api/pos/enhanced</code> for retail: quote, bind, confirm, or <code>sale</code></li>
            <li>Universal widget + adapters: Shopify, WooCommerce, BigCommerce, Magento, generic</li>
            <li>WooCommerce PHP plugin path for server-side checkout</li>
          </ul>
        </div>
        <div class="card">
          <h3>Insurer-grade hooks (prototype)</h3>
          <ul>
            <li>Strict mode: API keys, quote signing, registered quotes at bind, CORS allowlist</li>
            <li>Webhook HMAC, bind idempotency, <code>regulatory_snapshot</code> on policies</li>
            <li>Env placeholders: carrier entity, license ref, filing code, wording version</li>
            <li>Solidity contract in repo; on-chain issuance from API is a roadmap item</li>
          </ul>
        </div>
      </div>
      <p>See repository <code>README.md</code>, <code>docs/API.md</code>, <code>docs/PRODUCTION.md</code>, and <code>docs/WHITEPAPER-CODEBASE-MAP.md</code> for line-level mapping.</p>
    </section>

    <section id="architecture">
      <h2>Business &amp; technology architecture</h2>
      <p>The platform is deliberately <strong>thin at the edge</strong> (merchant UX) and <strong>strict at the core</strong> (quote integrity, payment alignment, audit metadata). Your PAS remains the system of record; SafeCover accelerates <strong>front-end integration</strong> and <strong>transactional consistency</strong> up to the handoff you define.</p>
      <div class="figure">{eco}</div>
      <h3>Policy lifecycle (payment-aligned)</h3>
      <div class="figure">{life}</div>
    </section>

    <section id="business-case">
      <h2>Business case for the insurer</h2>
      <ul>
        <li><strong>Distribution leverage:</strong> reach digital-native volumes through checkout and POS rather than standalone D2C acquisition.</li>
        <li><strong>Product modularisation:</strong> scenario-tariff modules (retail, logistics, hospitality, healthcare, cyber in demo) map to filed “ingredients” you approve.</li>
        <li><strong>Operational efficiency:</strong> server-to-server APIs, idempotent binds, webhook contracts—reduce leakage and duplicate coverage.</li>
        <li><strong>Innovation narrative:</strong> embedded + optional ledger path (where legally and technically appropriate) for transparency.</li>
      </ul>
      <div class="figure"><img src="data:image/png;base64,{c3}" alt="Illustrative premium split"/></div>
      <p class="caption">Commercial splits are illustrative; actual economics depend on role (MGA vs broker vs tech fee), channel, and filings.</p>
    </section>

    <section id="pilot">
      <h2>Proposed pilot (90–120 days)</h2>
      <table>
        <thead><tr><th>Phase</th><th>Outcomes</th></tr></thead>
        <tbody>
          <tr><td>1 · Design</td><td>Chosen scenario(s), tariff mapping, disclosures, sandbox PAS events.</td></tr>
          <tr><td>2 · Integrate</td><td>Strict mode in staging; webhook to PAS; confirm on payment capture; fraud checks.</td></tr>
          <tr><td>3 · Live limited</td><td>One merchant or franchise POS cohort; monitoring, loss run, UX metrics.</td></tr>
          <tr><td>4 · Scale decision</td><td>Attach rate, conversion impact, claims cycle, partner revenue—go / refine / pause.</td></tr>
        </tbody>
      </table>
    </section>

    <section id="honesty">
      <h2>Transparency (builds underwriting trust)</h2>
      <p>The reference implementation <strong>does not</strong> replace filings, capital, licensed claims payment, or PAS depth. Items explicitly called out in <code>docs/WHITEPAPER-CODEBASE-MAP.md</code> as not yet wired include on-chain issuance from the API, parametric oracle payouts, and full carrier billing integration—<strong>these are partnership build scope</strong>, with SafeCover supplying the distribution orchestration skeleton you see in the repo.</p>
    </section>

    <section id="refs">
      <h2>Sources carried forward from your draft</h2>
      <p class="caption">BCG embedded insurance tech stack (2025); industry surveys on checkout protection preference; case patterns (e.g. airline attach, marketplace warranty uplift); Etherisc / parametric microinsurance references—as cited in your original Word document. SafeCover does not reproduce third-party charts here; use your compliance-approved versions where needed.</p>
    </section>

    <div class="footer">
      <p><strong>Download:</strong> use <code>docs/partner/SafeCover-Insurance-Partner-Pitch.html</code> (single file, charts embedded) or the generated PDF alongside it. Regenerate with <code>python docs/partner/build_partner_pitch_html.py</code> (requires matplotlib). Print → Save as PDF works from any browser.</p>
    </div>
  </div>
</body>
</html>
"""
    OUT.write_text(html, encoding="utf-8")
    print("Wrote", OUT, "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()
