import crypto from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ProductSegment } from '@prisma/client';
import { nanoid } from 'nanoid';
import { AuditService } from '../../common/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductConfigService } from '../../product-config/product-config.service';
import { CreateQuoteV1RequestDto, QuoteModeV1 } from './quotes.v1.dto';

const QUOTE_TTL_MS = 15 * 60 * 1000; // 15 min
const PREMIUM_RATE = 0.025;
const MIN_PREMIUM = 50;

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function priceItem(price: number): number {
  return Math.max(MIN_PREMIUM, Math.round(price * PREMIUM_RATE));
}

function normalizeSegment(segment: ProductSegment): string {
  return String(segment).toLowerCase();
}

@Injectable()
export class QuotesV1Service {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private productConfig: ProductConfigService,
  ) {}

  async createQuote(
    partnerCode: string,
    idempotencyKey: string | undefined,
    body: CreateQuoteV1RequestDto,
    correlationId?: string,
  ) {
    const productCode = body.product_code ?? 'ASSET_BASIC';
    const mode = body.mode ?? QuoteModeV1.SINGLE;

    const ts = new Date(body.timestamp);
    if (Number.isNaN(ts.getTime())) throw new BadRequestException('Invalid timestamp');
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('items must be a non-empty array');
    }

    // Parallel fetch: product, store+partner
    const [product, storeWithPartner] = await Promise.all([
      this.productConfig.getByCode(productCode),
      this.prisma.store.findUnique({
        where: { storeId: body.store_id },
        include: { partner: true },
      }),
    ]);

    if (!storeWithPartner?.isActive) throw new BadRequestException('Invalid store_id');
    const store = storeWithPartner;
    const partner = store.partner;
    if (!partner || partner.code !== partnerCode || store.partnerId !== partner.id) {
      throw new BadRequestException('Store does not belong to partner');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.quote.findFirst({
        where: { idempotencyKey, partnerId: partner.id, transactionId: body.transaction_id },
        include: { items: true, productModule: true },
      });
      if (existing) return { replay: true, quote: existing, mode };
    }

    const toItemValue = (it: (typeof body.items)[number]) =>
      (it.declared_value ?? it.unit_price ?? 0) * (it.quantity ?? 1);

    const sumInsuredTotal = body.items.reduce((sum, it) => sum + toItemValue(it), 0);
    const premiumTotal = body.items.reduce(
      (sum, it) => sum + priceItem(toItemValue(it)),
      0,
    );

    const capCheck = this.productConfig.enforceDefaultCaps(
      product.segment,
      sumInsuredTotal,
      product.sumInsuredCap,
    );
    if (!capCheck.allowed) throw new BadRequestException(capCheck.reason);

    const quoteCode = `Q-${new Date().getUTCFullYear()}-${nanoid(8)}`;
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);

    const disclosures = {
      plain_language_summary_md: product.disclosureMd,
      cooling_off_days: product.coolingOffDays,
      sum_insured_cap: product.sumInsuredCap,
      key_rules: product.rulesJson,
    };

    const quote = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const q = await tx.quote.create({
        data: {
          quoteCode,
          partnerId: partner.id,
          storeId: store.id,
          customerId: body.customer?.customer_id ?? undefined,
          productModuleId: product.id,
          transactionId: body.transaction_id,
          channel: body.channel,
          timestamp: ts,
          premiumTotal,
          sumInsuredTotal,
          disclosures,
          idempotencyKey,
          expiresAt,
          items: {
            create: body.items.map((it, idx) => ({
              sku: it.sku,
              category: it.category ?? 'unknown',
              price: toItemValue(it),
              // serial is optional in v1; keep deterministic hash for idempotent retries
              serialHash: sha256(it.serial ?? `${body.transaction_id}:${it.sku}:${idx}`),
            })),
          },
        },
        include: { items: true, productModule: true },
      });
      return q;
    });

    await this.audit.append({
      actorType: 'PARTNER',
      partnerCode,
      entityType: 'QUOTE',
      entityId: quote.id,
      eventType: 'QUOTE_CREATED_V1',
      correlationId,
      payload: {
        quoteCode: quote.quoteCode,
        store_id: body.store_id,
        transaction_id: body.transaction_id,
        product_code: productCode,
        mode,
        premiumTotal,
        sumInsuredTotal,
      },
    });

    return { replay: false, quote, mode };
  }

  buildOffers(input: {
    quoteCode: string;
    productCode: string;
    productName: string;
    segment: ProductSegment;
    premiumBase: number;
    sumInsuredTotal: number;
    mode: QuoteModeV1;
  }) {
    const baseOffer = (id: string, multiplier: number, label: string) => ({
      offer_id: id,
      provider: { provider_id: 'safecover', name: 'SafeCover', logo: '🛡️', tagline: '' },
      plan: {
        plan_id: label.toLowerCase(),
        name: label,
        summary: '',
        benefits: [],
        terms_url: '/terms.html',
      },
      pricing: {
        premium_total: Math.max(MIN_PREMIUM, Math.round(input.premiumBase * multiplier)),
        commission_total: 0,
        tax_total: 0,
      },
      coverage: {
        type: input.productCode,
        sum_insured_total: input.sumInsuredTotal,
        duration: '12 months',
        excess: 50,
      },
      underwriting: { decision: 'APPROVE', requires_async_issue: false },
    });

    if (input.mode === QuoteModeV1.SINGLE) {
      return {
        offers: [baseOffer('OFF_01', 1, 'Standard')],
        recommended_offer_id: 'OFF_01',
      };
    }

    // Minimal “rate/compare” implementation: create a few tiered offers.
    const offers = [
      baseOffer('OFF_01', 0.95, 'Value'),
      baseOffer('OFF_02', 1.0, 'Standard'),
      baseOffer('OFF_03', 1.15, 'Premium'),
    ].sort((a, b) => (a.pricing.premium_total ?? 0) - (b.pricing.premium_total ?? 0));

    return { offers, recommended_offer_id: offers[0]?.offer_id ?? null };
  }

  async getQuoteByCode(partnerCode: string, quoteCode: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { quoteCode },
      include: { items: true, productModule: true, partner: true },
    });
    if (!quote) return null;
    if (quote.partner.code !== partnerCode) return null;
    return quote;
  }
}

