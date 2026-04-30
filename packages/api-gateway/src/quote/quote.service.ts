import crypto from 'crypto';
import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { ProductConfigService } from '../product-config/product-config.service';
import { QuoteRequestDto } from './quote.dto';
import { nanoid } from 'nanoid';

const QUOTE_TTL_MS = 15 * 60 * 1000; // 15 min
const PREMIUM_RATE = 0.025;
const MIN_PREMIUM = 50;

function serialHash(serial: string): string {
  const salt = process.env.SERIAL_HASH_SALT || 'salt';
  return crypto.createHash('sha256').update(`${salt}:${serial}`).digest('hex');
}

function priceItem(price: number): number {
  return Math.max(MIN_PREMIUM, Math.round(price * PREMIUM_RATE));
}

@Injectable()
export class QuoteService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private productConfig: ProductConfigService,
  ) {}

  async createQuote(
    partnerCode: string,
    idempotencyKey: string | undefined,
    body: QuoteRequestDto,
    correlationId?: string,
  ) {
    const productCode = body.product_code ?? 'ASSET_BASIC';
    const ts = new Date(body.timestamp);
    if (Number.isNaN(ts.getTime())) {
      throw new BadRequestException('Invalid timestamp');
    }

    // Parallel fetch: product, store+partner
    const [product, storeWithPartner] = await Promise.all([
      this.productConfig.getByCode(productCode),
      this.prisma.store.findUnique({
        where: { storeId: body.store_id },
        include: { partner: true },
      }),
    ]);

    if (!storeWithPartner?.isActive) {
      throw new BadRequestException('Invalid store_id');
    }
    const store = storeWithPartner;
    const partner = store.partner;
    if (!partner || partner.code !== partnerCode || store.partnerId !== partner.id) {
      throw new BadRequestException('Store does not belong to partner');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.quote.findFirst({
        where: {
          idempotencyKey,
          partnerId: partner.id,
          transactionId: body.transaction_id,
        },
        include: { items: true, productModule: true },
      });
      if (existing) return { replay: true, quote: existing };
    }

    const premiumTotal = body.items.reduce((sum, it) => sum + priceItem(it.price), 0);
    const sumInsuredTotal = body.items.reduce((sum, it) => sum + it.price, 0);

    const capCheck = this.productConfig.enforceDefaultCaps(
      product.segment,
      sumInsuredTotal,
      product.sumInsuredCap,
    );
    if (!capCheck.allowed) throw new BadRequestException(capCheck.reason);

    const quoteCode = `Q-${new Date().getUTCFullYear()}-${nanoid(8)}`;
    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);

    const disclosures = {
      plain_language_summary: product.disclosureMd,
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
          customerId: body.customer_id ?? undefined,
          productModuleId: product.id,
          transactionId: body.transaction_id,
          channel: body.channel as 'POS' | 'WEB' | 'APP' | 'USSD',
          timestamp: ts,
          premiumTotal,
          sumInsuredTotal,
          disclosures: JSON.stringify(disclosures),
          idempotencyKey,
          expiresAt,
          items: {
            create: body.items.map((it) => ({
              sku: it.sku,
              category: it.category,
              price: it.price,
              serialHash: serialHash(it.serial),
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
      eventType: 'QUOTE_CREATED',
      correlationId,
      payload: {
        quoteCode: quote.quoteCode,
        store_id: body.store_id,
        transaction_id: body.transaction_id,
        premiumTotal,
        sumInsuredTotal,
        productCode,
      },
    });

    return { replay: false, quote };
  }
}
