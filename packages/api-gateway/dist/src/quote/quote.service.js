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
exports.QuoteService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../common/audit/audit.service");
const product_config_service_1 = require("../product-config/product-config.service");
const nanoid_1 = require("nanoid");
const QUOTE_TTL_MS = 15 * 60 * 1000;
const PREMIUM_RATE = 0.025;
const MIN_PREMIUM = 50;
function serialHash(serial) {
    const salt = process.env.SERIAL_HASH_SALT || 'salt';
    return crypto_1.default.createHash('sha256').update(`${salt}:${serial}`).digest('hex');
}
function priceItem(price) {
    return Math.max(MIN_PREMIUM, Math.round(price * PREMIUM_RATE));
}
let QuoteService = class QuoteService {
    constructor(prisma, audit, productConfig) {
        this.prisma = prisma;
        this.audit = audit;
        this.productConfig = productConfig;
    }
    async createQuote(partnerCode, idempotencyKey, body, correlationId) {
        const productCode = body.product_code ?? 'ASSET_BASIC';
        const ts = new Date(body.timestamp);
        if (Number.isNaN(ts.getTime())) {
            throw new common_1.BadRequestException('Invalid timestamp');
        }
        const [product, storeWithPartner] = await Promise.all([
            this.productConfig.getByCode(productCode),
            this.prisma.store.findUnique({
                where: { storeId: body.store_id },
                include: { partner: true },
            }),
        ]);
        if (!storeWithPartner?.isActive) {
            throw new common_1.BadRequestException('Invalid store_id');
        }
        const store = storeWithPartner;
        const partner = store.partner;
        if (!partner || partner.code !== partnerCode || store.partnerId !== partner.id) {
            throw new common_1.BadRequestException('Store does not belong to partner');
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
            if (existing)
                return { replay: true, quote: existing };
        }
        const premiumTotal = body.items.reduce((sum, it) => sum + priceItem(it.price), 0);
        const sumInsuredTotal = body.items.reduce((sum, it) => sum + it.price, 0);
        const capCheck = this.productConfig.enforceDefaultCaps(product.segment, sumInsuredTotal, product.sumInsuredCap);
        if (!capCheck.allowed)
            throw new common_1.BadRequestException(capCheck.reason);
        const quoteCode = `Q-${new Date().getUTCFullYear()}-${(0, nanoid_1.nanoid)(8)}`;
        const expiresAt = new Date(Date.now() + QUOTE_TTL_MS);
        const disclosures = {
            plain_language_summary: product.disclosureMd,
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
                    customerId: body.customer_id ?? undefined,
                    productModuleId: product.id,
                    transactionId: body.transaction_id,
                    channel: body.channel,
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
};
exports.QuoteService = QuoteService;
exports.QuoteService = QuoteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        product_config_service_1.ProductConfigService])
], QuoteService);
//# sourceMappingURL=quote.service.js.map