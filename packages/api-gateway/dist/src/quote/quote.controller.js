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
exports.QuoteController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_guard_1 = require("../common/auth/auth.guard");
const quote_dto_1 = require("./quote.dto");
const quote_service_1 = require("./quote.service");
let QuoteController = class QuoteController {
    constructor(quoteService) {
        this.quoteService = quoteService;
    }
    async quote(req, body, idem) {
        const correlationId = req.headers['x-correlation-id'];
        const result = await this.quoteService.createQuote(req.partner.partnerCode, idem, body, correlationId);
        const q = result.quote;
        return {
            replay: result.replay,
            quote_id: q.quoteCode,
            expires_at: q.expiresAt,
            premium_total: q.premiumTotal,
            sum_insured_total: q.sumInsuredTotal,
            disclosures: (() => {
                if (typeof q.disclosures !== 'string')
                    return q.disclosures ?? {};
                try {
                    return JSON.parse(q.disclosures || '{}');
                }
                catch {
                    return {};
                }
            })(),
            offers: [
                {
                    product_code: q.productModule.code,
                    product_name: q.productModule.name,
                    segment: q.productModule.segment,
                },
            ],
        };
    }
};
exports.QuoteController = QuoteController;
__decorate([
    (0, common_1.Post)('/quote'),
    (0, common_1.UseGuards)(auth_guard_1.PartnerAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiHeader)({ name: 'Idempotency-Key', required: false }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, quote_dto_1.QuoteRequestDto, String]),
    __metadata("design:returntype", Promise)
], QuoteController.prototype, "quote", null);
exports.QuoteController = QuoteController = __decorate([
    (0, swagger_1.ApiTags)('quote'),
    (0, common_1.Controller)('/api'),
    __metadata("design:paramtypes", [quote_service_1.QuoteService])
], QuoteController);
//# sourceMappingURL=quote.controller.js.map