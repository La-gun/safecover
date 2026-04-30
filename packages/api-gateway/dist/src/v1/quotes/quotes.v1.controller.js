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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotesV1Controller = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../../common/auth/auth.guard");
const quotes_v1_dto_1 = require("./quotes.v1.dto");
const quotes_v1_service_1 = require("./quotes.v1.service");
let QuotesV1Controller = class QuotesV1Controller {
    constructor(quotes) {
        this.quotes = quotes;
    }
    async createQuote(req, body, idem) {
        const correlationId = req.headers['x-correlation-id'];
        const result = await this.quotes.createQuote(req.partner.partnerCode, idem, body, correlationId);
        const q = result.quote;
        const offersBlock = this.quotes.buildOffers({
            quoteCode: q.quoteCode,
            productCode: q.productModule.code,
            productName: q.productModule.name,
            segment: q.productModule.segment,
            premiumBase: q.premiumTotal,
            sumInsuredTotal: q.sumInsuredTotal,
            mode: result.mode,
        });
        return {
            replay: result.replay,
            quote: {
                quote_id: q.quoteCode,
                status: q.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
                created_at: q.createdAt,
                expires_at: q.expiresAt,
                store_id: body.store_id,
                transaction_id: q.transactionId,
                channel: q.channel,
                jurisdiction: body.jurisdiction ?? null,
                currency: body.currency ?? q.productModule.currency,
                product_code: q.productModule.code,
                sum_insured_total: q.sumInsuredTotal,
                premium_total_min: Math.min(...offersBlock.offers.map((o) => o.pricing.premium_total)),
                premium_total_max: Math.max(...offersBlock.offers.map((o) => o.pricing.premium_total)),
                disclosures: q.disclosures,
                offers: offersBlock.offers,
                recommended_offer_id: offersBlock.recommended_offer_id,
                selected_offer_id: null,
            },
        };
    }
    async getQuote(req, quoteId) {
        const q = await this.quotes.getQuoteByCode(req.partner.partnerCode, quoteId);
        if (!q)
            return { error: 'Not found', code: 'NOT_FOUND' };
        const offersBlock = this.quotes.buildOffers({
            quoteCode: q.quoteCode,
            productCode: q.productModule.code,
            productName: q.productModule.name,
            segment: q.productModule.segment,
            premiumBase: q.premiumTotal,
            sumInsuredTotal: q.sumInsuredTotal,
            mode: 'SINGLE',
        });
        return {
            quote: {
                quote_id: q.quoteCode,
                status: q.status === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
                created_at: q.createdAt,
                expires_at: q.expiresAt,
                transaction_id: q.transactionId,
                channel: q.channel,
                currency: q.productModule.currency,
                product_code: q.productModule.code,
                sum_insured_total: q.sumInsuredTotal,
                premium_total_min: Math.min(...offersBlock.offers.map((o) => o.pricing.premium_total)),
                premium_total_max: Math.max(...offersBlock.offers.map((o) => o.pricing.premium_total)),
                disclosures: q.disclosures,
                offers: offersBlock.offers,
                recommended_offer_id: offersBlock.recommended_offer_id,
                selected_offer_id: null,
            },
        };
    }
    async selectOffer(quoteId, offerId) {
        return { quote_id: quoteId, selected_offer_id: offerId };
    }
};
exports.QuotesV1Controller = QuotesV1Controller;
__decorate([
    (0, common_1.Post)('/quotes'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: false }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, quotes_v1_dto_1.CreateQuoteV1RequestDto, String]),
    __metadata("design:returntype", Promise)
], QuotesV1Controller.prototype, "createQuote", null);
__decorate([
    (0, common_1.Get)('/quotes/:quote_id'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('quote_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], QuotesV1Controller.prototype, "getQuote", null);
__decorate([
    (0, common_1.Post)('/quotes/:quote_id/select'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: false }),
    __param(0, (0, common_1.Param)('quote_id')),
    __param(1, (0, common_1.Body)('offer_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], QuotesV1Controller.prototype, "selectOffer", null);
exports.QuotesV1Controller = QuotesV1Controller = __decorate([
    (0, swagger_1.ApiTags)('quotes-v1'),
    (0, common_1.Controller)('/api/v1'),
    __metadata("design:paramtypes", [quotes_v1_service_1.QuotesV1Service])
], QuotesV1Controller);
//# sourceMappingURL=quotes.v1.controller.js.map