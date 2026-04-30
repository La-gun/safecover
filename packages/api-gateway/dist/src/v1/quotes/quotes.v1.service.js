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
exports.QuotesV1Service = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const nanoid_1 = require("nanoid");
const audit_service_1 = require("../../common/audit/audit.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const product_config_service_1 = require("../../product-config/product-config.service");
const quotes_v1_dto_1 = require("./quotes.v1.dto");
const QUOTE_TTL_MS = 15 * 60 * 1000;
const PREMIUM_RATE = 0.025;
const MIN_PREMIUM = 50;
function sha256(input) {
    return crypto_1.default.createHash('sha256').update(input).digest('hex');
}
function priceItem(price) {
    return Math.max(MIN_PREMIUM, Math.round(price * PREMIUM_RATE));
}
function normalizeSegment(segment) {
    return String(segment).toLowerCase();
}
let QuotesV1Service = class QuotesV1Service {
    constructor(prisma, audit, productConfig) {
        this.prisma = prisma;
        this.audit = audit;
        this.productConfig = productConfig;
    }
    async createQuote(partnerCode, idempotencyKey, body, correlationId) {
        const productCode = body.product_code ?? 'ASSET_BASIC';
        const mode = body.mode ?? quotes_v1_dto_1.QuoteModeV1.SINGLE;
        const ts = new Date(body.timestamp);
        if (Number.isNaN(ts.getTime()))
            throw new common_1.BadRequestException('Invalid timestamp');
        if (!Array.isArray(body.items) || body.items.length === 0) {
            throw new common_1.BadRequestException('items must be a non-empty array');
        }
        const [product, storeWithPartner] = await Promise.all([
            this.productConfig.getByCode(productCode),
            this.prisma.store.findUnique({
                where: { storeId: body.store_id },
                include: { partner: true },
            }),
        ]);
        if (!storeWithPartner?.isActive)
            throw new common_1.BadRequestException('Invalid store_id');
        const store = storeWithPartner;
        const partner = store.partner;
        if (!partner || partner.code !== partnerCode || store.partnerId !== partner.id) {
            throw new common_1.BadRequestException('Store does not belong to partner');
        }
        if (idempotencyKey) {
            const existing = await this.prisma.quote.findFirst({
                where: { idempotencyKey, partnerId: partner.id, transactionId: body.transaction_id },
                include: { items: true, productModule: true },
            });
            if (existing)
                return { replay: true, quote: existing, mode };
        }
        const toItemValue = (it) => (it.declared_value ?? it.unit_price ?? 0) * (it.quantity ?? 1);
        const sumInsuredTotal = body.items.reduce((sum, it) => sum + toItemValue(it), 0);
        const premiumTotal = body.items.reduce((sum, it) => sum + priceItem(toItemValue(it)), 0);
        const capCheck = this.productConfig.enforceDefaultCaps(product.segment, sumInsuredTotal, product.sumInsuredCap);
        if (!capCheck.allowed)
            throw new common_1.BadRequestException(capCheck.reason);
        const quoteCode = `Q-${new Date().getUTCFullYear()}-${(0, nanoid_1.nanoid)(8)}`;
        const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
        const disclosures = {
            plain_language_summary_md: product.disclosureMd,
            cooling_off_days: product.coolingOffDays,
            sum_insured_cap: product.sumInsuredCap,
            key_rules: product.rulesJson,
        };
        const quote = await this.prisma.$transaction(async (tx) => {
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
    buildOffers(input) {
        const baseOffer = (id, multiplier, label) => ({
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
        if (input.mode === quotes_v1_dto_1.QuoteModeV1.SINGLE) {
            return {
                offers: [baseOffer('OFF_01', 1, 'Standard')],
                recommended_offer_id: 'OFF_01',
            };
        }
        const offers = [
            baseOffer('OFF_01', 0.95, 'Value'),
            baseOffer('OFF_02', 1.0, 'Standard'),
            baseOffer('OFF_03', 1.15, 'Premium'),
        ].sort((a, b) => (a.pricing.premium_total ?? 0) - (b.pricing.premium_total ?? 0));
        return { offers, recommended_offer_id: offers[0]?.offer_id ?? null };
    }
    async getQuoteByCode(partnerCode, quoteCode) {
        const quote = await this.prisma.quote.findUnique({
            where: { quoteCode },
            include: { items: true, productModule: true, partner: true },
        });
        if (!quote)
            return null;
        if (quote.partner.code !== partnerCode)
            return null;
        return quote;
    }
};
exports.QuotesV1Service = QuotesV1Service;
exports.QuotesV1Service = QuotesV1Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        product_config_service_1.ProductConfigService])
], QuotesV1Service);
//# sourceMappingURL=quotes.v1.service.js.map