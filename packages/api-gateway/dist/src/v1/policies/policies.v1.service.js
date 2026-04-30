"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PoliciesV1Service = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const nanoid_1 = require("nanoid");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../common/audit/audit.service");
const policies_v1_dto_1 = require("./policies.v1.dto");
function sha256(input) {
    return crypto_1.default.createHash('sha256').update(input).digest('hex');
}
let PoliciesV1Service = class PoliciesV1Service {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    paymentRefFromIdempotency(partnerId, idem) {
        if (!idem)
            return `pay_${(0, nanoid_1.nanoid)(16)}`;
        return `idem_${sha256(`${partnerId}:${idem}`).slice(0, 24)}`;
    }
    async createPolicy(input) {
        const quote = await this.prisma.quote.findUnique({
            where: { quoteCode: input.quoteCode },
            include: { partner: true, store: true, productModule: true, items: true },
        });
        if (!quote)
            throw new common_1.BadRequestException('Invalid quote_id');
        if (quote.partner.code !== input.partnerCode)
            throw new common_1.BadRequestException('Quote does not belong to partner');
        const paymentRef = input.payment.payment_reference ??
            this.paymentRefFromIdempotency(quote.partnerId, input.idempotencyKey);
        const existing = await this.prisma.policy.findFirst({
            where: { partnerId: quote.partnerId, paymentRef },
            include: { productModule: true },
        });
        if (existing) {
            return { replay: true, policy: existing, async: false };
        }
        const now = new Date();
        const startsAt = now;
        const endsAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        const coolingOffEndsAt = new Date(now.getTime() + quote.productModule.coolingOffDays * 24 * 60 * 60 * 1000);
        const policyNumber = `POL-${new Date().getUTCFullYear()}-${(0, nanoid_1.nanoid)(10)}`;
        const isAsync = input.payment.mode === policies_v1_dto_1.PaymentModeV1.SAFECOVER_COLLECT;
        const dbStatus = isAsync ? 'ISSUED' : 'ACTIVE';
        const policy = await this.prisma.$transaction(async (tx) => {
            const p = await tx.policy.create({
                data: {
                    policyNumber,
                    partnerId: quote.partnerId,
                    storeId: quote.storeId,
                    customerId: quote.customerId ?? undefined,
                    productModuleId: quote.productModuleId,
                    quoteId: quote.id,
                    status: dbStatus,
                    premiumTotal: quote.premiumTotal,
                    sumInsuredTotal: quote.sumInsuredTotal,
                    paymentRef,
                    certificateUrl: null,
                    startsAt,
                    endsAt,
                    coolingOffEndsAt,
                    fraudDecision: client_1.FraudDecision.HOLD,
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
        return { replay: false, policy, async: isAsync };
    }
    async getPolicyByNumber(partnerCode, policyNumber) {
        const policy = await this.prisma.policy.findUnique({
            where: { policyNumber },
            include: { partner: true },
        });
        if (!policy)
            return null;
        if (policy.partner.code !== partnerCode)
            return null;
        return policy;
    }
};
exports.PoliciesV1Service = PoliciesV1Service;
exports.PoliciesV1Service = PoliciesV1Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], PoliciesV1Service);
//# sourceMappingURL=policies.v1.service.js.map