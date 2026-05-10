# -*- coding: utf-8 -*-
"""Shared matplotlib renders for partner pitch (HTML + DOCX)."""
import base64
import io

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch, FancyArrowPatch


def _fig_to_bytes(fig, dpi=150):
    buf = io.BytesIO()
    fig.savefig(
        buf,
        format="png",
        dpi=dpi,
        bbox_inches="tight",
        facecolor="#0f172a",
        edgecolor="none",
    )
    plt.close(fig)
    buf.seek(0)
    return buf


def render_chart_pngs():
    """Return three BytesIO PNGs: market curve, value drivers, economics split."""
    out = []

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
    out.append(_fig_to_bytes(fig))

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
    out.append(_fig_to_bytes(fig))

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
    out.append(_fig_to_bytes(fig))

    return out


def charts_base64():
    return [base64.b64encode(b.getvalue()).decode() for b in render_chart_pngs()]


def render_diagram_ecosystem_png():
    """Channels → SafeCover → Insurer core (matplotlib)."""
    fig, ax = plt.subplots(figsize=(9.2, 4.2), facecolor="#0b1220")
    ax.set_facecolor("#0b1220")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4.2)
    ax.axis("off")
    ax.set_title(
        "Distribution and insurer-core architecture",
        color="#f8fafc",
        fontsize=14,
        fontweight="bold",
        pad=12,
    )

    def box(xy, w, h, title, lines, edge="#334155", face="#111827"):
        x, y = xy
        p = FancyBboxPatch(
            (x, y),
            w,
            h,
            boxstyle="round,pad=0.02,rounding_size=0.08",
            linewidth=2,
            edgecolor=edge,
            facecolor=face,
        )
        ax.add_patch(p)
        ax.text(
            x + w / 2,
            y + h - 0.35,
            title,
            ha="center",
            va="top",
            color="#94a3b8",
            fontsize=10,
        )
        yy = y + h - 0.75
        for line in lines:
            ax.text(x + w / 2, yy, line, ha="center", va="top", color="#e2e8f0", fontsize=9)
            yy -= 0.28
        return x, y, w, h

    box(
        (0.35, 0.9),
        2.0,
        2.6,
        "Channels",
        [
            "E-commerce",
            "Shopify, WooCommerce,",
            "BigCommerce, Magento",
            "",
            "Retail POS",
            "Terminals, ticket IDs",
            "HTTPS + JSON",
        ],
    )
    box(
        (3.2, 0.75),
        2.85,
        2.9,
        "SafeCover platform",
        [
            "Quote · Bind · Confirm",
            "Webhooks · POS enhanced",
            "Strict mode · HMAC",
            "Scenario engine",
            "Widget + adapters",
        ],
        edge="#6366f1",
        face="#0f172a",
    )
    box(
        (6.55, 0.9),
        2.15,
        2.6,
        "Licensed insurer core",
        ["PAS / policy admin", "Billing & premium", "Claims & TPA", "Filings · capital"],
        edge="#22c55e",
        face="#111827",
    )

    arr = FancyArrowPatch(
        (2.4, 2.2),
        (3.12, 2.2),
        arrowstyle="-|>",
        mutation_scale=18,
        linewidth=2,
        color="#64748b",
    )
    ax.add_patch(arr)
    arr2 = FancyArrowPatch(
        (6.08, 2.2),
        (6.48, 2.2),
        arrowstyle="-|>",
        mutation_scale=18,
        linewidth=2,
        color="#64748b",
    )
    ax.add_patch(arr2)
    ax.text(
        5,
        0.35,
        "Pilot: PAS webhooks, persistence, product codes aligned to filings.",
        ha="center",
        color="#64748b",
        fontsize=9,
    )
    return _fig_to_bytes(fig)


def render_diagram_lifecycle_png():
    fig, ax = plt.subplots(figsize=(9, 2.2), facecolor="#0b1220")
    ax.set_facecolor("#0b1220")
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 2.2)
    ax.axis("off")
    ax.set_title(
        "Quote → Bind → Confirm (payment-aligned)",
        color="#f8fafc",
        fontsize=13,
        fontweight="bold",
        pad=6,
    )
    w, h = 1.65, 0.95
    y = 0.55
    starts = [0.35, 2.25, 4.15, 6.05, 7.95]
    steps = [
        ("Quote", "POST /api/quote", "#1e293b"),
        ("Bind", "PENDING_PAYMENT", "#1e293b"),
        ("Payment", "Merchant PSP", "#1e293b"),
        ("Confirm", "ACTIVE + snapshot", "#14532d"),
        ("PAS", "System of record", "#0c4a6e"),
    ]
    for i, (x, (title, sub, fc)) in enumerate(zip(starts, steps)):
        ax.add_patch(
            FancyBboxPatch(
                (x, y),
                w,
                h,
                boxstyle="round,pad=0.02,rounding_size=0.06",
                facecolor=fc,
                edgecolor="#475569",
                linewidth=1.5,
            )
        )
        ax.text(
            x + w / 2,
            y + h - 0.2,
            title,
            ha="center",
            va="top",
            color="#f8fafc",
            fontsize=10,
            fontweight="bold",
        )
        ax.text(
            x + w / 2,
            y + 0.4,
            sub,
            ha="center",
            va="top",
            color="#94a3b8",
            fontsize=8,
        )
        if i < len(starts) - 1:
            ax.add_patch(
                FancyArrowPatch(
                    (x + w + 0.02, y + h / 2),
                    (starts[i + 1] - 0.02, y + h / 2),
                    arrowstyle="-|>",
                    mutation_scale=14,
                    linewidth=2,
                    color="#a78bfa",
                )
            )
    ax.text(
        5.5,
        0.12,
        "POS: POST /api/pos/enhanced operation sale when tender is complete.",
        ha="center",
        color="#64748b",
        fontsize=8,
    )
    return _fig_to_bytes(fig)


def render_diagram_stakeholder_png():
    fig, ax = plt.subplots(figsize=(8.8, 3.0), facecolor="#0b1220")
    ax.set_facecolor("#0b1220")
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 3)
    ax.axis("off")
    ax.set_title(
        "Three-sided value (embedded microinsurance)",
        color="#f8fafc",
        fontsize=13,
        fontweight="bold",
        pad=8,
    )
    circles = [
        (1.6, 1.45, "Consumer", ["One-tap cover", "In-context price"], "#164e63", "#22d3ee"),
        (5.0, 1.45, "Distributor", ["Conversion", "Ancillary revenue"], "#312e81", "#a78bfa"),
        (8.4, 1.45, "Insurer", ["Volume, low CAC", "Digital segments"], "#14532d", "#34d399"),
    ]
    for cx, cy, title, lines, fc, ec in circles:
        c = Circle((cx, cy), 0.78, facecolor=fc, edgecolor=ec, linewidth=2)
        ax.add_patch(c)
        ax.text(cx, cy + 0.25, title, ha="center", va="center", color="#f8fafc", fontsize=11, fontweight="bold")
        ax.text(cx, cy - 0.05, lines[0], ha="center", va="center", color="#e2e8f0", fontsize=8)
        if len(lines) > 1:
            ax.text(cx, cy - 0.32, lines[1], ha="center", va="center", color="#e2e8f0", fontsize=8)
    ax.plot([2.45, 3.55], [1.45, 1.45], color="#475569", linestyle="--", linewidth=1.5)
    ax.plot([5.85, 6.95], [1.45, 1.45], color="#475569", linestyle="--", linewidth=1.5)
    ax.text(
        5,
        0.25,
        "SafeCover orchestrates UX, APIs, and handoff to your licensed core.",
        ha="center",
        color="#64748b",
        fontsize=9,
    )
    return _fig_to_bytes(fig)


def render_all_diagram_pngs():
    return [
        render_diagram_ecosystem_png(),
        render_diagram_lifecycle_png(),
        render_diagram_stakeholder_png(),
    ]
