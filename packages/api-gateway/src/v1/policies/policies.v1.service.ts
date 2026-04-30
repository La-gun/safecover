import crypto from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, FraudDecision } from '@prisma/client';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { PaymentModeV1 } from './policies.v1.dto';

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class PoliciesV1Service {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  private paymentRefFromIdempotency(partnerId: string, idem?: string) {
    if (!idem) return `pay_${nanoid(16)}`;
    return `idem_${sha256(`${partnerId}:${idem}`).slice(0, 24)}`;
  }

  async createPolicy(input: {
    partnerCode: string;
    idempotencyKey?: string;
    quoteCode: string;
    offerId: string;
    payment: {
      mode: PaymentModeV1;
      transaction_id?: string;
      amount_paid?: number;
      currency?: string;
      processor?: string;
      payment_reference?: string;
    };
    correlationId?: string;
  }) {
    const quote = await this.prisma.quote.findUnique({
      where: { quoteCode: input.quoteCode },
      include: { partner: true, store: true, productModule: true, items: true },
    });
    if (!quote) throw new BadRequestException('Invalid quote_id');
    if (quote.partner.code !== input.partnerCode) throw new BadRequestException('Quote does not belong to partner');

    // Minimal idempotency: derive a unique paymentRef from idempotency key.
    const paymentRef =
      input.payment.payment_reference ??
      this.paymentRefFromIdempotency(quote.partnerId, input.idempotencyKey);

    const existing = await this.prisma.policy.findFirst({
      where: { partnerId: quote.partnerId, paymentRef },
      include: { productModule: true },
    });
    if (existing) {
      return { replay: true, policy: existing, async: false as const };
    }

    const now = new Date();
    const startsAt = now;
    const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const coolingOffEndsAt = new Date(now.getTime() + quote.productModule.coolingOffDays * 24 * 60 * 60 * 1000);

    const policyNumber = `POL-${new Date().getUTCFullYear()}-${nanoid(10)}`;

    const isAsync = input.payment.mode === PaymentModeV1.SAFECOVER_COLLECT;
    const dbStatus = isAsync ? 'ISSUED' : 'ACTIVE';

    const policy = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.policy.create({
        data: {
          policyNumber,
          partnerId: quote.partnerId,
          storeId: quote.storeId,
          customerId: quote.customerId ?? undefined,
          productModuleId: quote.productModuleId,
          quoteId: quote.id,
          status: dbStatus as any,
          premiumTotal: quote.premiumTotal,
          sumInsuredTotal: quote.sumInsuredTotal,
          paymentRef,
          certificateUrl: null,
          startsAt,
          endsAt,
          coolingOffEndsAt,
          fraudDecision: FraudDecision.HOLD,
          fraudScore: 0,
          items: {
            create: quote.items.map((it) => ({
              sku: it.sku,
              category: it.category,
              price: it.price,
              serialHash: it.serialHash,
            })),
          },
        },
        include: { productModule: true },
      });
      return p;
    });

    await this.audit.append({
      actorType: 'PARTNER',
      partnerCode: input.partnerCode,
      entityType: 'POLICY',
      entityId: policy.id,
      eventType: isAsync ? 'POLICY_CREATE_PENDING_PAYMENT_V1' : 'POLICY_ISSUED_V1',
      correlationId: input.correlationId,
      payload: {
        policyNumber: policy.policyNumber,
        quote_id: input.quoteCode,
        offer_id: input.offerId,
        payment: {
          mode: input.payment.mode,
          transaction_id: input.payment.transaction_id,
          amount_paid: input.payment.amount_paid,
          currency: input.payment.currency,
          processor: input.payment.processor,
          payment_reference: input.payment.payment_reference,
        },
      },
    });

    return { replay: false, policy, async: isAsync as boolean };
  }

  async getPolicyByNumber(partnerCode: string, policyNumber: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { policyNumber },
      include: { partner: true },
    });
    if (!policy) return null;
    if (policy.partner.code !== partnerCode) return null;
    return policy;
  }
}

